import express from 'express';
import dotenv from 'dotenv';
import whatsappPkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = whatsappPkg;
import qrcode from 'qrcode-terminal';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fetch from 'node-fetch';

import { DatabaseService } from './database.js';
import { AIService } from './ai.js';
import { MultiAIService } from './multi-ai.js';
import { MegaService } from './mega.js';
import { OCRService } from './ocr.js';
import { ConversationManager } from './conversation.js';
import { UserManager } from './user-manager.js';
import { AuthService } from './auth.js';
import { PresentationService, detectPresentationIntent } from './presentation-service.js';
import { availableStates, gradeLevels, getCurriculumEntry, getStateGradeMap } from './curriculum-data.js';
import Groq from 'groq-sdk';
import FormData from 'form-data';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
const uploadsDir = path.join(publicDir, 'uploads');
const materialsUploadDir = path.join(uploadsDir, 'materials');
const avatarsUploadDir = path.join(uploadsDir, 'avatars');
// Nutze DATA_DIR wenn gesetzt, sonst lokales data Verzeichnis
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const whatsappSessionDir = path.join(dataDir, 'whatsapp-session');

app.use(express.json());
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
}
ensureDir(uploadsDir);
ensureDir(materialsUploadDir);
ensureDir(avatarsUploadDir);
ensureDir(whatsappSessionDir);
app.use('/uploads', express.static(uploadsDir));

let whatsappClient = null;
let isReady = false;
let currentQR = null;

let maxSpamLimit = 500;

console.log('\n🚀 Initialisiere Services mit SQLite Database...\n');

const db = new DatabaseService();
const aiService = new AIService();
const multiAI = new MultiAIService();
const megaService = new MegaService();
const ocrService = new OCRService();
const conversationManager = new ConversationManager(db);
const userManager = new UserManager(db);
const authService = new AuthService(db);
const presentationService = new PresentationService({
    multiAI,
    outputDir: path.join(publicDir, 'generated', 'presentations')
});

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || '';
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.RENDER_KEEP_ALIVE_URL || '';
const KEEP_ALIVE_INTERVAL = parseInt(process.env.KEEP_ALIVE_INTERVAL || '300000', 10);
const DEFAULT_PRESENTATION_LANGUAGE = process.env.DEFAULT_PRESENTATION_LANGUAGE || 'de';
const DEFAULT_PRESENTATION_SLIDES = parseInt(process.env.DEFAULT_PRESENTATION_SLIDES || '8', 10);
const DB_BACKUP_INTERVAL_MIN = parseInt(process.env.DB_BACKUP_INTERVAL || '120', 10);

console.log('\n✅ Alle Services initialisiert\n');
function migrateUsersFromJSON() {
    const usersPath = path.join(__dirname, 'data/users.json');

    if (!fs.existsSync(usersPath)) {
        console.log('ℹ️ Keine users.json gefunden - überspringe Migration');
        return;
    }

    try {
        const oldUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        let migrated = 0;
        let skipped = 0;

        console.log('\n📦 Starte User-Migration aus users.json...');

        for (const [userId, user] of Object.entries(oldUsers)) {
            const existing = db.getUser(userId);
            if (existing) {
                skipped += 1;
                continue;
            }

            const success = db.createUser(
                userId,
                user.username,
                user.password,
                user.phone || null,
                user.role || 'user',
                user.settings || {},
                user.createdBy || 'migration'
            );

            if (success) migrated += 1;
        }

        console.log(`✅ Migration abgeschlossen: ${migrated} User importiert, ${skipped} übersprungen`);

        if (migrated > 0) {
            fs.renameSync(usersPath, `${usersPath}.backup`);
            console.log('📁 users.json → users.json.backup umbenannt');
        }
    } catch (error) {
        console.error('❌ Migration fehlgeschlagen:', error.message);
    }
}

migrateUsersFromJSON();
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

