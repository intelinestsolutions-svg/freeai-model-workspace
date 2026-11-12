# FreeAI — Three-Model Workspace

A self-hosted web application for chatting with locally installed AI models (Ollama). Pick up to three free models, chat with any of them, and manage your profile — all without API keys or usage fees.

## Features

- **User authentication** — Register, verify email, sign in
- **Model selection** — Choose up to 3 free local Ollama models
- **Chat interface** — Chat with any selected model
- **Profile management** — Edit profile, settings, theme
- **OAuth support** — Google and GitHub login (optional)
- **SQLite or MariaDB** — Flexible database backend

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your SMTP and OAuth settings

# 3. Start the server
node server.mjs

# 4. Open http://localhost:3000
```

## Environment Variables

See `.env.example` for all available settings.

### Required:
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — Email verification
- `APP_BASE_URL` — Your domain (e.g., `https://yourdomain.com`)

### Optional (OAuth):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Database:
- `DB_DRIVER=sqlite` (default, no setup needed)
- `DB_DRIVER=mariadb` (requires MariaDB)

## OAuth Setup

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `https://yourdomain.com/auth/google/callback`
4. Copy Client ID and Secret to `.env`

### GitHub
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `https://yourdomain.com/auth/github/callback`
4. Copy Client ID and Secret to `.env`

## Tech Stack

- **Backend**: Node.js (built-in http module, no framework)
- **Database**: SQLite (node:sqlite) or MariaDB (mysql2)
- **Frontend**: Vanilla JavaScript, CSS
- **Email**: Nodemailer
- **Auth**: Session-based with email verification, optional OAuth

## License

MIT
