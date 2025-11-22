import { DatabaseService } from './database.js';
import crypto from 'crypto';

const BASE_SETTING_KEYS = [
    'customPrompt',
    'spamLimit',
    'reactOnCommand',
    'commandPrefix',
    'enableMultiAI',
    'enableOCR',
    'enableMega'
];

const AVAILABLE_MULTI_AI_MODELS = ['deepseek', 'llama', 'gemini'];

const DEFAULT_BASE_SETTINGS = {
    customPrompt: null,
    spamLimit: 500,
    reactOnCommand: false,
    commandPrefix: '!',
    enableMultiAI: true,
    enableOCR: true,
    enableMega: true
};

const DEFAULT_ADVANCED_SETTINGS = {
    aliases: [],
    keywordRouting: {
        mega: [],
        ocr: []
    },
    modelPreferences: {
        priority: [],
        blacklist: [],
        autoFallback: true
    },
    accessibility: {
        fontSize: 'medium',
        highContrast: false,
        autoFormat: true
    }
};

const DEFAULT_PROFILE = {
    displayName: '',
    bio: '',
    avatarUrl: ''
};

function generateUserId() {
    if (typeof crypto.randomUUID === 'function') {
        return `user_${crypto.randomUUID()}`;
    }
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function normalizePhoneNumber(phone = '') {
    const trimmed = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (!trimmed) return null;
    if (trimmed.startsWith('+')) {
        return trimmed;
    }
    if (/^\d+$/.test(trimmed)) {
        return `+${trimmed}`;
    }
    return null;
}

function cloneAdvancedDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_ADVANCED_SETTINGS));
}

function sanitizeAliasList(list = []) {
    if (!Array.isArray(list)) return [];
    return list
        .map(item => {
            if (!item) return null;
            if (typeof item === 'string') {
                const [shortcut, ...promptParts] = item.split('=>');
                return {
                    shortcut: shortcut?.trim(),
                    prompt: promptParts.join('=>').trim()
                };
            }
            if (typeof item === 'object') {
                return {
                    shortcut: (item.shortcut || '').trim(),
                    prompt: (item.prompt || item.text || '').trim()
                };
            }
            return null;
        })
        .filter(item => item && item.shortcut && item.prompt);
}

function sanitizeKeywordList(list = []) {
    if (!Array.isArray(list)) return [];
    return list
        .map(keyword => (keyword || '').toString().trim())
        .filter(keyword => keyword.length > 0);
}

function sanitizeModelList(list = []) {
    if (!Array.isArray(list)) return [];
    const normalized = list
        .map(model => (model || '').toString().toLowerCase().trim())
        .filter(model => AVAILABLE_MULTI_AI_MODELS.includes(model));
    return [...new Set(normalized)];
}

function sanitizeAccessibility(settings = {}) {
    const fontSize = ['small', 'medium', 'large'].includes(settings.fontSize)
        ? settings.fontSize
        : 'medium';
    return {
        fontSize,
        highContrast: !!settings.highContrast,
        autoFormat: settings.autoFormat !== false
    };
}

function buildAdvancedSettings(source = {}) {
    const defaults = cloneAdvancedDefaults();
    return {
        aliases: sanitizeAliasList(source.aliases || defaults.aliases),
        keywordRouting: {
            mega: sanitizeKeywordList(source?.keywordRouting?.mega || defaults.keywordRouting.mega),
            ocr: sanitizeKeywordList(source?.keywordRouting?.ocr || defaults.keywordRouting.ocr)
        },
        modelPreferences: {
            priority: sanitizeModelList(source?.modelPreferences?.priority || defaults.modelPreferences.priority),
            blacklist: sanitizeModelList(source?.modelPreferences?.blacklist || defaults.modelPreferences.blacklist),
            autoFallback: source?.modelPreferences?.autoFallback !== false
        },
        accessibility: sanitizeAccessibility(source?.accessibility || defaults.accessibility)
    };
}

function sanitizeProfile(profile = {}) {
    return {
        displayName: (profile.displayName || '').trim(),
        bio: (profile.bio || '').trim(),
        avatarUrl: profile.avatarUrl || ''
    };
}

