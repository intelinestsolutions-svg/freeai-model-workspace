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

---

## Disclaimer

**All work in this repository is for hobby, personal use, training, and testing purposes only.**

This project is provided "as-is" without any warranty of any kind, express or implied. Any person who uses, modifies, distributes, or deploys this code for their own purposes does so entirely at their own risk and is solely responsible for their actions. The author(s) of this repository are not liable for any damages, losses, or legal consequences arising from the use of this software.

This software is intended for educational and personal experimentation. It is not intended for production use without proper security review, legal compliance, and authorization. Users are responsible for ensuring their use complies with all applicable laws, regulations, and third-party terms of service (including but not limited to Google, GitHub, and any AI model providers).

By using this code, you acknowledge that you understand these terms and accept full responsibility for your use of this software.

## Disclaimer

**All work in this repository is provided for hobby, personal use, training, and testing purposes only.**

By using, copying, modifying, or distributing any part of this project, you acknowledge and agree that:

- You are solely responsible for how you use this software.
- The author(s) are not liable for any damages, data loss, security breaches, or legal consequences arising from your use of this software.
- Any deployment, commercial use, or integration into production systems is done entirely at your own risk and responsibility.
- This software is provided "as is" without warranty of any kind, express or implied.
- OAuth credentials, SMTP passwords, and other secrets must be managed securely by the deployer. Never commit real credentials to version control.

**Use responsibly and at your own risk.**

## OAuth Setup — Step by Step

### Google OAuth

**Link to create credentials:** https://console.cloud.google.com/apis/credentials

1. Open the link above and sign in with your Google account
2. Select or create a Google Cloud project
3. Click **"+ Create Credentials"** at the top
4. Select **"OAuth client ID"**
5. If prompted, click **"Configure Consent Screen"** first:
   - Select **External** → **Create**
   - Fill in App name: `FreeAI`, your email for support and developer contact
   - Click **Save and Continue** (skip Scopes and Test users)
   - Go back to **Credentials**
6. Click **"+ Create Credentials"** → **"OAuth client ID"** again
7. Application type: **Web application**
8. Name: `FreeAI Web`
9. Under **Authorized JavaScript origins**, click **+ Add URI**:
   - Enter: `https://yourdomain.com` (or `http://localhost:3000` for local)
10. Under **Authorized redirect URIs**, click **+ Add URI**:
    - Enter: `https://yourdomain.com/auth/google/callback`
11. Click **Create**
12. Copy the **Client ID** and **Client Secret** from the popup

### GitHub OAuth

**Link to create credentials:** https://github.com/settings/developers

1. Open the link above and sign in with your GitHub account
2. Click **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"**
4. Fill in:
   - Application name: `FreeAI`
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://yourdomain.com/auth/github/callback`
5. Click **"Register application"**
6. Copy the **Client ID** shown on the page
7. Click **"Generate a new client secret"**
8. Copy the **Client Secret** (shown only once!)

### Where to keep the values

Store all credentials in a file named **`.env`** in the root of the project:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
APP_BASE_URL=https://yourdomain.com
```

> **Security**: Never commit `.env` to version control. Use `.env.example` (included in this repo) as a template with placeholder values. The `.gitignore` already excludes `.env`.
