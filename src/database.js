import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '../data');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export class DatabaseService {
    constructor() {
        this.dataDir = BASE_DATA_DIR;
        ensureDir(this.dataDir);

        this.backupDir = path.join(this.dataDir, 'backups');
        ensureDir(this.backupDir);

        this.dbPath = path.join(this.dataDir, 'aeon.db');
        
        // Versuche zuerst lokales Backup wiederherzustellen
        if (!fs.existsSync(this.dbPath)) {
            this.restoreLatestBackup();
        }

        // WICHTIG: Versuche externes Backup BEVOR DB initialisiert wird
        // Dies verhindert, dass leere Tabellen erstellt werden
        this.tryRestoreExternalBackupSync();

        // Initialisiere DB nach der Wiederherstellung
        this.db = new Database(this.dbPath);

        console.log(`🗄️ Database initialisiert: ${this.dbPath}`);

        this.materialsDir = path.join(this.dataDir, 'materials');
        ensureDir(this.materialsDir);

        this.initializeTables();
    }
    
    tryRestoreExternalBackupSync() {
        // Versuche externes Backup synchron wiederherzustellen
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_GIST_ID) {
            return;
        }

        console.log('🔄 Versuche externes Backup von GitHub Gist wiederherzustellen...');
        
        try {
            const gistUrl = `https://api.github.com/gists/${process.env.GITHUB_GIST_ID}`;
            const parsedUrl = new URL(gistUrl);
            
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname,
                method: 'GET',
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Aeon-Backup-Service'
                }
            };
            
            // Blockierender Request mit Promise
            let finished = false;
            let success = false;
            
            const req = https.request(options, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const data = Buffer.concat(chunks).toString();
                            const gist = JSON.parse(data);
                            const backupFile = gist.files['aeon-backup.db'];
                            
                            if (backupFile && backupFile.content) {
                                const dbBuffer = Buffer.from(backupFile.content, 'base64');
                                fs.writeFileSync(this.dbPath, dbBuffer);
                                console.log('📦 Datenbank aus GitHub Gist wiederhergestellt');
                                success = true;
                            }
                        }
                    } catch (err) {
                        console.error('⚠️ GitHub Gist Wiederherstellung fehlgeschlagen:', err.message);
                    }
                    finished = true;
                });
            });
            
            req.on('error', (err) => {
                console.error('⚠️ GitHub Gist Verbindungsfehler:', err.message);
                finished = true;
            });
            
            req.setTimeout(10000, () => {
                req.destroy();
                console.error('⚠️ GitHub Gist Timeout');
                finished = true;
            });
            
            req.end();
            
            // Blockiere bis fertig (max 12 Sekunden)
            const startTime = Date.now();
            const maxWait = 12000;
            while (!finished && (Date.now() - startTime) < maxWait) {
                // Kurze Pause für Event-Loop
                const now = Date.now();
                while (Date.now() - now < 100) {
                    // Busy wait für 100ms
                }
            }
            
            if (success) {
                console.log('✅ Externes Backup erfolgreich wiederhergestellt');
            }
        } catch (err) {
            console.error('⚠️ Externes Backup Wiederherstellung fehlgeschlagen:', err.message);
        }
    }
    
    initializeTables() {
        // Users Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                custom_prompt TEXT,
                spam_limit INTEGER DEFAULT 500,
                react_on_command INTEGER DEFAULT 0,
                command_prefix TEXT DEFAULT '!',
                enable_multi_ai INTEGER DEFAULT 1,
                enable_ocr INTEGER DEFAULT 1,
                enable_mega INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL,
                created_by TEXT,
                extra_settings TEXT
            );
        `);
        this.ensureExtraSettingsColumn();

        // Sessions Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                user_id TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
        `);

        // Conversations Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
        `);

        // Homework Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS homework (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                normalized TEXT UNIQUE NOT NULL,
                created_at INTEGER NOT NULL
            );
        `);

        // Materials Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                subject TEXT,
                file_path TEXT,
                file_type TEXT,
                file_name TEXT,
                created_at INTEGER NOT NULL
            );
        `);

        // Public Chat Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS public_chat (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                message TEXT,
                file_url TEXT,
                file_name TEXT,
                file_type TEXT,
                timestamp INTEGER NOT NULL
            );
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS webuntis_credentials (
                user_id TEXT PRIMARY KEY,
                server TEXT NOT NULL,
                school TEXT NOT NULL,
                username TEXT NOT NULL,
                password_encrypted TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS admin_announcement (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1
            );
        `);

        // Create indexes
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_conversations_chat ON conversations(chat_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
            CREATE INDEX IF NOT EXISTS idx_homework_user ON homework(user_id);
            CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
            CREATE INDEX IF NOT EXISTS idx_materials_created ON materials(created_at DESC);
        `);

        console.log('✅ Database-Tabellen initialisiert');
    }

    restoreLatestBackup() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter((file) => file.endsWith('.db'))
                .sort();
            if (files.length === 0) return;
            const latest = files[files.length - 1];
            const source = path.join(this.backupDir, latest);
            fs.copyFileSync(source, this.dbPath);
            console.log(`📦 Datenbank aus Backup wiederhergestellt: ${latest}`);
        } catch (error) {
            console.error('⚠️ Konnte Backup nicht wiederherstellen:', error.message);
        }
    }

    createSnapshot(label = 'auto') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `aeon-${label}-${timestamp}.db`;
            const target = path.join(this.backupDir, filename);
            fs.copyFileSync(this.dbPath, target);
            this.trimBackups();
            console.log(`💾 Backup erstellt: ${filename}`);
            
            // Automatisch zu externem Service hochladen (im Hintergrund)
            this.uploadToExternalBackup(target).catch(err => {
                console.error('⚠️ Externes Backup fehlgeschlagen:', err.message);
            });
            
            return target;
        } catch (error) {
            console.error('⚠️ Konnte Backup nicht erstellen:', error.message);
            return null;
        }
    }

    async uploadToExternalBackup(backupPath) {
        // GitHub Gist Backup (kostenlos)
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_GIST_ID) {
            try {
                const dbBuffer = fs.readFileSync(backupPath);
                const dbBase64 = dbBuffer.toString('base64');
                
                const response = await fetch(`https://api.github.com/gists/${process.env.GITHUB_GIST_ID}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: {
                            'aeon-backup.db': {
                                content: dbBase64
                            }
                        },
                        description: `Aeon DB Backup - ${new Date().toISOString()}`
                    })
                });

                if (response.ok) {
                    console.log('☁️ Backup zu GitHub Gist hochgeladen');
                    return true;
                } else {
                    const error = await response.text();
                    throw new Error(`GitHub API Fehler: ${error}`);
                }
            } catch (error) {
                console.error('⚠️ GitHub Gist Upload fehlgeschlagen:', error.message);
                throw error;
            }
        }

        // Einfacher HTTP-Endpoint Backup
        if (process.env.BACKUP_UPLOAD_URL) {
            try {
                const dbBuffer = fs.readFileSync(backupPath);
                const formData = new FormData();
                formData.append('backup', dbBuffer, {
                    filename: 'aeon-backup.db',
                    contentType: 'application/x-sqlite3'
                });

                const headers = process.env.BACKUP_UPLOAD_HEADERS 
                    ? JSON.parse(process.env.BACKUP_UPLOAD_HEADERS)
                    : {};
                
                // FormData fügt automatisch Content-Type hinzu
                const response = await fetch(process.env.BACKUP_UPLOAD_URL, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        ...formData.getHeaders(),
                        ...headers
                    }
                });

                if (response.ok) {
                    console.log('☁️ Backup zu externem Service hochgeladen');
                    return true;
                } else {
                    throw new Error(`Upload fehlgeschlagen: ${response.status}`);
                }
            } catch (error) {
                console.error('⚠️ Externer Upload fehlgeschlagen:', error.message);
                throw error;
            }
        }

        // Kein externer Backup-Service konfiguriert
        return false;
    }

    async restoreFromExternalBackup() {
        // GitHub Gist Backup wiederherstellen
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_GIST_ID) {
            try {
                const response = await fetch(`https://api.github.com/gists/${process.env.GITHUB_GIST_ID}`, {
                    headers: {
                        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (response.ok) {
                    const gist = await response.json();
                    const backupFile = gist.files['aeon-backup.db'];
                    
                    if (backupFile && backupFile.content) {
                        const dbBuffer = Buffer.from(backupFile.content, 'base64');
                        fs.writeFileSync(this.dbPath, dbBuffer);
                        console.log('📦 Datenbank aus GitHub Gist wiederhergestellt');
                        return true;
                    }
                }
            } catch (error) {
                console.error('⚠️ GitHub Gist Wiederherstellung fehlgeschlagen:', error.message);
            }
        }

        // Einfacher HTTP-Endpoint Backup wiederherstellen
        if (process.env.BACKUP_DOWNLOAD_URL) {
            try {
                const response = await fetch(process.env.BACKUP_DOWNLOAD_URL, {
                    headers: process.env.BACKUP_DOWNLOAD_HEADERS ? JSON.parse(process.env.BACKUP_DOWNLOAD_HEADERS) : {}
                });

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const dbBuffer = Buffer.from(arrayBuffer);
                    fs.writeFileSync(this.dbPath, dbBuffer);
                    console.log('📦 Datenbank aus externem Service wiederhergestellt');
                    return true;
                }
            } catch (error) {
                console.error('⚠️ Externe Wiederherstellung fehlgeschlagen:', error.message);
            }
        }

        return false;
    }

    trimBackups(maxBackups = 10) {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter((file) => file.endsWith('.db'))
                .sort();
            while (files.length > maxBackups) {
                const oldest = files.shift();
                if (oldest) {
                    fs.unlinkSync(path.join(this.backupDir, oldest));
                }
            }
        } catch (error) {
            console.error('⚠️ Konnte alte Backups nicht löschen:', error.message);
        }
    }

    ensureExtraSettingsColumn() {
        try {
            const columns = this.db.prepare(`PRAGMA table_info(users)`).all();
            const hasExtra = columns.some(col => col.name === 'extra_settings');
            if (!hasExtra) {
                this.db.exec(`ALTER TABLE users ADD COLUMN extra_settings TEXT`);
            }
        } catch (error) {
            console.error('⚠️ Konnte extra_settings Spalte nicht hinzufügen:', error.message);
        }
    }

    normalizeHomeworkKey(subject, description) {
        const cleanSubject = (subject || '').toLowerCase().trim();
        const cleanDescription = (description || '').toLowerCase().replace(/\s+/g, ' ').trim();
        return `${cleanSubject}::${cleanDescription}`;
    }

    // ========== USERS ==========

    createUser(userId, username, password, phone = null, role = 'user', settings = {}, createdBy = 'admin', extraSettings = {}) {
        const stmt = this.db.prepare(`
            INSERT INTO users (
                user_id, username, password, phone, role,
                custom_prompt, spam_limit, react_on_command, command_prefix,
                enable_multi_ai, enable_ocr, enable_mega,
                created_at, created_by, extra_settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            stmt.run(
                userId,
                username,
                password,
                phone,
                role,
                settings.customPrompt || null,
                settings.spamLimit || 500,
                settings.reactOnCommand ? 1 : 0,
                settings.commandPrefix || '!',
                settings.enableMultiAI !== false ? 1 : 0,
                settings.enableOCR !== false ? 1 : 0,
                settings.enableMega !== false ? 1 : 0,
                Date.now(),
                createdBy,
                JSON.stringify(extraSettings || {})
            );
            return true;
        } catch (error) {
            console.error('? User-Erstellung fehlgeschlagen:', error.message);
            return false;
        }
    }

    getUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE user_id = ?');
        const user = stmt.get(userId);

        if (!user) return null;

        return {
            userId: user.user_id,
            username: user.username,
            password: user.password,
            phone: user.phone,
            role: user.role,
            settings: {
                customPrompt: user.custom_prompt,
                spamLimit: user.spam_limit,
                reactOnCommand: user.react_on_command === 1,
                commandPrefix: user.command_prefix,
                enableMultiAI: user.enable_multi_ai === 1,
                enableOCR: user.enable_ocr === 1,
                enableMega: user.enable_mega === 1,
                ...this.parseExtraSettings(user.extra_settings)
            },
            createdAt: user.created_at,
            createdBy: user.created_by
        };
    }

    getUserByUsername(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username);

        if (!user) return null;

        return {
            userId: user.user_id,
            username: user.username,
            password: user.password,
            phone: user.phone,
            role: user.role,
            settings: {
                customPrompt: user.custom_prompt,
                spamLimit: user.spam_limit,
                reactOnCommand: user.react_on_command === 1,
                commandPrefix: user.command_prefix,
                enableMultiAI: user.enable_multi_ai === 1,
                enableOCR: user.enable_ocr === 1,
                enableMega: user.enable_mega === 1,
                ...this.parseExtraSettings(user.extra_settings)
            },
            createdAt: user.created_at,
            createdBy: user.created_by
        };
    }

    getAllUsers() {
        const stmt = this.db.prepare('SELECT * FROM users');
        const users = stmt.all();

        return users.map(user => ({
            userId: user.user_id,
            username: user.username,
            phone: user.phone,
            role: user.role,
            settings: {
                customPrompt: user.custom_prompt,
                spamLimit: user.spam_limit,
                reactOnCommand: user.react_on_command === 1,
                commandPrefix: user.command_prefix,
                enableMultiAI: user.enable_multi_ai === 1,
                enableOCR: user.enable_ocr === 1,
                enableMega: user.enable_mega === 1,
                ...this.parseExtraSettings(user.extra_settings)
            },
            createdAt: user.created_at,
            createdBy: user.created_by
        }));
    }

    updateUserPassword(userId, newPassword) {
        const stmt = this.db.prepare('UPDATE users SET password = ? WHERE user_id = ?');
        const result = stmt.run(newPassword, userId);
        return result.changes > 0;
    }

    updateUserSettings(userId, settings) {
        const stmt = this.db.prepare(`
            UPDATE users SET
                custom_prompt = ?,
                spam_limit = ?,
                react_on_command = ?,
                command_prefix = ?,
                enable_multi_ai = ?,
                enable_ocr = ?,
                enable_mega = ?,
                extra_settings = ?
            WHERE user_id = ?
        `);

        const result = stmt.run(
            settings.customPrompt || null,
            settings.spamLimit || 500,
            settings.reactOnCommand ? 1 : 0,
            settings.commandPrefix || '!',
            settings.enableMultiAI !== false ? 1 : 0,
            settings.enableOCR !== false ? 1 : 0,
            settings.enableMega !== false ? 1 : 0,
            JSON.stringify(this.extractExtraSettings(settings)),
            userId
        );

        return result.changes > 0;
    }

    deleteUser(userId) {
        const stmt = this.db.prepare('DELETE FROM users WHERE user_id = ?');
        const result = stmt.run(userId);
        return result.changes > 0;
    }

    upsertHomework(userId, subject, description) {
        if (!userId || !subject || !description) {
            return { success: false, message: 'Ungültige Eingabe' };
        }

        const normalized = this.normalizeHomeworkKey(subject, description);
        const existing = this.db.prepare('SELECT id FROM homework WHERE user_id = ?').get(userId);
        const timestamp = Date.now();

        if (existing) {
            const stmt = this.db.prepare(`
                UPDATE homework
                SET subject = ?, description = ?, normalized = ?, created_at = ?
                WHERE id = ?
            `);
            stmt.run(subject.trim(), description.trim(), normalized, timestamp, existing.id);
            return { success: true, updated: true };
        }

        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO homework (user_id, subject, description, normalized, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(userId, subject.trim(), description.trim(), normalized, timestamp);

        if (info.changes === 0) {
            return { success: true, duplicate: true };
        }

        return { success: true, created: true };
    }

    getHomework(limit = 100) {
        const stmt = this.db.prepare(`
            SELECT h.*, u.username, u.phone
            FROM homework h
            LEFT JOIN users u ON u.user_id = h.user_id
            ORDER BY h.created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getHomeworkById(id) {
        const stmt = this.db.prepare('SELECT * FROM homework WHERE id = ?');
        return stmt.get(id);
    }

    deleteHomework(id) {
        const stmt = this.db.prepare('DELETE FROM homework WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    createMaterial({
        userId,
        title,
        description = '',
        subject = '',
        filePath = '',
        fileType = '',
        fileName = ''
    }) {
        const stmt = this.db.prepare(`
            INSERT INTO materials (user_id, title, description, subject, file_path, file_type, file_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            userId,
            title.trim(),
            description.trim(),
            subject.trim(),
            filePath,
            fileType,
            fileName,
            Date.now()
        );

        return info.lastInsertRowid;
    }

    getMaterials(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT m.*, u.username, u.phone, u.user_id
            FROM materials m
            LEFT JOIN users u ON u.user_id = m.user_id
            ORDER BY m.created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getMaterialById(id) {
        const stmt = this.db.prepare(`
            SELECT m.*, u.username, u.phone
            FROM materials m
            LEFT JOIN users u ON u.user_id = m.user_id
            WHERE m.id = ?
        `);
        return stmt.get(id);
    }

    deleteMaterial(id) {
        const stmt = this.db.prepare('DELETE FROM materials WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // ========== SESSIONS ==========

    createSession(sessionId, username, role, userId = null, timeout = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const expiresAt = now + timeout;

        const stmt = this.db.prepare(`
            INSERT INTO sessions (session_id, username, role, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        try {
            stmt.run(sessionId, username, role, userId, now, expiresAt);
            return true;
        } catch (error) {
            console.error('? Session-Erstellung fehlgeschlagen:', error.message);
            return false;
        }
    }

    getSession(sessionId) {
        const stmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
        const session = stmt.get(sessionId);

        if (!session) return null;

        // Check if expired
        if (Date.now() > session.expires_at) {
            this.deleteSession(sessionId);
            return null;
        }

        return {
            sessionId: session.session_id,
            username: session.username,
            role: session.role,
            userId: session.user_id,
            createdAt: session.created_at,
            expiresAt: session.expires_at
        };
    }

    deleteSession(sessionId) {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE session_id = ?');
        const result = stmt.run(sessionId);
        return result.changes > 0;
    }

    cleanupExpiredSessions() {
        const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
        const result = stmt.run(Date.now());

        if (result.changes > 0) {
            console.log(`🧼 ${result.changes} abgelaufene Sessions gelöscht`);
        }

        return result.changes;
    }

    getActiveSessions() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?');
        const result = stmt.get(Date.now());
        return result.count;
    }

    // ========== CONVERSATIONS ==========

    addConversationMessage(chatId, role, content) {
        const stmt = this.db.prepare(`
            INSERT INTO conversations (chat_id, role, content, timestamp)
            VALUES (?, ?, ?, ?)
        `);

        try {
            stmt.run(chatId, role, content, Date.now());
            return true;
        } catch (error) {
            console.error('? Nachricht speichern fehlgeschlagen:', error.message);
            return false;
        }
    }

    getConversationHistory(chatId, limit = 50) {
        const stmt = this.db.prepare(`
            SELECT role, content, timestamp
            FROM conversations
            WHERE chat_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);

        const messages = stmt.all(chatId, limit);

        // Reverse to get chronological order
        return messages.reverse().map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));
    }

    clearConversation(chatId) {
        const stmt = this.db.prepare('DELETE FROM conversations WHERE chat_id = ?');
        const result = stmt.run(chatId);
        return result.changes;
    }

    getAllConversationChats() {
        const stmt = this.db.prepare('SELECT DISTINCT chat_id FROM conversations');
        const chats = stmt.all();
        return chats.map(chat => chat.chat_id);
    }

    cleanupOldConversations(daysOld = 7) {
        const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

        const stmt = this.db.prepare(`
            DELETE FROM conversations
            WHERE chat_id IN (
                SELECT DISTINCT chat_id
                FROM conversations
                GROUP BY chat_id
                HAVING MAX(timestamp) < ?
            )
        `);

        const result = stmt.run(cutoff);

        if (result.changes > 0) {
            console.log(`🧹 ${result.changes} alte Konversations-Nachrichten gelöscht`);
        }

        return result.changes;
    }

    getConversationStats() {
        const stmt = this.db.prepare(`
            SELECT
                COUNT(DISTINCT chat_id) as total_chats,
                COUNT(*) as total_messages,
                SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
                SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
            FROM conversations
        `);

        return stmt.get();
    }

    // ========== PUBLIC CHAT ==========

    addPublicChatMessage({ userId, username, message, timestamp, fileUrl = null, fileName = null, fileType = null }) {
        const stmt = this.db.prepare(`
            INSERT INTO public_chat (user_id, username, message, file_url, file_name, file_type, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(userId, username, message || '', fileUrl, fileName, fileType, timestamp);
        return true;
    }

    getPublicChatMessages(limit = 100) {
        const stmt = this.db.prepare(`
            SELECT id, user_id, username, message, file_url, file_name, file_type, timestamp
            FROM public_chat
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        return stmt.all(limit).reverse(); // Reverse to show oldest first
    }

    deletePublicChatMessage(messageId, userId) {
        // Prüfe, ob die Nachricht dem User gehört
        const checkStmt = this.db.prepare(`
            SELECT user_id FROM public_chat WHERE id = ?
        `);
        const message = checkStmt.get(messageId);
        
        if (!message) {
            return { success: false, error: 'Nachricht nicht gefunden' };
        }
        
        if (message.user_id !== userId) {
            return { success: false, error: 'Keine Berechtigung zum Löschen' };
        }
        
        const deleteStmt = this.db.prepare(`
            DELETE FROM public_chat WHERE id = ?
        `);
        deleteStmt.run(messageId);
        return { success: true };
    }

    // ========== ADMIN ANNOUNCEMENTS ==========

    setAdminAnnouncement(message, createdBy) {
        const now = Date.now();
        
        // Deactivate all existing announcements
        const deactivateStmt = this.db.prepare(`
            UPDATE admin_announcement SET is_active = 0 WHERE is_active = 1
        `);
        deactivateStmt.run();
        
        // Insert new active announcement
        const insertStmt = this.db.prepare(`
            INSERT INTO admin_announcement (message, created_by, created_at, updated_at, is_active)
            VALUES (?, ?, ?, ?, 1)
        `);
        
        try {
            insertStmt.run(message, createdBy, now, now);
            return true;
        } catch (error) {
            console.error('⚠️ Admin-Nachricht speichern fehlgeschlagen:', error.message);
            return false;
        }
    }

    getActiveAdminAnnouncement() {
        const stmt = this.db.prepare(`
            SELECT id, message, created_by, created_at, updated_at
            FROM admin_announcement
            WHERE is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        const announcement = stmt.get();
        
        if (!announcement) {
            return null;
        }
        
        return {
            id: announcement.id,
            message: announcement.message,
            createdBy: announcement.created_by,
            createdAt: announcement.created_at,
            updatedAt: announcement.updated_at
        };
    }

    // ========== WEBUNTIS CREDENTIALS ==========

    saveWebuntisCredentials(userId, server, school, username, passwordEncrypted) {
        const now = Date.now();
        
        const stmt = this.db.prepare(`
            INSERT INTO webuntis_credentials (user_id, server, school, username, password_encrypted, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                server = ?,
                school = ?,
                username = ?,
                password_encrypted = ?,
                updated_at = ?
        `);
        
        try {
            stmt.run(
                userId, server, school, username, passwordEncrypted, now, now,
                server, school, username, passwordEncrypted, now
            );
            return true;
        } catch (error) {
            console.error('⚠️ Webuntis-Credentials speichern fehlgeschlagen:', error.message);
            return false;
        }
    }

    getWebuntisCredentials(userId) {
        const stmt = this.db.prepare(`
            SELECT user_id, server, school, username, password_encrypted, created_at, updated_at
            FROM webuntis_credentials
            WHERE user_id = ?
        `);
        
        const credentials = stmt.get(userId);
        
        if (!credentials) {
            return null;
        }
        
        return {
            userId: credentials.user_id,
            server: credentials.server,
            school: credentials.school,
            username: credentials.username,
            passwordEncrypted: credentials.password_encrypted,
            createdAt: credentials.created_at,
            updatedAt: credentials.updated_at
        };
    }

    deleteWebuntisCredentials(userId) {
        const stmt = this.db.prepare('DELETE FROM webuntis_credentials WHERE user_id = ?');
        const result = stmt.run(userId);
        return result.changes > 0;
    }

    // ========== UTILITIES ==========

    close() {
        this.db.close();
        console.log('📕 Database geschlossen');
    }

    vacuum() {
        this.db.exec('VACUUM');
        console.log('🌀 Database VACUUM durchgeführt');
    }

    parseExtraSettings(raw) {
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error('⚠️ Konnte extra_settings nicht parsen:', error.message);
            return {};
        }
    }

    extractExtraSettings(settings) {
        const {
            customPrompt,
            spamLimit,
            reactOnCommand,
            commandPrefix,
            enableMultiAI,
            enableOCR,
            enableMega,
            ...extra
        } = settings || {};
        return extra;
    }
}