function pickBaseSettings(settings = {}) {
    const base = { ...DEFAULT_BASE_SETTINGS };
    BASE_SETTING_KEYS.forEach(key => {
        if (key in settings) {
            base[key] = settings[key];
        }
    });
    return base;
}

function ensureSettingsShape(settings = {}) {
    const base = pickBaseSettings(settings);
    const advanced = buildAdvancedSettings(settings);
    const profile = sanitizeProfile(settings.profile || DEFAULT_PROFILE);
    return { ...base, ...advanced, profile };
}

export class UserManager {
    constructor(db = null) {
        this.db = db || new DatabaseService();
        this.adminUser = {
            username: 'Admin',
            password: 'Hallo%',
            role: 'admin',
            createdAt: Date.now()
        };

        console.log('✅ UserManager mit Database initialisiert');
    }

    // Admin Login
    loginAdmin(username, password) {
        // Case-insensitive username comparison
        const usernameMatch = username && username.trim().toLowerCase() === this.adminUser.username.toLowerCase();
        const passwordMatch = password === this.adminUser.password;
        
        if (usernameMatch && passwordMatch) {
            return {
                success: true,
                user: {
                    username: this.adminUser.username,
                    role: 'admin'
                }
            };
        }
        return { success: false, message: 'Ungültige Admin-Anmeldedaten' };
    }

    // User Login
    loginUser(username, password) {
        const user = this.db.getUserByUsername(username);

        if (!user) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Falsches Passwort' };
        }

        const formattedSettings = ensureSettingsShape(user.settings);