async function getPuppeteerConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isWindows = os.platform() === 'win32';

    if (isProduction && !isWindows) {
        try {
            const chromium = await import('@sparticuz/chromium');
            const executablePath = await chromium.default.executablePath();

            console.log('⚙️ Production Mode: Nutze @sparticuz/chromium');

            return {
                executablePath,
                headless: true,
                args: [
                    ...chromium.default.args,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                ignoreHTTPSErrors: true,
                timeout: 60000
            };
        } catch (error) {
            console.error('❌ Chromium setup failed:', error);
            throw error;
        }
    }

    console.log('🛠️ Development Mode: Nutze lokales Chrome/Chromium');

    return {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null,
        timeout: 0
    };
}
async function initializeWhatsApp() {
    console.log('🤖 Initialisiere WhatsApp Client...');

    try {
        const puppeteerConfig = await getPuppeteerConfig();
        whatsappClient = new Client({
            authStrategy: new LocalAuth({
                clientId: 'wh-ha-bot',
                dataPath: whatsappSessionDir
            }),
            puppeteer: puppeteerConfig,
            qrMaxRetries: 5,
            restartOnAuthFail: true,
            takeoverOnConflict: true,
            takeoverTimeoutMs: 60000
        });

        whatsappClient.on('qr', (qr) => {
            console.log('\n' + '='.repeat(60));
            console.log('📱 WHATSAPP QR CODE - JETZT SCANNEN!');
            console.log('='.repeat(60));
            qrcode.generate(qr, { small: true });
            console.log('📱 WhatsApp öffnen → Menü → Verknüpfte Geräte → Gerät verknüpfen');
            console.log('🌐 QR Code auch unter: http://localhost:' + PORT + '/qr');
            console.log('='.repeat(60) + '\n');
            currentQR = qr;
            setTimeout(() => { currentQR = null; }, 60000);
        });

        whatsappClient.on('ready', () => {
            console.log('\n✅ WhatsApp Bot ist bereit und verbunden!');
            console.log('📊 Dashboard: http://localhost:' + PORT + '/dashboard\n');
            isReady = true;
        });

        whatsappClient.on('message', async (message) => {
            try {
                await handleMessage(message);
            } catch (error) {
                console.error('❌ Fehler beim Verarbeiten der Nachricht:', error);
            }
        });

        whatsappClient.on('authenticated', () => {
            console.log('🔐 WhatsApp authentifiziert');
        });

        whatsappClient.on('auth_failure', (msg) => {
            console.error('❌ Authentifizierung fehlgeschlagen:', msg);
        });

        whatsappClient.on('disconnected', (reason) => {
            console.log('⚠️ WhatsApp getrennt:', reason);
            isReady = false;
            setTimeout(initializeWhatsApp, 10000);
        });

        whatsappClient.on('loading_screen', (percent, message) => {
            console.log('⌛ Lade WhatsApp Web:', percent + '%', message);
        });

        await whatsappClient.initialize();
    } catch (error) {
        console.error('❌ WhatsApp Initialisierung fehlgeschlagen:', error);
        console.log('🔁 Versuche in 15 Sekunden erneut...');
        setTimeout(initializeWhatsApp, 15000);
    }
}
async function handleMessage(message) {
    if (message.from === 'status@broadcast') return;
    if (message.fromMe) return;

    const chat = await message.getChat();
    const chatId = chat.id._serialized;
    const phoneNumber = chat.id.user ? `+${chat.id.user.replace('@c.us', '')}` : null;
    const userSettings = userManager.getUserSettings(phoneNumber) || {};

    console.log(`💬 Nachricht von ${chat.name || chat.id.user} (${phoneNumber || 'Unbekannt'}): ${message.body}`);

    if (userSettings.reactOnCommand) {
        const prefix = userSettings.commandPrefix || '!';
        if (!message.body.startsWith(prefix)) {
            console.log(`🚫 Nachricht ignoriert (User reagiert nur auf "${prefix}" Befehle)`);
            return;
        }
        message.body = message.body.substring(prefix.length).trim();
    }

    message.body = applyAliases(message.body, userSettings.aliases);

    if (message.body.startsWith('?spam ')) {
        const spamMatch = message.body.match(/^\?spam\s+(.+?)\s+(\d+)$/);

        if (!spamMatch) {
            console.log('⚠️ Ungültiges Spam-Format');
            return;
        }

        const spamText = spamMatch[1];
        let spamCount = parseInt(spamMatch[2], 10);
        const userSpamLimit = userSettings.spamLimit || maxSpamLimit;

        if (spamCount > userSpamLimit) {
            console.log(`⚠️ Maximum für ${chat.name}: ${userSpamLimit} Nachrichten! Setze auf ${userSpamLimit}...`);
            spamCount = userSpamLimit;
        }

        if (spamCount < 1) {
            console.log('⚠️ Anzahl muss mindestens 1 sein!');
            return;
        }

        console.log(`📣 SPAM AKTIVIERT: "${spamText}" x${spamCount} Nachrichten - MAXIMALE GESCHWINDIGKEIT!`);

        const startTime = Date.now();
        let sentCount = 0;
        let errorCount = 0;

        try {
            const promises = [];
            for (let i = 0; i < spamCount; i++) {
                promises.push(
                    chat.sendMessage(spamText)
                        .then(() => { sentCount += 1; })
                        .catch(() => { errorCount += 1; })
                );
            }

            await Promise.allSettled(promises);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const messagesPerSecond = (sentCount / parseFloat(duration)).toFixed(1);

            console.log(`✅ Spam abgeschlossen: ${sentCount}/${spamCount} Nachrichten in ${duration}s (${messagesPerSecond} msg/s)`);
            if (errorCount > 0) {
                console.log(`❗ Fehler: ${errorCount} Nachrichten konnten nicht gesendet werden`);
            }
        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.error(`⛔ Spam gestoppt nach ${duration}s - ${sentCount}/${spamCount} gesendet - Fehler: ${error.message}`);
        }

        return;
    }

    if (message.body.toLowerCase().includes('vergiss') &&
        (message.body.toLowerCase().includes('nachricht') ||
            message.body.toLowerCase().includes('chat') ||
            message.body.toLowerCase().includes('gespräch'))) {
        conversationManager.clearChat(chatId);
        await message.reply('🧹 Alle Nachrichten in diesem Chat wurden vergessen. Wir können von vorne anfangen!');
        return;
    }

    let userMessage = message.body;
    let forceMode = null;
    const keywordRouting = userSettings.keywordRouting || {};
    const megaKeywordTriggered = containsKeyword(userMessage, keywordRouting.mega);
    const ocrKeywordTriggered = containsKeyword(userMessage, keywordRouting.ocr);

    if (userMessage.startsWith('.')) {
        forceMode = 'simple';
        userMessage = userMessage.substring(1).trim();
        console.log('✨ SIMPLE MODE erzwungen (nur Gemini)');
        conversationManager.incrementSimpleForced?.();
    } else if (userMessage.startsWith('/')) {
        forceMode = 'multi';
        userMessage = userMessage.substring(1).trim();
        console.log('🧠 MULTI-AI MODE erzwungen');
        conversationManager.incrementMultiForced?.();
    }

    await chat.sendStateTyping();

    try {
        let hasImage = false;
        let imageText = '';
        let imageBuffer = null;

        if (message.hasMedia) {
            try {
                const media = await message.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    hasImage = true;
                    imageBuffer = Buffer.from(media.data, 'base64');

                    const allowOCR = (userSettings.enableOCR !== false) || ocrKeywordTriggered;
                    if (allowOCR) {
                        console.log('📝 Führe OCR durch...');
                        imageText = await ocrService.performOCR(imageBuffer);
                        conversationManager.incrementOCRProcessed?.();

                        if (imageText.trim()) {
                            userMessage = `[Bild enthält Text: ${imageText}]\n\n${userMessage || 'Was siehst du auf diesem Bild?'}`;
                        }
                    } else {
                        console.log('🚫 OCR deaktiviert für User');
                    }
                }
            } catch (error) {
                console.error('⚠️ Fehler beim Bild-Processing:', error);
            }
        }

        const megaRequested = isMegaRequest(userMessage, keywordRouting.mega);

        if (megaRequested && userSettings.enableMega !== false) {
            await handleMegaRequest(chat, message, userMessage);
            return;
        } else if (megaRequested && userSettings.enableMega === false) {
            console.log('🚫 MEGA deaktiviert für User');
        }

        conversationManager.addMessage(chatId, 'user', userMessage);

        const presentationIntent = detectPresentationIntent(userMessage);
        if (presentationIntent) {
            await handlePresentationForWhatsApp({
                chat,
                chatId,
                userMessage,
                format: presentationIntent.format,
                topic: presentationIntent.topic
            });
            return;
        }

        const isSchoolTopic = isSchoolRelated(userMessage);
        const history = conversationManager.getHistory(chatId);

        let finalForceMode = forceMode;
        if (userSettings.enableMultiAI === false && forceMode !== 'multi') {
            finalForceMode = 'simple';
            console.log('🛑 Multi-AI deaktiviert für User - nutze Simple Mode');
        }

        const ocrTextForMultiAI = (hasImage && imageText) ? imageText : null;

        const response = await multiAI.generateResponse(
            userMessage,
            history,
            isSchoolTopic,
            hasImage ? imageBuffer : null,
            finalForceMode,
            ocrTextForMultiAI,
            userSettings
        );

        conversationManager.addMessage(chatId, 'assistant', response);

        await chat.clearState();

        if (response.length > 4000) {
            const chunks = splitMessage(response, 4000);
            for (const chunk of chunks) {
                await message.reply(chunk);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            await message.reply(response);
        }
    } catch (error) {
        console.error('❌ Fehler:', error);
        await chat.clearState();
        await message.reply('❌ Ein Fehler ist aufgetreten. Versuche es bitte nochmal.');
    }
}
function isMegaRequest(text, extraKeywords = []) {
    const lowerText = text.toLowerCase();
    if (containsKeyword(lowerText, extraKeywords)) {
        return true;
    }
    return (
        (lowerText.includes('mega') || lowerText.includes('cloud') || lowerText.includes('datei')) &&
        (lowerText.includes('buch') || lowerText.includes('seite') || lowerText.includes('lösung'))
    ) || (
        lowerText.match(/(?:deutsch|mathe|english|französisch|latein|physik|chemie|geschichte|religion|ethik).*seite.*\d+/i)
    );
}

