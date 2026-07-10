# Local Windows Server + Auto-Deploy Setup

Production-quality setup to run the whole platform from a Windows PC as a local
server, with automatic startup, auto commit/push, auto redeploy, Nginx reverse
proxy, and SSL. The **same** setup migrates to a Hetzner VPS by only changing an
A record.

**Project root:** `E:\Programs\javed-iqbal-learning-platform\consultant-platform`

| Service | Folder | Port | Public URL |
|---|---|---|---|
| Web (Next.js) | `web` | 3000 | `app.yourdomain.com` |
| Backend (NestJS) | `backend` | 4000 | `api.yourdomain.com` (prefix `/api`) |
| Marketplace (Next.js) | `marketplace` | 3001 | `marketplace.yourdomain.com` |
| Mobile (Expo) | `mobile` | - | not a server (builds to app stores) |

> Replace `yourdomain.com` with your real domain everywhere.

---

## 0. Files delivered (already inside the project)

```
consultant-platform/
  ecosystem.config.js          # PM2 - all services in one file
  .gitignore                   # ignores node_modules/.next/dist/logs/.env
  automation/
    package.json               # chokidar dependency for the watcher
    watcher.js                 # 60s debounce -> git push -> redeploy affected service
    deploy.js                  # npm install (if needed) -> build -> pm2 reload
  nginx/
    windows-local.conf         # reverse proxy for Windows nginx
    vps-linux.conf             # same routing for Hetzner VPS
  windows/
    start-server.bat           # boots PM2 + Nginx (used by Task Scheduler)
    install-startup-task.ps1   # registers the startup Scheduled Task
    firewall-rules.ps1         # opens ports 80/443 (+ optional 3000/4000/3001)
  logs/                        # all PM2 + watcher + deploy logs land here
```

---

## 1. Prerequisites (install once)

1. **Node.js LTS (20.x)** - https://nodejs.org  (verify: `node -v`, `npm -v`)
2. **Git** - https://git-scm.com  (verify: `git --version`)
3. **PM2** (global):
   ```powershell
   npm install -g pm2
   ```
4. **Nginx for Windows** - https://nginx.org/en/download.html
   - Unzip to `C:\nginx` (so `C:\nginx\nginx.exe` exists).