        return {
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                phone: user.phone,
                role: user.role,
                religion: user.religion || null,
                secondLanguage: user.secondLanguage || null,
                settings: formattedSettings
            }
        };
    }

    // Admin/Self-Service: Create User
    createUser(username, password, phone = null, createdBy = 'admin', religion = null, secondLanguage = null) {
        const cleanedUsername = (username || '').trim();
        if (!cleanedUsername) {
            return { success: false, message: 'Benutzername erforderlich' };
        }

        let normalizedPhone = null;
        if (phone) {
            normalizedPhone = normalizePhoneNumber(phone);
            if (!normalizedPhone) {
                return { success: false, message: 'Telefonnummer muss mit Landesvorwahl (z.B. +49) angegeben werden' };
            }
            if (this.db.getUser(normalizedPhone)) {
                return { success: false, message: 'Telefonnummer bereits vergeben' };
            }
        }

        let userId = normalizedPhone || generateUserId();
        if (this.db.getUser(userId)) {
            userId = generateUserId();
        }

        const existingUsername = this.db.getUserByUsername(cleanedUsername);
        if (existingUsername) {
            return { success: false, message: 'Benutzername bereits vergeben' };
        }

        const defaultAdvanced = cloneAdvancedDefaults();
        const success = this.db.createUser(
            userId,
            cleanedUsername,
            password,
            normalizedPhone,
            'user',
            { ...DEFAULT_BASE_SETTINGS },
            createdBy,
            defaultAdvanced,
            religion,
            secondLanguage
        );

        if (!success) {
            return { success: false, message: 'Fehler beim Erstellen des Benutzers' };
        }

        const user = this.db.getUser(userId);
        const shapedSettings = ensureSettingsShape(user.settings);
        console.log(`✅ Benutzer erstellt: ${cleanedUsername} (${normalizedPhone || 'keine Tel.'})`);

        return {
            success: true,
            message: 'Benutzer erfolgreich erstellt',
            user: {
                userId: user.userId,
                username: user.username,
                phone: user.phone,
                role: user.role,
                religion: user.religion || null,
                secondLanguage: user.secondLanguage || null,
                settings: shapedSettings
            },
            userId
        };
    }

    // Admin: Delete User
    deleteUser(userId) {
        const user = this.db.getUser(userId);

        if (!user) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        const success = this.db.deleteUser(userId);

        if (!success) {
            return { success: false, message: 'Fehler beim Löschen' };
        }

        console.log(`🗑️ Benutzer gelöscht: ${user.username} (${userId})`);

        return { success: true, message: 'Benutzer erfolgreich gelöscht' };
    }

    // Admin: Update User Password
    updateUserPassword(userId, newPassword) {
        const success = this.db.updateUserPassword(userId, newPassword);

        if (!success) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        return { success: true, message: 'Passwort erfolgreich geändert' };
    }

    // User: Update Own Settings
    updateUserSettings(userId, settings) {
        const user = this.db.getUser(userId);

        if (!user) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        const mergedSettings = ensureSettingsShape({
            ...user.settings,
            ...settings
        });

        const success = this.db.updateUserSettings(userId, mergedSettings);

        if (!success) {
            return { success: false, message: 'Fehler beim Speichern' };
        }

        console.log(`⚙️ Einstellungen aktualisiert für ${user.username}`);

        return {
            success: true,
            message: 'Einstellungen erfolgreich gespeichert',
            settings: mergedSettings
        };
    }

    // Reset Custom Prompt to Default
    resetPrompt(userId) {
        const user = this.db.getUser(userId);

        if (!user) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        const mergedSettings = ensureSettingsShape({
            ...user.settings,
            customPrompt: null
        });

        const success = this.db.updateUserSettings(userId, mergedSettings);

        if (!success) {
            return { success: false, message: 'Fehler beim Zurücksetzen' };
        }

        console.log(`🧹 Prompt zurückgesetzt für ${user.username}`);

        return { success: true, message: 'Prompt erfolgreich zurückgesetzt' };
    }

    // Get User by ID (phone or user_xxx)
    getUserById(userId) {
        const user = this.db.getUser(userId);
        if (!user) return null;
        return {
            ...user,
            settings: ensureSettingsShape(user.settings)
        };
    }

    // Get User Settings
    getUserSettings(userId) {
        const user = this.db.getUser(userId);

        if (!user) {
            return ensureSettingsShape({});
        }

        return ensureSettingsShape(user.settings);
    }

    updateUserProfile(userId, profile = {}) {
        const user = this.db.getUser(userId);
        if (!user) {
            return { success: false, message: 'Benutzer nicht gefunden' };
        }

        const mergedSettings = ensureSettingsShape({
            ...user.settings,
            profile: {
                ...user.settings.profile,
                ...profile
            }
        });

        const success = this.db.updateUserSettings(userId, mergedSettings);
        if (!success) {
            return { success: false, message: 'Profil konnte nicht gespeichert werden' };
        }

        return { success: true, profile: mergedSettings.profile };
    }

    getUserProfile(userId) {
        const user = this.db.getUser(userId);
        if (!user) {
            return null;
        }
        const shaped = ensureSettingsShape(user.settings);
        return shaped.profile || { ...DEFAULT_PROFILE };
    }

    // Get All Users (Admin only)
    getAllUsers() {
        return this.db.getAllUsers().map(user => ({
            userId: user.userId,
            username: user.username,
            phone: user.phone,
            role: user.role,
            settings: ensureSettingsShape(user.settings),
            createdAt: user.createdAt,
            createdBy: user.createdBy
        }));
    }

    // Get Default Prompts
    getDefaultPrompts() {
        return {
            school: 'Du bist eine hilfsbereite KI-Assistentin für Hausaufgaben. Antworte kurz aber vollständig mit allen wichtigen Infos.',
            normal: 'Du bist eine freundliche KI-Assistentin. Antworte kurz aber vollständig.',
            translation: 'Du bist eine Übersetzungs-KI.\n\nWICHTIG - Bei Übersetzungen IMMER strukturiert und ausführlich:\n- Nutze Überschriften mit **\n- Nummeriere jede Zeile mit >\n- Gib JEDE Zeile einzeln an\n- Füge Erklärungen mit 💡 hinzu\n- Nutze Emojis\n- Sei vollständig und präzise'
        };
    }

    // Stats
    getStats() {
        const users = this.db.getAllUsers();
        return {
            totalUsers: users.length,
            users: this.getAllUsers()
        };
    }
}