async function handleMegaRequest(chat, message, text) {
    await chat.sendStateTyping();
    conversationManager.incrementMegaRequests?.();

    try {
        const match = text.match(/(deutsch|mathe|english|französisch|latein|physik|chemie|geschichte|religion|ethik).*?seite.*?(\d+)/i);

        if (!match) {
            await chat.clearState();
            await message.reply('❗ Ich konnte kein Fach oder keine Seitenzahl erkennen. Beispiel: "Gib mir das English Buch Seite 17"');
            return;
        }

        const fach = match[1].toLowerCase();
        const seite = match[2];

        console.log(`📚 MEGA-Anfrage: ${fach} Seite ${seite}`);

        await megaService.connect();
        const file = await megaService.findFile(fach, seite);
        const buffer = await file.downloadBuffer();

        const media = new MessageMedia(
            'image/jpeg',
            buffer.toString('base64'),
            `${fach}_seite_${seite}.jpg`
        );

        await chat.clearState();
        await message.reply(media, undefined, { caption: `📄 ${fach.charAt(0).toUpperCase() + fach.slice(1)} - Seite ${seite}` });

        console.log('🔍 Analysiere Seite...');
        const pageText = await ocrService.performOCR(buffer);
        conversationManager.incrementOCRProcessed?.();

        if (pageText.trim()) {
            const solution = await aiService.generateSolution(fach, seite, pageText);

            if (solution.length > 4000) {
                const chunks = splitMessage(solution, 4000);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await message.reply(solution);
            }
        }
    } catch (error) {
        console.error('⚠️ MEGA-Fehler:', error);
        await chat.clearState();
        await message.reply(`⚠️ Fehler beim Abrufen der Datei: ${error.message}`);
    }
}

async function handlePresentationForWhatsApp({ chat, chatId, userMessage, format, topic }) {
    await chat.sendStateTyping();
    try {
        const result = await presentationService.createPresentation({
            requestText: userMessage,
            topic,
            preferredFormat: format,
            requestedBy: chatId,
            language: DEFAULT_PRESENTATION_LANGUAGE
        });

        const messageText = buildPresentationMessage(result, { markdown: false });
        await chat.sendMessage(messageText);
        conversationManager.addMessage(chatId, 'assistant', messageText);

        for (const file of Object.values(result.files || {})) {
            if (!file || !file.buffer) continue;
            const media = new MessageMedia(file.mimeType, file.buffer.toString('base64'), file.filename);
            await chat.sendMessage(media);
            delete file.buffer;
        }
    } catch (error) {
        console.error('⚠️ Präsentationsfehler (WhatsApp):', error);
        const failMessage = '⚠️ Die Präsentation konnte nicht erstellt werden. Bitte versuche es später erneut.';
        await chat.sendMessage(failMessage);
        conversationManager.addMessage(chatId, 'assistant', failMessage);
    } finally {
        await chat.clearState();
    }
}

function isSchoolRelated(text) {
    const schoolKeywords = [
        'hausaufgaben', 'aufgabe', 'übung', 'lernen', 'schule', 'test', 'klassenarbeit', 'prüfung', 'klausur',
        'mathe', 'deutsch', 'english', 'französisch', 'latein', 'physik', 'chemie', 'biologie', 'geschichte', 'erdkunde',
        'religion', 'ethik', 'formel', 'gleichung', 'lösung', 'seite', 'buch', 'arbeitsblatt', 'vokabeln', 'grammatik'
    ];

    const lowerText = text.toLowerCase();
    return schoolKeywords.some(keyword => lowerText.includes(keyword));
}

function splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';

    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = line + '\n';
        } else {
            currentChunk += line + '\n';
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

function formatBytes(bytes = 0) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    const display = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${display} ${units[unitIndex]}`;
}

function buildPublicUrl(meta = {}) {
    if (!meta.url) return '';
    if (!PUBLIC_BASE_URL) return meta.url;
    try {
        return new URL(meta.url, PUBLIC_BASE_URL).toString();
    } catch (error) {
        console.error('⚠️ Konnte öffentliche URL nicht aufbauen:', error.message);
        return meta.url;
    }
}

function sanitizePresentationFiles(files = {}) {
    const entries = Object.entries(files).map(([key, file]) => {
        if (!file) return null;
        const { filename, url, mimeType, size } = file;
        return [key, {
            filename,
            url,
            publicUrl: buildPublicUrl(file),
            mimeType,
            size
        }];
    }).filter(Boolean);
    return Object.fromEntries(entries);
}

function buildPresentationMessage(result, { markdown = true } = {}) {
    const lines = [];
    if (result.textualSummary) {
        lines.push(result.textualSummary);
    } else if (result.summary) {
        lines.push(`🎞️ Präsentation **${result.title}** ist fertig.`);
        lines.push(result.summary);
    }

    const fileEntries = Object.values(result.files || {});
    if (fileEntries.length) {
        lines.push('');
        lines.push(markdown ? '📎 **Downloads**:' : '📎 Downloads:');
        fileEntries.forEach((file) => {
            const link = buildPublicUrl(file);
            const sizeLabel = formatBytes(file.size);
            if (markdown) {
                lines.push(`- [${file.filename}](${link}) · ${sizeLabel}`);
            } else {
                lines.push(`- ${file.filename} (${sizeLabel}): ${link}`);
            }
        });
    }

    return lines.join('\n').trim();
}

function buildMaterialResponse(material) {
    if (!material) return null;
    const relativePath = material.file_path?.startsWith('/')
        ? material.file_path
        : `/${material.file_path || ''}`;
    const profile = material.profile || null;
    return {
        id: material.id,
        title: material.title,
        description: material.description,
        subject: material.subject,
        fileName: material.file_name,
        fileType: material.file_type,
        filePath: relativePath,
        fileUrl: buildPublicUrl({ url: relativePath }),
        createdAt: material.created_at,
        uploader: {
            userId: material.user_id,
            username: material.username,
            phone: material.phone,
            profile
        }
    };
}

function saveUploadedBuffer(buffer, targetDir, originalName = 'file.bin') {
    const safeName = (originalName || 'file.bin').replace(/[^\w.\-]/g, '_');
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${safeName}`;
    const filePath = path.join(targetDir, unique);
    fs.writeFileSync(filePath, buffer);
    return unique;
}

function toPublicUploadPath(subPath) {
    return `/uploads/${subPath}`.replace(/\\/g, '/').replace('//', '/');
}

function deleteUploadedFile(relativePath) {
    if (!relativePath) return;
    const normalized = relativePath.startsWith('/')
        ? relativePath.slice(1)
        : relativePath;
    const targetPath = path.join(publicDir, normalized);
    if (!targetPath.startsWith(publicDir)) return;
    if (fs.existsSync(targetPath)) {
        try {
            fs.unlinkSync(targetPath);
        } catch (error) {
            console.error('⚠️ Konnte Datei nicht löschen:', error.message);
        }
    }
}

