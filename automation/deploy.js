/*
 * deploy.js  -  build + (re)start services through PM2.
 *
 * Usage:
 *   node deploy.js all
 *   node deploy.js backend
 *   node deploy.js web
 *   node deploy.js marketplace
 *
 * For each service:
 *   1. If package.json / package-lock.json changed since last deploy -> npm install (or npm ci).
 *   2. Build:
 *        backend      -> prisma generate  ->  prisma migrate deploy (non-fatal)  ->  npm run build
 *        web / market -> npm run build
 *   3. pm2 startOrReload ecosystem.config.js for that app, then pm2 save.
 *
 * A tiny state file (logs/.deploy-state.json) remembers package hashes so
 * npm install only runs when dependencies actually change.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const STATE = path.join(LOG_DIR, ".deploy-state.json");
const ECOSYSTEM = path.join(ROOT, "ecosystem.config.js");

const PM2_NAME = {
  backend: "jil-backend",
  web: "jil-web",
  marketplace: "jil-marketplace",
};

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const line = "[" + new Date().toISOString() + "] " + msg;
  console.log(line);
  try {
    fs.appendFileSync(path.join(LOG_DIR, "deploy.log"), line + "\n");
  } catch (e) {
    /* ignore */
  }
}

// fatal run: throws on failure
function run(cmd, cwd) {
  log("$ " + cmd + "   (cwd: " + (cwd || ROOT) + ")");
  execSync(cmd, { cwd: cwd || ROOT, stdio: "inherit" });
}

// safe run: logs failure but does not throw
function runSafe(cmd, cwd) {
  try {
    run(cmd, cwd);
    return true;
  } catch (e) {
    log("! non-fatal failure: " + cmd + " -> " + e.message);
    return false;
  }
}

function hashFile(p) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex");
  } catch (e) {
    return "";
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveState(s) {
  try {
    fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
  } catch (e) {
    /* ignore */
  }
}

function needInstall(svc, state) {
  const dir = path.join(ROOT, svc);
  const cur =
    hashFile(path.join(dir, "package.json")) +
    ":" +
    hashFile(path.join(dir, "package-lock.json"));
  const key = svc + ":pkg";
  if (state[key] !== cur) {
    state[key] = cur;
    return true;
  }
  return false;
}

function npmInstall(dir) {
  const hasLock = fs.existsSync(path.join(dir, "package-lock.json"));
  run(hasLock ? "npm ci" : "npm install", dir);
}

function deployBackend(state) {
  const dir = path.join(ROOT, "backend");
  if (needInstall("backend", state)) npmInstall(dir);
  run("npx prisma generate", dir);
  runSafe("npx prisma migrate deploy", dir); // safe: skips if DB unreachable / already applied
  run("npm run build", dir);
}

function deployNext(svc, state) {
  const dir = path.join(ROOT, svc);
  if (needInstall(svc, state)) npmInstall(dir);
  run("npm run build", dir);
}

function pm2Reload(svc) {
  // startOrReload = start if not running, zero-downtime reload if already running
  run('pm2 startOrReload "' + ECOSYSTEM + '" --only ' + PM2_NAME[svc] + " --update-env");
  runSafe("pm2 save");
}

function deployOne(svc, state) {
  log("===== deploy " + svc + " =====");
  if (svc === "backend") deployBackend(state);
  else deployNext(svc, state);
  pm2Reload(svc);
  log("done: " + svc);
}

const arg = (process.argv[2] || "all").toLowerCase();
const targets = arg === "all" ? ["backend", "web", "marketplace"] : [arg];
const state = loadState();

for (const t of targets) {
  if (!PM2_NAME[t]) {
    log("unknown service: " + t + " (use backend | web | marketplace | all)");
    continue;
  }
  try {
    deployOne(t, state);
    saveState(state);
  } catch (e) {
    log("! deploy " + t + " FAILED: " + e.message);
  }
}
log("deploy finished");
