import crypto from 'crypto';
import { DatabaseService } from './database.js';

export class AuthService {
    constructor(db = null) {
        this.db = db || new DatabaseService();
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

        // Cleanup expired sessions every hour
        setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);

        console.log('? AuthService mit Database initialisiert');
    }

    createSession(username, role, userId = null) {
        const sessionId = crypto.randomBytes(32).toString('hex');

        const success = this.db.createSession(
            sessionId,
            username,
            role,
            userId,
            this.sessionTimeout
        );

        if (success) {
            console.log(`🔐 Session erstellt für ${username} (${role})`);
        }

        return sessionId;
    }

    validateSession(sessionId) {
        const session = this.db.getSession(sessionId);

        if (!session) {
            return null;
        }

        return {
            username: session.username,
            role: session.role,
            userId: session.userId,
            createdAt: session.createdAt
        };
    }

    destroySession(sessionId) {
        const session = this.db.getSession(sessionId);

        if (session) {
            const success = this.db.deleteSession(sessionId);

            if (success) {
                console.log(`🧹 Session beendet für ${session.username}`);
            }

            return success;
        }

        return false;
    }

    cleanupSessions() {
        const cleaned = this.db.cleanupExpiredSessions();

        if (cleaned > 0) {
            console.log(`🧼 ${cleaned} abgelaufene Sessions gelöscht`);
        }
    }

    getActiveSessions() {
        return this.db.getActiveSessions();
    }
}