function applyAliases(text, aliases = []) {
    if (!text || !Array.isArray(aliases) || aliases.length === 0) {
        return text;
    }
    const trimmed = text.trim();
    for (const alias of aliases) {
        if (!alias || !alias.shortcut || !alias.prompt) continue;
        const shortcut = alias.shortcut.trim();
        if (!shortcut) continue;
        if (trimmed.toLowerCase().startsWith(shortcut.toLowerCase())) {
            const remainder = trimmed.slice(shortcut.length).trim();
            return `${alias.prompt.trim()}${remainder ? ` ${remainder}` : ''}`;
        }
    }
    return text;
}

function containsKeyword(text, keywords = []) {
    if (!text || !Array.isArray(keywords) || keywords.length === 0) {
        return false;
    }
    const lower = text.toLowerCase();
    return keywords.some(keyword => {
        if (!keyword) return false;
        return lower.includes(keyword.toLowerCase());
    });
}
app.get('/', (req, res) => {
    res.json({
        status: '🤖 WhatsApp Hausaufgaben Bot läuft',
        ready: isReady,
        uptime: process.uptime(),
        version: '1.0.0',
        platform: os.platform(),
        node: process.version
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        whatsapp: isReady ? 'connected' : 'disconnected',
        memory: process.memoryUsage(),
        stats: conversationManager.getStats()
    });
});

app.get('/qr', async (req, res) => {
    if (!currentQR) {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        h1 { color: #25D366; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 WhatsApp QR Code</h1>
        <p>Kein QR Code verfügbar - Bot ist bereits verbunden oder wird initialisiert.</p>
        <p>Status: ${isReady ? '✅ Verbunden' : '⏳ Initialisiere...'}</p>
        <script>setTimeout(() => location.reload(), 5000);</script>
    </div>
</body>
</html>
        `);
        return;
    }

    const QRCode = await import('qrcode');
    const qrDataURL = await QRCode.toDataURL(currentQR, { width: 256 });

    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .qr { margin: 20px 0; }
        .timer { color: #dc3545; font-weight: bold; margin: 20px 0; }
        h1 { color: #25D366; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 WhatsApp QR Code</h1>
        <div class="qr">
            <img src="${qrDataURL}" alt="QR Code" style="max-width: 100%;">
        </div>
        <div class="timer">⏳ Code läuft in <span id="countdown">60</span>s ab</div>
        <ol style="text-align: left;">
            <li>WhatsApp öffnen</li>
            <li>Menü → "Verknüpfte Geräte"</li>
            <li>"Gerät verknüpfen"</li>
            <li>QR Code scannen</li>
        </ol>
    </div>
    <script>
        let countdown = 60;
        setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown;
            if (countdown <= 0) location.reload();
        }, 1000);
    </script>
</body>
</html>
    `);
});
app.get('/api/stats', (req, res) => {
    const stats = conversationManager.getStats();
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
        whatsapp: {
            connected: isReady,
            ready: isReady
        },
        conversation: stats,
        system: {
            uptime: process.uptime(),
            platform: process.platform,
            nodeVersion: process.version,
            memory: {
                used: Math.round(mem.heapUsed / 1024 / 1024),
                total: Math.round(mem.heapTotal / 1024 / 1024),
                rss: Math.round(mem.rss / 1024 / 1024),
                external: Math.round(mem.external / 1024 / 1024)
            },
            cpu: {
                user: Math.round(cpuUsage.user / 1000),
                system: Math.round(cpuUsage.system / 1000)
            }
        },
        ai: {
            totalKeys: aiService.apiKeys.length,
            currentKeyIndex: aiService.currentKeyIndex,
            currentModel: aiService.getActiveModel(),
            usingFallback: aiService.usingFallback,
            quotaExceededCount: aiService.quotaExceededCount,
            hoursUntilReset: aiService.getTimeUntilResetHours()
        },
        multiAI: multiAI.getStats(),
        spam: {
            maxLimit: maxSpamLimit
        }
    });
});

app.post('/api/spam/limit', express.json(), (req, res) => {
    const { limit } = req.body;

    if (!limit || isNaN(limit)) {
        return res.status(400).json({ error: 'Ungültiges Limit' });
    }

    const newLimit = parseInt(limit, 10);

    if (newLimit < 1 || newLimit > 100000) {
        return res.status(400).json({ error: 'Limit muss zwischen 1 und 100.000 liegen' });
    }

    maxSpamLimit = newLimit;
    console.log(`✅ Spam Limit geändert: ${maxSpamLimit}`);

    res.json({
        success: true,
        maxLimit: maxSpamLimit,
        message: `Spam Limit auf ${maxSpamLimit} gesetzt`
    });
});

app.post('/api/generate-image', requireAuth, async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, model = 'flux' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt erforderlich' });
        }

        console.log(`🎨 Generiere Bild mit Pollinations.ai: "${prompt}" (${width}x${height}, ${model})`);

        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=${width}&height=${height}&nologo=true&enhance=true`;

        res.json({
            success: true,
            imageUrl,
            revisedPrompt: prompt,
            model,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Pollinations Fehler:', error);
        res.status(500).json({
            error: 'Bildgenerierung fehlgeschlagen',
            message: error.message
        });
    }
});

app.post('/api/voice-to-text', requireAuth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio-Datei erforderlich' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'Groq API Key nicht konfiguriert' });
        }

        console.log('🎙️ Transkribiere Audio...');

        const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.webm`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        let transcription;
        try {
            transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-large-v3-turbo',
                language: 'de',
                response_format: 'json'
            });
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

        res.json({
            success: true,
            text: transcription.text,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Whisper Fehler:', error);
        res.status(500).json({
            error: 'Transkription fehlgeschlagen',
            message: error.message
        });
    }
});

app.post('/api/presentations', requireAuth, async (req, res) => {
    try {
        const { topic = '', instructions = '', format = 'pptx', slides = DEFAULT_PRESENTATION_SLIDES } = req.body || {};
        if (!topic && !instructions) {
            return res.status(400).json({ error: 'Bitte Thema oder Beschreibung angeben' });
        }
        const result = await presentationService.createPresentation({
            requestText: instructions || topic,
            topic,
            preferredFormat: format,
            requestedBy: req.session.username,
            language: DEFAULT_PRESENTATION_LANGUAGE,
            slidesCount: parseInt(slides, 10) || DEFAULT_PRESENTATION_SLIDES
        });
        Object.values(result.files || {}).forEach(file => {
            if (file) delete file.buffer;
        });
        res.json({
            success: true,
            presentation: {
                title: result.title,
                summary: result.summary,
                tone: result.tone,
                slides: result.slides,
                files: sanitizePresentationFiles(result.files),
                textualSummary: result.textualSummary
            }
        });
    } catch (error) {
        console.error('⚠️ Präsentations-API Fehler:', error);
        res.status(500).json({ error: 'Präsentation konnte nicht erstellt werden', message: error.message });
    }
});
function requireAuth(req, res, next) {
    const sessionId = req.headers['x-session-id'];
    const session = authService.validateSession(sessionId);

    if (!session) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    req.session = session;
    next();
}