5. **win-acme** (Let's Encrypt client for Windows) - https://www.win-acme.com
   - Unzip to `C:\win-acme` (only needed for the Let's Encrypt SSL option).

---

## 2. First-time project setup

Open PowerShell in the project root:

```powershell
cd E:\Programs\javed-iqbal-learning-platform\consultant-platform

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy      # applies existing migrations to your DB
npm run build
cd ..

# Web
cd web
npm install
npm run build
cd ..

# Marketplace
cd marketplace
npm install
npm run build
cd ..

# Automation (watcher deps)
cd automation
npm install
cd ..
```

> Make sure each service has its `.env` file in place (backend `.env`, web/marketplace
> `.env.local`) before building. These are git-ignored.

---

## 3. Start everything with PM2

```powershell
cd E:\Programs\javed-iqbal-learning-platform\consultant-platform
pm2 start ecosystem.config.js
pm2 save                # remembers the process list for reboot
pm2 status              # should show: jil-backend, jil-web, jil-marketplace, jil-watcher (online)
pm2 logs                # live logs (Ctrl+C to exit)
```

Handy commands:
```powershell
pm2 restart jil-web
pm2 restart all
pm2 stop jil-marketplace
pm2 logs jil-backend
pm2 flush               # clear logs
```

---

## 4. Run automatically at Windows startup

Two options - **Option A (Task Scheduler)** is recommended and included.

### Option A - Task Scheduler (recommended)
Run in an **elevated** PowerShell (Run as Administrator):
```powershell
cd E:\Programs\javed-iqbal-learning-platform\consultant-platform\windows
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-startup-task.ps1
```
This registers task **JIL-Platform-Startup** that runs `start-server.bat` at every
boot (as SYSTEM, highest privileges) which does `pm2 resurrect` + starts Nginx.

Test immediately (without rebooting):
```powershell
Start-ScheduledTask -TaskName "JIL-Platform-Startup"
```

### Option B - PM2 as a true Windows Service (most stable, alternative)
If you prefer PM2 running as a real Windows Service instead of Task Scheduler:
```powershell
npm install -g @jessety/pm2-installer   # or the pm2-installer package
# follow its README: it installs "PM2" as a Windows service that auto-resurrects
pm2 save
```
Use **either** Option A **or** Option B, not both.

---

## 5. Windows Firewall

Run in an **elevated** PowerShell:
```powershell
cd E:\Programs\javed-iqbal-learning-platform\consultant-platform\windows
Set-ExecutionPolicy -Scope Process Bypass -Force
.\firewall-rules.ps1
```
Opens inbound TCP **80** and **443** (and optionally 3000/4000/3001 for LAN debugging).

---

## 6. Router Port Forwarding (80 + 443)

So the public internet can reach your PC:

1. Give your PC a **static LAN IP** (e.g. `192.168.1.50`):
   - Router DHCP reservation for your PC's MAC, **or**
   - Windows: Settings > Network > Adapter > IPv4 > set manual IP/gateway/DNS.
2. Log into your router admin (usually `http://192.168.1.1`).
3. Find **Port Forwarding / Virtual Server** and add:

   | Name | External Port | Internal IP | Internal Port | Protocol |
   |---|---|---|---|---|
   | HTTP | 80 | 192.168.1.50 | 80 | TCP |
   | HTTPS | 443 | 192.168.1.50 | 443 | TCP |

4. Save + reboot router if required.
5. Confirm from outside (mobile data, not WiFi): visit `http://YOUR_PUBLIC_IP`.

> Find your public IP: https://ifconfig.me  or  `curl ifconfig.me`
> Some ISPs use **CGNAT** (no real public IP). If port 80/443 never open from
> outside, use a **Cloudflare Tunnel** (see section 9) which needs no port forwarding.

---

## 7. Domain DNS setup (A record)

At your domain registrar / DNS provider, create records pointing to your public IP:

| Type | Name | Value |
|---|---|---|
| A | `app` | YOUR_PUBLIC_IP |
| A | `api` | YOUR_PUBLIC_IP |
| A | `marketplace` | YOUR_PUBLIC_IP |

(Or one wildcard `A  *  YOUR_PUBLIC_IP`.)

**If your IP is dynamic (changes)** use Dynamic DNS:
- **DuckDNS**: create `yoursub.duckdns.org`, install their Windows updater (scheduled
  task) so the IP stays current. Then CNAME `app` -> `yoursub.duckdns.org`.
- **No-IP**: install the No-IP DUC Windows client; same idea.
- **Cloudflare**: keep an A record and run a small cron/ddclient to PATCH the record,
  or use Cloudflare Tunnel (section 9) and forget IPs entirely.

---

## 8. Nginx configuration

1. Copy `nginx/windows-local.conf` to `C:\nginx\conf\sites\javed-iqbal.conf`
   (create the `sites` folder).
2. Edit `C:\nginx\conf\nginx.conf`, and inside the `http { ... }` block add:
   ```nginx
   include sites/javed-iqbal.conf;
   ```
3. Replace `yourdomain.com` in the conf with your real domain.
4. Test + start:
   ```powershell
   C:\nginx\nginx.exe -t          # test config
   C:\nginx\nginx.exe             # start
   C:\nginx\nginx.exe -s reload   # reload after edits
   C:\nginx\nginx.exe -s stop     # stop
   ```

---

## 9. SSL - choose ONE option

### Option A - Let's Encrypt via win-acme (free, auto-renew)
1. Make sure port 80 is forwarded and DNS resolves to your IP.
2. Create `C:\nginx\webroot` (used for the http-01 challenge; already referenced in the conf).
3. Run win-acme:
   ```powershell
   cd C:\win-acme
   .\wacs.exe
   ```
   - Choose "create certificate (full options)".
   - Validation: **http-01** using the webroot `C:\nginx\webroot`.
   - Domains: `app.yourdomain.com`, `api.yourdomain.com`, `marketplace.yourdomain.com`.
   - Store: **PEM files** to `C:\certs\<domain>\` (fullchain.pem + privkey.pem).
4. win-acme installs a scheduled task that auto-renews every ~60 days.
5. Reload nginx: `C:\nginx\nginx.exe -s reload`.

### Option B - Cloudflare (easiest, recommended for dynamic IP)
1. Move your domain's nameservers to Cloudflare.
2. Set the A records (section 7) with the **orange cloud (proxied)** ON.
3. SSL/TLS mode: **Full (strict)**.
4. Create a **Cloudflare Origin Certificate** (SSL/TLS > Origin Server), save the
   cert + key to `C:\certs\<domain>\fullchain.pem` and `privkey.pem`.
5. Reload nginx. Cloudflare terminates public SSL and also hides your real IP.

### Option C - Cloudflare Tunnel (no port forwarding / CGNAT-proof)
```powershell
# install cloudflared, then:
cloudflared tunnel login
cloudflared tunnel create jil
# map hostnames -> local ports in the tunnel config:
#   app.yourdomain.com          -> http://localhost:3000
#   api.yourdomain.com          -> http://localhost:4000
#   marketplace.yourdomain.com  -> http://localhost:3001
cloudflared tunnel run jil
```
With a tunnel you can skip Nginx, router port forwarding, and public IP entirely.

---

## 10. Auto commit/push + auto redeploy (watcher)

The watcher runs as the `jil-watcher` PM2 process (started by `ecosystem.config.js`).

What it does on any file change:
1. Waits **60s** after the last change (debounce).
2. Ignores `.git`, `node_modules`, `.next`, `dist`, `logs`, `.expo`.
3. `git add .` -> `git commit` -> `git push` (push skipped if no git remote).
4. Calls `deploy.js` **only for the changed service** (`backend`/`web`/`marketplace`):
   - if that service's `package.json`/lock changed -> `npm install` (or `npm ci`)
   - backend: `prisma generate` -> `prisma migrate deploy` -> `npm run build`
   - web/marketplace: `npm run build`
   - then `pm2 startOrReload` that one app (zero-downtime) + `pm2 save`.

### Enable git push (optional but recommended)
```powershell
cd E:\Programs\javed-iqbal-learning-platform\consultant-platform
git init                       # if not already a repo
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git add . && git commit -m "initial"
git push -u origin main
```
Use a GitHub Personal Access Token or SSH key so `git push` runs without prompts.
If you never add a remote, the watcher still commits locally and redeploys.

### Manual deploy anytime
```powershell
node automation/deploy.js all
node automation/deploy.js backend
node automation/deploy.js web
node automation/deploy.js marketplace
```

---

## 11. Logs

Everything lands in `logs/`:
```
logs/backend-out.log      logs/backend-error.log
logs/web-out.log          logs/web-error.log
logs/marketplace-out.log  logs/marketplace-error.log
logs/watcher-out.log      logs/watcher.log
logs/deploy.log           logs/startup.log
```
Live tail: `pm2 logs`  or  `Get-Content logs\watcher.log -Wait`.

---

## 12. End-to-end test checklist

1. `pm2 status` -> all 4 processes **online**.
2. Local direct:
   - http://localhost:3000  (web)
   - http://localhost:4000/api  (backend)
   - http://localhost:3001  (marketplace)
3. Through Nginx (edit `C:\Windows\System32\drivers\etc\hosts` to test before DNS):
   ```
   127.0.0.1 app.yourdomain.com api.yourdomain.com marketplace.yourdomain.com
   ```
   Then open `https://app.yourdomain.com` etc.
4. From outside (mobile data): open each `https://` URL -> valid padlock (SSL OK).
5. Watcher test: edit any file under `web/`, wait ~60s, check `logs/watcher.log`
   -> should show commit (+push) and `deploy -> web`, then `pm2 status` shows jil-web restarted.
6. Reboot the PC -> after login/startup everything comes back automatically.

---

## 13. Migrate to Hetzner VPS later (no code change)

1. Create an Ubuntu VPS on Hetzner. Install Node LTS, Git, PM2, Nginx, certbot.
2. Pull the repo (or copy the ZIP) to `/opt/consultant-platform`.
3. `npm install` + build in each service (same as section 2).
4. `pm2 start ecosystem.config.js && pm2 save && pm2 startup`
   (the `pm2 startup` command prints one line to run for boot persistence).
5. Copy `nginx/vps-linux.conf` -> `/etc/nginx/sites-available/` and enable it
   (see the header of that file). Replace `yourdomain.com`.
6. `sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d marketplace.yourdomain.com`
7. **The only real switch:** change each **A record** from your home IP to the
   VPS IP. DNS propagates and traffic now hits the VPS. Nothing in the app changes.

Because `ecosystem.config.js`, `watcher.js`, `deploy.js`, and the nginx routing are
all path-relative and platform-agnostic, the same automation runs identically on the VPS.
