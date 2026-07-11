// ============================================================
//  PM2 ecosystem - Javed Iqbal Learning Platform
//  Manages all long-running services from ONE file:
//    - jil-backend      NestJS   -> http://127.0.0.1:4000  (API prefix /api)
//    - jil-web          Next.js  -> http://127.0.0.1:3000
//    - jil-marketplace  Next.js  -> http://127.0.0.1:3001
//    - jil-watcher      auto commit/push + auto redeploy on file change
//
//  Portable: the SAME file works on Windows (local) and Linux (Hetzner VPS).
//  Paths are resolved relative to this file, so nothing is hard-coded.
//
//  Usage:
//    pm2 start ecosystem.config.js         # start everything
//    pm2 start ecosystem.config.js --only jil-backend
//    pm2 restart jil-web
//    pm2 logs
//    pm2 save                              # persist across reboots
// ============================================================

const path = require("path");

const ROOT = __dirname;
const nextBin = path.join("node_modules", "next", "dist", "bin", "next");

function log(name, file) {
  return path.join(ROOT, "logs", name + "-" + file + ".log");
}

const common = {
  instances: 1,
  exec_mode: "fork",
  autorestart: true,
  max_restarts: 15,
  min_uptime: "10s",
  max_memory_restart: "700M",
  time: true,
  merge_logs: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: "jil-backend",
      cwd: path.join(ROOT, "backend"),
      script: "dist/main.js",
      env: { NODE_ENV: "production", PORT: 4000 },
      out_file: log("backend", "out"),
      error_file: log("backend", "error"),
    },
    {
      ...common,
      name: "jil-web",
      cwd: path.join(ROOT, "web"),
      script: nextBin,
      args: "start -p 3000",
      env: { NODE_ENV: "production", PORT: 3000 },
      out_file: log("web", "out"),
      error_file: log("web", "error"),
    },
    {
      ...common,
      name: "jil-marketplace",
      cwd: path.join(ROOT, "marketplace"),
      script: nextBin,
      args: "start -p 3001",
      env: { NODE_ENV: "production", PORT: 3001 },
      out_file: log("marketplace", "out"),
      error_file: log("marketplace", "error"),
    },
    {
      ...common,
      name: "jil-git-push",
      cwd: ROOT,
      script: path.join(ROOT, "automation", "auto-git-push.js"),
      max_memory_restart: "300M",
      out_file: log("git-push", "out"),
      error_file: log("git-push", "error"),
    },
  ],
};
