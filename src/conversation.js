import { DatabaseService } from './database.js';

export class ConversationManager {
    constructor(db = null) {
        this.db = db || new DatabaseService();
        this.maxMessages = 50;

        this.stats = {
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalMegaRequests: 0,
            totalOCRProcessed: 0,
            totalSimpleForced: 0,
            totalMultiForced: 0,
            startTime: Date.now()
        };

        console.log('? ConversationManager mit Database initialisiert');
    }

    addMessage(chatId, role, content) {
        const success = this.db.addConversationMessage(chatId, role, content);

        if (!success) {
            console.error('? Fehler beim Speichern der Nachricht');
            return;
        }

        if (role === 'user') {
            this.stats.totalMessagesReceived++;
        } else {
            this.stats.totalMessagesSent++;
        }

        const messages = this.db.getConversationHistory(chatId, this.maxMessages);
        console.log(`💾 Nachricht gespeichert für ${chatId} (${messages.length} total)`);
    }

    incrementMegaRequests() {
        this.stats.totalMegaRequests++;
    }

    incrementOCRProcessed() {
        this.stats.totalOCRProcessed++;
    }

    incrementSimpleForced() {
        this.stats.totalSimpleForced++;
    }

    incrementMultiForced() {
        this.stats.totalMultiForced++;
    }

    getHistory(chatId, limit = 10) {
        return this.db.getConversationHistory(chatId, limit);
    }

    clearChat(chatId) {
        const deleted = this.db.clearConversation(chatId);
        console.log(`🧹 Chat-Historie gelöscht für ${chatId} (${deleted} Nachrichten)`);
    }

    getAllChats() {
        return this.db.getAllConversationChats();
    }

    getStats() {
        const uptimeSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const dbStats = this.db.getConversationStats();

        return {
            totalChats: dbStats.total_chats || 0,
            totalMessages: dbStats.total_messages || 0,
            messagesSent: this.stats.totalMessagesSent,
            messagesReceived: this.stats.totalMessagesReceived,
            megaRequests: this.stats.totalMegaRequests,
            ocrProcessed: this.stats.totalOCRProcessed,
            simpleForced: this.stats.totalSimpleForced,
            multiForced: this.stats.totalMultiForced,
            uptimeSeconds: uptimeSeconds,
            uptimeFormatted: this.formatUptime(uptimeSeconds)
        };
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    cleanup() {
        const deleted = this.db.cleanupOldConversations(7);

        if (deleted > 0) {
            console.log(`🧼 Cleanup: ${deleted} alte Nachrichten gelöscht`);
        }
    }
}
