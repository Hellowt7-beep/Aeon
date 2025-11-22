# 🚀 Replit Setup - Super Einfach

## 1. Auf GitHub pushen

```bash
git add .
git commit -m "Ready for Replit"
git push
```

## 2. Replit

1. Gehe zu https://replit.com
2. Sign up mit GitHub
3. "Create Repl" → "Import from GitHub"
4. Wähle dein Repository

## 3. Im Terminal

```bash
npm install
npm start
```

**Hinweis**: Falls du einen `v2` Ordner hast, dann:
```bash
cd v2
npm install
npm start
```

## 4. Secrets (🔒 Icon links)

**WICHTIG**: Finde zuerst deine Replit App URL!

1. Starte die App: `npm start`
2. Klicke auf **"Open in new tab"** (oben rechts) oder das **Webview-Symbol**
3. Die URL in der Adressleiste ist deine Public Base URL

**Für dein Repl** (Aeon):
```
PUBLIC_BASE_URL=https://Aeon.hellowt7.replit.app
```

Dann füge diese Secrets hinzu:
```
DATA_DIR=/home/runner/data
GROQ_API_KEY=dein-key
GOOGLE_AI_API_KEY=dein-key
MEGA_EMAIL=deine-email
MEGA_PASSWORD=dein-passwort
PUBLIC_BASE_URL=https://Aeon.hellowt7.replit.app
```

**Tipp**: Nach `npm start` zeigt Replit die URL automatisch an!

## 5. Persistent Storage

```bash
mkdir -p /home/runner/data
```

**Fertig!** 🎉

