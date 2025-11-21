# Aeon WhatsApp Hausaufgaben Bot

Ein fortgeschrittener WhatsApp-Bot mit Multi-AI-System und Web-Dashboard für Hausaufgaben-Hilfe.

## Features

- 🤖 **Multi-AI-System**: Nutzt Gemini, Groq und OpenRouter für optimale Antworten
- 📱 **WhatsApp-Integration**: Vollständige WhatsApp-Web-Integration
- 🎨 **Web-Dashboard**: Modernes, responsives Dashboard mit Live-Coding-Animationen
- 🔐 **Sichere Authentifizierung**: Passwort-Hashing mit bcrypt
- 📊 **SQLite-Datenbank**: Persistente Speicherung von Chats und Benutzern
- 🖼️ **OCR-Funktionalität**: Texterkennung aus Bildern
- ☁️ **MEGA-Integration**: Zugriff auf Schulbücher in der Cloud
- 🎯 **Rate Limiting**: Schutz vor Missbrauch
- ✅ **Input Validation**: Umfassende Validierung aller Eingaben

## Installation

### Voraussetzungen

- Node.js >= 18.0.0
- npm oder bun

### 1. Repository klonen

```bash
git clone <repository-url>
cd Test
```

### 2. Dependencies installieren

```bash
npm install
# oder
bun install
```

### 3. Environment Variables konfigurieren

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
# Server-Konfiguration
NODE_ENV=development
PORT=3000

# Gemini API Keys (mindestens einer erforderlich)
GEMINI_API_KEY=dein_gemini_api_key
# Optional: Weitere Keys
# GEMINI_API_KEY_2=zweiter_key
# GEMINI_API_KEY_3=dritter_key

# Groq API Key (optional, für Multi-AI)
GROQ_API_KEY=dein_groq_api_key

# OpenRouter API Key (optional)
OPENROUTER_API_KEY=dein_openrouter_api_key

# Tavily API Key (optional, für Web-Suche)
TAVILY_API_KEY=dein_tavily_api_key

# MEGA Credentials (optional)
MEGA_EMAIL=deine_email@example.com
MEGA_PASSWORD=dein_passwort
```

### 4. Bot starten

```bash
npm start
# oder für Development mit Auto-Reload
npm run dev
```

### 5. WhatsApp verbinden

1. Öffne `http://localhost:3000/qr` im Browser
2. Scanne den QR-Code mit WhatsApp
3. Öffne WhatsApp → Menü → Verknüpfte Geräte → Gerät verknüpfen

### 6. Dashboard öffnen

Öffne `http://localhost:3000/dashboard` im Browser

**Standard-Login:**
- Username: `Admin`
- Passwort: `Hallo%`

## Projektstruktur

```
src/
├── index.js              # Hauptserver-Datei
├── database.js           # SQLite-Datenbank-Service
├── ai.js                 # Gemini AI Service
├── multi-ai.js          # Multi-AI Service
├── conversation.js       # Konversations-Manager
├── user-manager.js       # Benutzer-Verwaltung
├── auth.js               # Authentifizierung
├── ocr.js                # OCR-Service
├── mega.js               # MEGA-Cloud-Service
└── public/
    └── dashboard.html     # Web-Dashboard
```

## Sicherheit

- ✅ SQL Injection-Schutz durch Prepared Statements
- ✅ Session-basierte Authentifizierung

## API-Endpunkte

### Authentifizierung
- `POST /api/login` - Benutzer-Login
- `POST /api/logout` - Logout
- `GET /api/session` - Session-Status

### Chat
- `POST /api/chat` - Nachricht senden
- `GET /api/stats` - Statistiken

### Benutzer (Admin)
- `GET /api/users` - Alle Benutzer
- `POST /api/users` - Benutzer erstellen
- `DELETE /api/users/:phone` - Benutzer löschen
- `PUT /api/users/:phone/password` - Passwort ändern

### Weitere
- `GET /health` - Health-Check
- `GET /ping` - Ping-Endpoint
- `GET /qr` - WhatsApp QR-Code

## Konfiguration

Konfigurationswerte können in den jeweiligen Service-Dateien angepasst werden.

## Entwicklung

### Code-Qualität

Das Projekt verwendet:
- ES6+ Module
- Async/Await
- Modulare Service-Architektur

## Troubleshooting

### WhatsApp-Verbindung schlägt fehl

1. Prüfe, ob Chrome/Chromium installiert ist
2. In Production: Stelle sicher, dass `@sparticuz/chromium` korrekt installiert ist
3. Prüfe die Logs auf Fehlermeldungen

### API-Keys funktionieren nicht

1. Validiere die Environment Variables mit `src/utils/env.js`
2. Prüfe die API-Key-Berechtigungen
3. Stelle sicher, dass die Keys nicht abgelaufen sind

### Datenbank-Fehler

1. Prüfe, ob `data/` Verzeichnis existiert und beschreibbar ist
2. Führe `npm run migrate` aus, falls Migrationen nötig sind

## Lizenz

MIT

## Support

Bei Fragen oder Problemen öffne ein Issue im Repository.