function requireAdmin(req, res, next) {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin-Rechte erforderlich' });
    }
    next();
}
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, phone, religion, secondLanguage } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen enthalten' });
        }
        if (!religion || !['evangelisch', 'katholisch', 'ethik'].includes(religion)) {
            return res.status(400).json({ error: 'Bitte wähle eine Religion: evangelisch, katholisch oder ethik' });
        }
        if (!secondLanguage || !['französisch', 'latein'].includes(secondLanguage)) {
            return res.status(400).json({ error: 'Bitte wähle eine 2. Sprache: französisch oder latein' });
        }

        const result = userManager.createUser(username.trim(), password, phone?.trim() || null, 'self-service', religion, secondLanguage);

        if (!result.success) {
            return res.status(400).json({ error: result.message || 'Registrierung fehlgeschlagen' });
        }

        const sessionId = authService.createSession(result.user.username, 'user', result.user.userId);
        res.json({
            success: true,
            sessionId,
            user: result.user
        });
    } catch (error) {
        console.error('⚠️ Registrierung fehlgeschlagen:', error);
        res.status(500).json({ error: 'Registrierung aktuell nicht möglich' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    console.log(`🔐 Login-Versuch für: ${username}`);

    const adminLogin = userManager.loginAdmin(username, password);
    if (adminLogin.success) {
        console.log(`✅ Admin-Login erfolgreich für: ${username}`);
        const sessionId = authService.createSession(adminLogin.user.username, 'admin');
        return res.json({
            success: true,
            sessionId,
            user: adminLogin.user
        });
    }

    const userLogin = userManager.loginUser(username, password);
    if (userLogin.success) {
        console.log(`✅ User-Login erfolgreich für: ${username}`);
        const sessionId = authService.createSession(userLogin.user.username, 'user', userLogin.user.userId);
        return res.json({
            success: true,
            sessionId,
            user: userLogin.user
        });
    }

    console.log(`❌ Login fehlgeschlagen für: ${username}`);
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
});

app.post('/api/logout', requireAuth, (req, res) => {
    const sessionId = req.headers['x-session-id'];
    authService.destroySession(sessionId);
    res.json({ success: true, message: 'Erfolgreich abgemeldet' });
});

app.get('/api/session', requireAuth, (req, res) => {
    const user = userManager.getUserById(req.session.userId);
    res.json({
        success: true,
        user: {
            username: req.session.username,
            role: req.session.role,
            userId: req.session.userId,
            religion: user?.religion || null,
            secondLanguage: user?.secondLanguage || null
        }
    });
});
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const users = userManager.getAllUsers();
    res.json({ success: true, users });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
    const { username, password, phone } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username und Passwort erforderlich' });
    }

    const result = userManager.createUser(username, password, phone || null, req.session.username);

    if (!result.success) {
        return res.status(400).json(result);
    }

    res.json(result);
});

app.delete('/api/users/:userId', requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const result = userManager.deleteUser(userId);

    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json(result);
});

app.put('/api/users/:userId/password', requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ error: 'Neues Passwort erforderlich' });
    }

    const result = userManager.updateUserPassword(userId, newPassword);

    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json(result);
});

app.put('/api/users/:userId/settings', requireAuth, (req, res) => {
    const { userId } = req.params;

    if (req.session.role !== 'admin' && req.session.userId !== userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { settings } = req.body;

    if (!settings) {
        return res.status(400).json({ error: 'Einstellungen erforderlich' });
    }

    const result = userManager.updateUserSettings(userId, settings);

    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json(result);
});

app.post('/api/users/:userId/reset-prompt', requireAuth, (req, res) => {
    const { userId } = req.params;

    if (req.session.role !== 'admin' && req.session.userId !== userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const result = userManager.resetPrompt(userId);

    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json(result);
});

app.get('/api/users/:userId/settings', requireAuth, (req, res) => {
    const { userId } = req.params;

    if (req.session.role !== 'admin' && req.session.userId !== userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const user = userManager.getUserById(userId);

    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
        success: true,
        username: user.username,
        phone: user.phone,
        settings: user.settings
    });
});

app.get('/api/users/:userId', requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const user = userManager.getUserById(userId);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    res.json({
        success: true,
        user
    });
});

app.get('/api/users/:userId/stats', requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.params;
    const user = userManager.getUserById(userId);

    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const dashChatId = `dashboard_${user.username}`;
    const history = conversationManager.getHistory(dashChatId, 1000);
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    const lastOnline = lastMessage ? lastMessage.timestamp : user.createdAt;

    res.json({
        success: true,
        stats: {
            username: user.username,
            phone: user.phone,
            customPrompt: user.settings.customPrompt || 'Standard-Prompt',
            lastOnline,
            totalMessages: history.length,
            createdAt: user.createdAt
        }
    });
});

app.get('/api/users-with-stats', requireAuth, requireAdmin, (req, res) => {
    const users = userManager.getAllUsers();

    const usersWithStats = users.map(user => {
        const chatId = `dashboard_${user.username}`;
        const history = conversationManager.getHistory(chatId, 1000);
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        const lastOnline = lastMessage ? lastMessage.timestamp : user.createdAt;

        return {
            userId: user.userId,
            username: user.username,
            phone: user.phone,
            customPrompt: user.settings.customPrompt || 'Standard',
            lastOnline,
            totalMessages: history.length,
            createdAt: user.createdAt,
            settings: user.settings
        };
    });

    res.json({ success: true, users: usersWithStats });
});

app.get('/api/homework', requireAuth, (req, res) => {
    const homework = db.getHomework(200).map(item => ({
        ...item,
        profile: userManager.getUserProfile(item.user_id)
    }));
    res.json({ success: true, homework });
});

app.post('/api/homework', requireAuth, (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Nur verifizierte Benutzer können Hausaufgaben hinzufügen' });
    }
    const { subject = '', description = '', dueDate = null } = req.body || {};
    if (!subject.trim() || !description.trim()) {
        return res.status(400).json({ error: 'Fach und Beschreibung erforderlich' });
    }

    const result = db.upsertHomework(userId, subject, description, dueDate);
    if (!result.success) {
        return res.status(400).json(result);
    }

    const homework = db.getHomework(200).map(item => ({
        ...item,
        profile: userManager.getUserProfile(item.user_id)
    }));
    res.json({ success: true, homework, status: result });
});

