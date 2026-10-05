# PC BASTOS HARVEST MANAGEMENT SYSTEM 2026
## COMPLETE PRODUCTION DEPLOYMENT & DESKTOP INSTALLATION GUIDE

---

## 1. GITHUB REPOSITORY PACKAGING & PUSH

To upload this application to GitHub for version control, collaboration, and continuous deployment:

### Step 1.1: Initialize Git in the Project Root
Open PowerShell or Terminal in `d:\XTRA\HARVEST 2026\HARVEST APP`:
```bash
git init
```

### Step 1.2: Add Files & Make Initial Commit
```bash
git add .
git commit -m "feat: complete production-ready PC Bastos Harvest Management System 2026 with desktop app and auto-sync"
```

### Step 1.3: Link to Your GitHub Repository & Push
```bash
git branch -M main
git remote add origin https://github.com/<YOUR_ORGANIZATION_OR_USERNAME>/harvest-2026.git
git push -u origin main
```

*(The included `.gitignore` ensures that SQLite data files, node_modules, and sensitive secrets are kept safe and not committed).*

---

## 2. CLOUD WEB HOSTING DEPLOYMENT

The system can be deployed to any cloud provider using **Docker**, **PaaS (Render, Railway)**, or a standard **Ubuntu Linux VPS (DigitalOcean, AWS, Linode)**.

---

### Option A: Cloud PaaS (Render / Railway) — *Fastest 1-Click Hosting*

1. **Connect GitHub**: Log in to [Render](https://render.com) or [Railway](https://railway.app) and select **New Web Service** -> **Deploy from GitHub Repo**.
2. **Environment Variables**:
   * `NODE_ENV`: `production`
   * `PORT`: `3000`
   * `JWT_SECRET`: Generate a secure 64-character random string.
   * `DB_PATH`: `/app/data/harvest.sqlite`
3. **Persistent Disk (Important for SQLite)**:
   * Add a Persistent Disk mounted at `/app/data` (e.g., 5GB or 10GB).
4. **Deploy**: The provided `Dockerfile` will automatically build the production image, apply database migrations, and start the application over secure HTTPS (e.g. `https://harvest.pcbastos.org`).

---

### Option B: Linux Cloud VPS (Ubuntu 22.04 / 24.04 LTS)

#### 1. Server Prerequisites
```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git sqlite3 nginx certbot python3-certbot-nginx

# Install PM2 Process Manager globally
sudo npm install -g pm2
```

#### 2. Clone Repository & Install
```bash
cd /var/www
sudo git clone https://github.com/<YOUR_ORGANIZATION_OR_USERNAME>/harvest-2026.git pc-bastos-harvest
cd pc-bastos-harvest

# Install production dependencies
npm ci --only=production

# Seed database / run migrations
npm run migrate
npm run seed
```

#### 3. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Configure Nginx Reverse Proxy & Free SSL Certificate
Edit `/etc/nginx/sites-available/harvest.conf`:
```nginx
server {
    server_name harvest.pcbastos.org; # Replace with your church domain

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable site and acquire free SSL:
```bash
sudo ln -s /etc/nginx/sites-available/harvest.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d harvest.pcbastos.org
```

---

## 3. DESKTOP APPLICATION SETUP ON COLLECTION COMPUTERS

The system includes a dedicated **Electron Desktop Application** designed to be installed on physical laptops/desktops at the church collection desks.

### Desktop App Features:
1. **Embedded Local SQLite Database**: Can run standalone on the computer without any internet connection.
2. **Automated Background Sync Daemon**: Automatically checks every 30 seconds for network connectivity; the instant the machine connects to WiFi/Ethernet/Mobile Hotspot, all offline collected transactions are automatically uploaded to the Central Cloud/LAN Server.
3. **Unique Terminal Hardware Tracking**: Each computer registers its own unique identifier (e.g. `DESK-01`, `DESK-02`, `LAPTOP-CMF`, `ALTAR-DESK`).
4. **Hardware Receipt Printing**: Formatted 80mm receipt printing directly to thermal receipt printers or office laser printers (Ctrl + P).

---

### Step-by-Step Installation on a Collection Computer:

#### Method 1: Running from Application Folder (Simplest for Church Laptops)
1. **Install Node.js LTS**: Download and install [Node.js 20 LTS](https://nodejs.org/) on the collection laptop.
2. **Copy Application Folder or Clone from GitHub**:
   ```bash
   git clone https://github.com/<YOUR_ORGANIZATION_OR_USERNAME>/harvest-2026.git
   cd harvest-2026
   npm install
   ```
3. **Launch Desktop App**:
   * Double-click `scripts/start-desktop.bat` (on Windows) or run:
     ```bash
     npm run desktop
     ```
4. **Set Terminal Identifier**:
   * In the top-right header, click the purple **💻 Terminal Badge** (e.g., `DESK-01`).
   * Enter the **Terminal Code** for that computer (e.g., `DESK-01`, `DESK-02`, `LAPTOP-CYF`).
   * Enter the **Central Cloud Server URL** (e.g., `https://harvest.pcbastos.org` or `http://192.168.1.50:3000` for church local network).
   * Click **Save & Apply Settings**.

---

## 4. POWER OUTAGE & DISASTER RECOVERY PROTOCOL

### How the Multi-Tier Offline Engine Works:
```
┌─────────────────────────────────────────────────────────────┐
│  COLLECTION COMPUTER (PHYSICAL DESK)                        │
│                                                             │
│  [Desk Collector enters payment]                            │
│                  │                                          │
│                  ▼                                          │
│  [Local IndexedDB Outbox + Local SQLite Storage]            │
│  * Transaction recorded with UUID and sequential lock       │
│  * Physical receipt printed immediately                     │
│                                                             │
│  ⚡ SUDDEN POWER OUTAGE OR INTERNET LOSS?                   │
│  ---------------------------------------------------------  │
│  100% Data Integrity Guaranteed:                            │
│  - No data is stored only in RAM.                           │
│  - SQLite WAL mode and IndexedDB commit synchronously.      │
│                                                             │
│  🔌 POWER / INTERNET RESTORED:                              │
│  ---------------------------------------------------------  │
│  - Background Sync Worker awakens automatically (every 30s) │
│  - Pushes all queued outbox records to the Central Server   │
│  - Server applies idempotent deduplication                  │
│  - Status pill turns 🟢 Online and shows "Last Synced"      │
└─────────────────────────────────────────────────────────────┘
```

### Emergency 1-Click System Backup:
* From the **Backup & Recovery** tab (`view-backup`) or the Admin panel, administrators can click:
  `📦 Export Complete System Snapshot (JSON)`
* This downloads an encrypted, portable JSON snapshot of every table in the church database in under 2 seconds.
* In the event of total hardware destruction, a new computer can be set up and the database restored in 1 click using `📥 Restore Snapshot`.

---

## 5. ROLES & DEMO CREDENTIALS

| Role | Username | Default Password | Authorized Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin123!` | Full church-wide control, config & approvals |
| **Group Fin Secretary (CMF)** | `cmf_fin_sec` | `Cmf1234!` | Scoped to CMF members and accounts only |
| **Desk Collector** | `collector1` | `Collector123!` | Collection desks & payment entries |
| **Cash Verifier** | `verifier1` | `Verifier123!` | Two-party cash verification & sign-off |
