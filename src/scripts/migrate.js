import { DatabaseService } from '../services/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🚚 Aeon AI - User Migration Tool\n');
console.log('='.repeat(60));

const db = new DatabaseService();
const usersPath = path.join(__dirname, '../data/users.json');

if (!fs.existsSync(usersPath)) {
    console.log('\n? Keine users.json gefunden!');
    console.log(`📁 Erwartet in: ${usersPath}\n`);
    process.exit(1);
}

try {
    const oldUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const userCount = Object.keys(oldUsers).length;

console.log(`\n📊 Gefunden: ${userCount} User in users.json`);
    console.log('\nStarte Migration...\n');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const [userId, user] of Object.entries(oldUsers)) {
        // Check if user already exists
        const existing = db.getUser(userId);
        if (existing) {
            console.log(`⚠️  ${user.username} (${userId}) - bereits vorhanden`);
            skipped++;
            continue;
        }

        const baseSettings = user.settings || {};
        const extraSettings = user.extraSettings || user.settings || {};

        const success = db.createUser(
            userId,
            user.username,
            user.password,
            user.phone || null,
            user.role || 'user',
            baseSettings,
            user.createdBy || 'migration',
            extraSettings
        );

        if (success) {
            console.log(`? ${user.username} (${userId}) - importiert`);
            migrated++;
        } else {
            console.log(`? ${user.username} (${userId}) - Fehler`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
console.log('\n📋 Migration Ergebnisse:');
    console.log(`   ? Importiert: ${migrated}`);
    console.log(`   ↩️  Übersprungen: ${skipped}`);
    console.log(`   ? Fehler: ${errors}`);
    console.log(`   🔢 Gesamt: ${userCount}\n`);

    if (migrated > 0) {
        const backup = usersPath + '.backup';
        console.log('💾 Erstelle Backup der users.json...');
        fs.copyFileSync(usersPath, backup);
        console.log(`? Backup erstellt: ${backup}\n`);

        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('🗑️  users.json löschen? (j/n): ', (answer) => {
            if (answer.toLowerCase() === 'j') {
                fs.unlinkSync(usersPath);
                console.log('? users.json gelöscht\n');
            } else {
                console.log('📂  users.json behalten\n');
            }
            rl.close();
            process.exit(0);
        });
    } else {
        console.log('ℹ️  Keine neuen User importiert - keine Änderungen\n');
        process.exit(0);
    }

} catch (error) {
    console.error('\n? Migration fehlgeschlagen:', error.message);
    process.exit(1);
}