app.put('/api/homework/:id/status', requireAuth, (req, res) => {
    const homeworkId = parseInt(req.params.id, 10);
    if (Number.isNaN(homeworkId)) {
        return res.status(400).json({ error: 'Ungültige ID' });
    }

    const entry = db.getHomeworkById(homeworkId);
    if (!entry) {
        return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    if (req.session.role !== 'admin' && entry.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { completed, needsHelp } = req.body || {};
    const result = db.updateHomeworkStatus(homeworkId, completed, needsHelp);
    
    if (!result.success) {
        return res.status(400).json(result);
    }

    const homework = db.getHomework(200).map(item => ({
        ...item,
        profile: userManager.getUserProfile(item.user_id)
    }));

    res.json({ success: true, homework });
});

app.delete('/api/homework/:id', requireAuth, (req, res) => {
    const entryId = parseInt(req.params.id, 10);
    if (Number.isNaN(entryId)) {
        return res.status(400).json({ error: 'Ungültige ID' });
    }

    const entry = db.getHomeworkById(entryId);
    if (!entry) {
        return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    if (req.session.role !== 'admin' && entry.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung zum Löschen' });
    }

    const deleted = db.deleteHomework(entryId);
    if (!deleted) {
        return res.status(500).json({ error: 'Eintrag konnte nicht gelöscht werden' });
    }

    const homework = db.getHomework(200).map(item => ({
        ...item,
        profile: userManager.getUserProfile(item.user_id)
    }));

    res.json({ success: true, homework });
});

app.get('/api/curriculum', requireAuth, (req, res) => {
    const stateParam = (req.query.state || '').toString().toUpperCase();
    const gradeParam = (req.query.grade || '').toString();

    const basePayload = {
        states: availableStates,
        grades: gradeLevels,
        stateGradeMap: getStateGradeMap()
    };

    if (!stateParam || !gradeParam) {
        return res.json({
            success: true,
            ...basePayload
        });
    }

    const entry = getCurriculumEntry(stateParam, gradeParam);

    if (!entry) {
        return res.status(404).json({
            success: false,
            error: 'Keine Themen für diese Auswahl gefunden',
            ...basePayload
        });
    }

    res.json({
        success: true,
        ...basePayload,
        ...entry
    });
});

app.get('/api/materials', requireAuth, (req, res) => {
    const materials = db.getMaterials(100).map(item =>
        buildMaterialResponse({
            ...item,
            profile: userManager.getUserProfile(item.user_id)
        })
    );
    res.json({ success: true, materials });
});

app.get('/api/materials/:id', requireAuth, (req, res) => {
    const material = db.getMaterialById(req.params.id);
    if (!material) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
    }
    res.json({
        success: true,
        material: buildMaterialResponse({
            ...material,
            profile: userManager.getUserProfile(material.user_id)
        })
    });
});

app.post('/api/materials', requireAuth, upload.single('file'), async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Nur verifizierte Benutzer können Material hochladen' });
    }

    const { title = '', description = '', subject = '' } = req.body || {};
    if (!title.trim()) {
        return res.status(400).json({ error: 'Titel erforderlich' });
    }
    
    let relativePath = null;
    let fileType = null;
    let fileName = null;
    
    if (req.file) {
        const storedName = saveUploadedBuffer(req.file.buffer, materialsUploadDir, req.file.originalname || 'material.bin');
        relativePath = toPublicUploadPath(path.join('materials', storedName));
        fileType = req.file.mimetype;
        fileName = req.file.originalname || storedName;
    }

    const id = db.createMaterial({
        userId,
        title,
        description,
        subject,
        filePath: relativePath,
        fileType: fileType,
        fileName: fileName
    });

    const material = db.getMaterialById(id);
    res.json({
        success: true,
        material: buildMaterialResponse({
            ...material,
            profile: userManager.getUserProfile(material.user_id)
        })
    });
});

app.delete('/api/materials/:id', requireAuth, (req, res) => {
    const materialId = parseInt(req.params.id, 10);
    if (Number.isNaN(materialId)) {
        return res.status(400).json({ error: 'Ungültige ID' });
    }

    const material = db.getMaterialById(materialId);
    if (!material) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
    }

    if (req.session.role !== 'admin' && material.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Keine Berechtigung zum Löschen' });
    }

    const deleted = db.deleteMaterial(materialId);
    if (!deleted) {
        return res.status(500).json({ error: 'Material konnte nicht gelöscht werden' });
    }

    deleteUploadedFile(material.file_path);

    const materials = db.getMaterials(100).map(item =>
        buildMaterialResponse({
            ...item,
            profile: userManager.getUserProfile(item.user_id)
        })
    );

    res.json({ success: true, materials });
});

app.get('/api/profile', requireAuth, (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Kein Benutzerprofil vorhanden' });
    }
    const profile = userManager.getUserProfile(userId);
    res.json({ success: true, profile });
});

// ========== WEBUNTIS API ==========

app.post('/api/webuntis/connect', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(400).json({ error: 'Nicht authentifiziert' });
        }

        const { server, school, username, password } = req.body;
        
        if (!server || !school || !username || !password) {
            return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
        }

        // Verschlüssele Passwort (einfache Base64-Verschlüsselung - in Produktion sollte man bcrypt verwenden)
        const passwordEncrypted = Buffer.from(password).toString('base64');
        
        db.saveWebuntisCredentials(userId, server, school, username, passwordEncrypted);
        
        console.log(`✅ Webuntis-Verbindung gespeichert für User: ${req.session.username}`);
        
        res.json({ 
            success: true, 
            message: 'Webuntis-Verbindung erfolgreich gespeichert',
            username: username
        });
    } catch (error) {
        console.error('⚠️ Webuntis-Verbindungsfehler:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Verbindung' });
    }
});

app.get('/api/webuntis/status', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(400).json({ error: 'Nicht authentifiziert' });
        }

        const credentials = db.getWebuntisCredentials(userId);
        
        if (credentials) {
            res.json({ 
                success: true, 
                connected: true,
                username: credentials.username,
                server: credentials.server,
                school: credentials.school
            });
        } else {
            res.json({ 
                success: true, 
                connected: false 
            });
        }
    } catch (error) {
        console.error('⚠️ Webuntis-Status-Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen des Status' });
    }
});

app.delete('/api/webuntis/disconnect', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(400).json({ error: 'Nicht authentifiziert' });
        }

        db.deleteWebuntisCredentials(userId);
        
        console.log(`✅ Webuntis-Verbindung getrennt für User: ${req.session.username}`);
        
        res.json({ 
            success: true, 
            message: 'Webuntis-Verbindung erfolgreich getrennt' 
        });
    } catch (error) {
        console.error('⚠️ Webuntis-Trennungsfehler:', error);
        res.status(500).json({ error: 'Fehler beim Trennen der Verbindung' });
    }
});

// ========== ADMIN ANNOUNCEMENT API ==========

app.post('/api/admin/announcement', requireAuth, requireAdmin, (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Nachricht erforderlich' });
        }

        db.setAdminAnnouncement(message.trim(), req.session.username);
        
        console.log(`📢 Admin-Nachricht gesetzt von: ${req.session.username}`);
        
        res.json({ 
            success: true, 
            message: 'Admin-Nachricht erfolgreich gesetzt' 
        });
    } catch (error) {
        console.error('⚠️ Admin-Nachricht-Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Setzen der Nachricht' });
    }
});

