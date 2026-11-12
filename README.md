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

## Adding Models and Router/MCP Configuration

### Adding AI Models

FreeAI connects to locally installed Ollama models. To add models:

1. **Install Ollama** on your server: https://ollama.com/download
2. **Pull models** you want to use:
   ```bash
   ollama pull llama3.2
   ollama pull qwen2.5
   ollama pull deepseek-r1
   ollama pull gemma3
   ```
3. **Configure Ollama URL** in `.env` (if not default):
   ```env
   OLLAMA_URL=http://127.0.0.1:11434
   ```
4. FreeAI automatically detects installed models via Ollama's `/api/tags` endpoint
5. Users can select up to 3 models from the available list

### Router Configuration (Optional)

If you're behind a reverse proxy (nginx, Caddy, etc.), configure:

```env
# In .env
APP_BASE_URL=https://free.prostudio.my

# For nginx reverse proxy:
# proxy_pass http://127.0.0.1:3000;
# proxy_set_header Host $host;
# proxy_set_header X-Forwarded-Proto $scheme;
```

### MCP (Model Context Protocol) Integration

FreeAI supports MCP for extending model capabilities. To configure:

1. Set up an MCP server on your infrastructure
2. Configure the MCP endpoint in your environment
3. FreeAI will connect to MCP servers for enhanced tool use

> **Note**: MCP integration requires additional configuration depending on your MCP server implementation. Refer to the MCP documentation for your specific server.

## Server Deployment Requirements

### Minimum Server Requirements
- **Node.js**: >= 22.0.0 (LTS recommended)
- **RAM**: 512MB minimum (1GB+ recommended)
- **Storage**: 100MB for app + database growth
- **OS**: Linux, macOS, or Windows (Linux recommended for production)

### Required Software
- Node.js 22+ (https://nodejs.org/)
- npm (included with Node.js)
- Ollama (https://ollama.com/download) — for local AI models
- (Optional) MariaDB/MySQL — if using DB_DRIVER=mariadb

### Environment Variables (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `DB_DRIVER` | Database type | `sqlite` or `mariadb` |
| `PORT` | Server port | `3000` |
| `APP_BASE_URL` | Your domain URL | `https://free.prostudio.my` |
| `SMTP_HOST` | SMTP server | `smtp.hostinger.com` |
| `SMTP_PORT` | SMTP port | `465` or `587` |
| `SMTP_SECURE` | Use SSL/TLS | `true` or `false` |
| `SMTP_USER` | SMTP username | `noreply@yourdomain.com` |
| `SMTP_PASSWORD` | SMTP password | `your_password` |
| `SMTP_FROM` | From address | `FreeAI <noreply@yourdomain.com>` |

### Environment Variables (Optional — OAuth)
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `OLLAMA_URL` | Ollama API URL (default: `http://127.0.0.1:11434`) |
| `DATA_DIR` | Database storage path (default: `./private-data`) |

### Important Notes
- **Do not commit `.env`** — it contains secrets. Only `.env.example` should be in version control.
- **SQLite database** is stored in `private-data/` — back up this directory regularly.
- **Email verification is mandatory** — users cannot sign in without verifying their email.
- **SMTP must be configured** before registration works. Test with `GET /api/health`.
- **Ollama must be running** on the server for model listing and chat to work.
- **Port 3000** must be accessible or behind a reverse proxy.
- **HTTPS is required** for OAuth callbacks in production.
- **File permissions**: Ensure `private-data/` is not publicly accessible.
- **Process management**: Use PM2, systemd, or Docker to keep the server running.

### Reverse Proxy (Nginx Example)
```nginx
server {
    listen 443 ssl;
    server_name free.prostudio.my;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Running with PM2
```bash
npm install -g pm2
pm2 start server.mjs --name freeai
pm2 save
pm2 startup
```

### Health Check
```bash
curl https://free.prostudio.my/api/health
# Returns: {"ok":true,"storage":"sqlite","emailConfigured":true}
```