app.get('/api/admin/announcement', requireAuth, (req, res) => {
    try {
        const announcement = db.getActiveAdminAnnouncement();
        
        res.json({ 
            success: true, 
            announcement: announcement || null 
        });
    } catch (error) {
        console.error('⚠️ Admin-Nachricht-Abruf-Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Nachricht' });
    }
});

app.delete('/api/admin/announcement', requireAuth, requireAdmin, (req, res) => {
    try {
        db.clearAdminAnnouncement();
        
        console.log(`📢 Admin-Nachricht gelöscht von: ${req.session.username}`);
        
        res.json({ 
            success: true, 
            message: 'Admin-Nachricht erfolgreich gelöscht' 
        });
    } catch (error) {
        console.error('⚠️ Admin-Nachricht-Lösch-Fehler:', error);
        res.status(500).json({ error: 'Fehler beim Löschen der Nachricht' });
    }
});

app.put('/api/profile', requireAuth, (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Kein Benutzerprofil vorhanden' });
    }
    const { displayName = '', bio = '' } = req.body || {};
    const result = userManager.updateUserProfile(userId, { displayName, bio });
    if (!result.success) {
        return res.status(400).json(result);
    }
    res.json({ success: true, profile: result.profile });
});

app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(400).json({ error: 'Kein Benutzerprofil vorhanden' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'Avatar-Datei erforderlich' });
    }

    const storedName = saveUploadedBuffer(req.file.buffer, avatarsUploadDir, req.file.originalname || 'avatar.png');
    const relativePath = toPublicUploadPath(path.join('avatars', storedName));
    const result = userManager.updateUserProfile(userId, { avatarUrl: relativePath });
    if (!result.success) {
        return res.status(400).json(result);
    }
    res.json({
        success: true,
        profile: result.profile,
        avatarUrl: buildPublicUrl({ url: relativePath })
    });
});
app.post('/api/chat', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const {
            message,
            chatId,
            model = 'auto',
            useMultiAI = null
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Nachricht erforderlich' });
        }
        
        // Verarbeite hochgeladene Bilder
        let imageBuffer = null;
        if (req.files && req.files.length > 0) {
            // Nimm das erste Bild
            const imageFile = req.files.find(f => f.mimetype.startsWith('image/'));
            if (imageFile) {
                imageBuffer = imageFile.buffer;
                console.log(`🖼️ Bild empfangen: ${imageFile.originalname} (${imageFile.size} bytes)`);
            }
        }

        const finalChatId = chatId || `dashboard_${req.session.username}`;

        let userSettings = {};
        if (req.session.role === 'user' && req.session.userId) {
            userSettings = userManager.getUserSettings(req.session.userId);
        }

        const history = conversationManager.getHistory(finalChatId, 50);
        // WICHTIG: User-Nachricht wird erst NACH erfolgreicher Verarbeitung hinzugefügt
        // Die Nachricht wird NICHT im Frontend oder Backend vor dem Senden hinzugefügt
        
        // Check if user wants a MEGA page (e.g., "gib mir english seite 27" or "mathe seite 12")
        const megaPageRequest = /(gib|zeig|hol|get|show|give).*(deutsch|mathe|english|französisch|latein|physik|chemie|geschichte|religion|ethik).*?seite.*?(\d+)/i.test(message) ||
                                /(deutsch|mathe|english|französisch|latein|physik|chemie|geschichte|religion|ethik).*?seite.*?(\d+)/i.test(message);
        const megaPageMatch = message.match(/(deutsch|mathe|english|französisch|latein|physik|chemie|geschichte|religion|ethik).*?seite.*?(\d+)/i);
        
        if (megaPageRequest && megaPageMatch) {
            try {
                const fach = megaPageMatch[1].toLowerCase();
                const seite = megaPageMatch[2];
                
                console.log(`📚 MEGA-Seitenanfrage: ${fach} Seite ${seite}`);
                
                await megaService.connect();
                const file = await megaService.findFile(fach, seite);
                const buffer = await file.downloadBuffer();
                
                // Convert to base64 for sending as data URL
                const base64Image = buffer.toString('base64');
                const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
                
                console.log('✅ Seite gefunden und geladen');
                const fachCapitalized = fach.charAt(0).toUpperCase() + fach.slice(1);
                const responseMsg = `📄 **${fachCapitalized} - Seite ${seite}**\n\n<img src="${imageDataUrl}" alt="Seite ${seite}" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 12px;" />`;
                conversationManager.addMessage(finalChatId, 'assistant', responseMsg);
                return res.json({
                    success: true,
                    response: responseMsg,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('⚠️ MEGA-Seitenfehler:', error);
                const errorMsg = `⚠️ Die Seite konnte nicht geladen werden: ${error.message}`;
                conversationManager.addMessage(finalChatId, 'assistant', errorMsg);
                return res.status(500).json({ error: errorMsg });
            }
        }
        
        // Check if user wants to solve a MEGA page
        const solveRequest = /(löse|solve|bearbeite|mach|hilf).*(seite|page|aufgabe|task)/i.test(message);
        
        if (solveRequest && megaPageMatch) {
            try {
                const fach = megaPageMatch[1].toLowerCase();
                const seite = megaPageMatch[2];
                
                console.log(`📚 MEGA-Lösungsanfrage: ${fach} Seite ${seite}`);
                
                await megaService.connect();
                const file = await megaService.findFile(fach, seite);
                const buffer = await file.downloadBuffer();
                
                console.log('🔍 Analysiere Seite mit OCR...');
                const pageText = await ocrService.performOCR(buffer);
                
                if (pageText.trim()) {
                    const solution = await aiService.generateSolution(fach, seite, pageText);
                    conversationManager.addMessage(finalChatId, 'assistant', solution);
                    return res.json({
                        success: true,
                        response: solution,
                        timestamp: Date.now()
                    });
                } else {
                    throw new Error('OCR konnte keinen Text erkennen');
                }
            } catch (error) {
                console.error('⚠️ MEGA-Lösungsfehler:', error);
                const errorMsg = `⚠️ Die Seite konnte nicht gelöst werden: ${error.message}`;
                conversationManager.addMessage(finalChatId, 'assistant', errorMsg);
                return res.status(500).json({ error: errorMsg });
            }
        }
        
        const presentationIntent = detectPresentationIntent(message);
        if (presentationIntent) {
            try {
                const presentation = await presentationService.createPresentation({
                    requestText: message,
                    topic: presentationIntent.topic,
                    preferredFormat: presentationIntent.format,
                    requestedBy: req.session.username,
                    language: DEFAULT_PRESENTATION_LANGUAGE
                });
                const markdownMessage = buildPresentationMessage(presentation, { markdown: true });
                Object.values(presentation.files || {}).forEach(file => {
                    if (file) delete file.buffer;
                });
                conversationManager.addMessage(finalChatId, 'assistant', markdownMessage);
                return res.json({
                    success: true,
                    response: markdownMessage,
                    attachments: sanitizePresentationFiles(presentation.files),
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('⚠️ Dashboard Präsentationsfehler:', error);
                const failMessage = '⚠️ Die Präsentation konnte nicht erstellt werden. Bitte versuche es später erneut.';
                conversationManager.addMessage(finalChatId, 'assistant', failMessage);
                return res.status(500).json({ error: failMessage });
            }
        }

        const isSchoolTopic = isSchoolRelated(message);

        let response;

        // OCR für Bilder durchführen (optional)
        let ocrText = null;
        if (imageBuffer) {
            try {
                ocrText = await ocrService.performOCR(imageBuffer);
                if (ocrText && ocrText.trim()) {
                    console.log('📝 OCR-Text extrahiert:', ocrText.substring(0, 100) + '...');
                }
            } catch (error) {
                console.error('⚠️ OCR-Fehler:', error.message);
            }
        }

        if (model && model !== 'auto') {
            response = await multiAI.generateSingleModelResponse(model, {
                userMessage: message,
                history,
                isSchoolTopic,
                imageBuffer: imageBuffer,
                ocrText: ocrText,
                userSettings
            });
        } else {
            let forceMode = null;
            if (typeof useMultiAI === 'boolean') {
                forceMode = useMultiAI ? 'multi' : 'simple';
            }

            response = await multiAI.generateResponse(
                message,
                history,
                isSchoolTopic,
                imageBuffer,
                forceMode,
                ocrText,
                userSettings
            );
        }

        // WICHTIG: Beide Nachrichten werden erst NACH erfolgreicher Verarbeitung gespeichert
        conversationManager.addMessage(finalChatId, 'user', message);
        conversationManager.addMessage(finalChatId, 'assistant', response);

        res.json({
            success: true,
            response,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Dashboard Chat Fehler:', error);
        res.status(500).json({
            error: 'Ein Fehler ist aufgetreten',
            message: error.message
        });
    }
});
app.get('/api/prompts/defaults', requireAuth, (req, res) => {
    const defaults = userManager.getDefaultPrompts();
    res.json({ success: true, prompts: defaults });
});

// Public Chat API
app.get('/api/public-chat', requireAuth, (req, res) => {
    try {
        // Alle Nachrichten anzeigen (öffentlicher Chat für alle)
        const messages = db.getPublicChatMessages(100);
        
        // Füge Profilbilder zu den Nachrichten hinzu
        const messagesWithAvatars = messages.map(msg => {
            const profile = userManager.getUserProfile(msg.user_id);
            return {
                ...msg,
                avatarUrl: profile?.avatarUrl || null
            };
        });
        
        res.json({ success: true, messages: messagesWithAvatars });
    } catch (error) {
        console.error('Public chat load error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
    }
});

app.delete('/api/public-chat/:messageId', requireAuth, (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId, 10);
        if (Number.isNaN(messageId)) {
            return res.status(400).json({ error: 'Ungültige Nachrichten-ID' });
        }

        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        const result = db.deletePublicChatMessage(messageId, userId);
        
        if (!result.success) {
            return res.status(403).json({ error: result.error || 'Löschen fehlgeschlagen' });
        }

        // Alle Nachrichten zurückgeben (öffentlicher Chat für alle) mit Profilbildern
        const messages = db.getPublicChatMessages(100);
        const messagesWithAvatars = messages.map(msg => {
            const profile = userManager.getUserProfile(msg.user_id);
            return {
                ...msg,
                avatarUrl: profile?.avatarUrl || null
            };
        });
        res.json({ success: true, messages: messagesWithAvatars });
    } catch (error) {
        console.error('Public chat delete error:', error);
        res.status(500).json({ error: 'Fehler beim Löschen der Nachricht' });
    }
});

app.post('/api/public-chat', requireAuth, upload.array('files', 5), (req, res) => {
    try {
        const message = req.body.message || '';
        const files = req.files || [];
        
        if (!message.trim() && files.length === 0) {
            return res.status(400).json({ error: 'Nachricht oder Datei erforderlich' });
        }
        
        const userId = req.session.userId;
        const username = req.session.username;
        const timestamp = Date.now();
        
        // Handle file uploads
        let fileUrl = null;
        let fileName = null;
        let fileType = null;
        
        if (files.length > 0) {
            const file = files[0]; // Take first file
            const storedName = saveUploadedBuffer(file.buffer, uploadsDir, file.originalname);
            const relativePath = toPublicUploadPath(storedName);
            fileUrl = buildPublicUrl({ url: relativePath });
            fileName = file.originalname;
            fileType = file.mimetype;
        }
        
        db.addPublicChatMessage({
            userId,
            username,
            message: message.trim(),
            timestamp,
            fileUrl,
            fileName,
            fileType
        });
        
        // Alle Nachrichten zurückgeben (öffentlicher Chat für alle) mit Profilbildern
        const messages = db.getPublicChatMessages(100);
        const messagesWithAvatars = messages.map(msg => {
            const profile = userManager.getUserProfile(msg.user_id);
            return {
                ...msg,
                avatarUrl: profile?.avatarUrl || null
            };
        });
        res.json({ success: true, messages: messagesWithAvatars });
    } catch (error) {
        console.error('Public chat send error:', error);
        res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
    }
});

// OCR API endpoint
app.post('/api/ocr', requireAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Bild erforderlich' });
        }
        
        const text = await ocrService.performOCR(req.file.buffer);
        res.json({ success: true, text });
    } catch (error) {
        console.error('OCR error:', error);
        res.status(500).json({ error: 'Fehler bei der Texterkennung' });
    }
});

app.get('/dashboard', (req, res) => {
    const dashboardPath = fs.existsSync(path.join(publicDir, 'dashboard.html'))
        ? path.join(publicDir, 'dashboard.html')
        : path.join(__dirname, 'dashboard.html');
    res.sendFile(dashboardPath);
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📱 QR Code: http://localhost:${PORT}/qr`);
    console.log(`📡 Ping: http://localhost:${PORT}/ping`);
    console.log('\n💡 TIPP: Nutze UptimeRobot oder cron-job.org um /ping alle 5-30 Min aufzurufen');
    console.log('   Das hält den Bot wach und verhindert Render.com Sleep-Modus!\n');
});

function startKeepAlive() {
    if (!KEEP_ALIVE_URL) return;
    const interval = Math.max(KEEP_ALIVE_INTERVAL, 60000);
    setInterval(async () => {
        try {
            await fetch(KEEP_ALIVE_URL, { method: 'GET' });
            console.log('🫀 Keep-Alive Ping gesendet');
        } catch (error) {
            console.error('⚠️ Keep-Alive fehlgeschlagen:', error.message);
        }
    }, interval);
}

function startDatabaseBackups() {
    if (!Number.isFinite(DB_BACKUP_INTERVAL_MIN) || DB_BACKUP_INTERVAL_MIN <= 0) return;
    const interval = Math.max(DB_BACKUP_INTERVAL_MIN, 5) * 60 * 1000;
    setInterval(() => {
        db.createSnapshot('auto');
    }, interval);
}

initializeWhatsApp();
startKeepAlive();
startDatabaseBackups();

process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    if (whatsappClient) await whatsappClient.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received...');
    if (whatsappClient) await whatsappClient.destroy();
    process.exit(0);
});
