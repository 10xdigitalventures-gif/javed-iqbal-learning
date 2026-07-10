/*
 * watcher.js  -  auto commit/push + auto redeploy on file changes.
 *
 * What it does:
 *   1. Watches the whole project (ignores .git, node_modules, .next, dist, logs, .expo).
 *   2. Waits 60s after the LAST change (debounce) before acting.
 *   3. git add .  ->  git commit  ->  git push   (push skipped if no remote).
 *   4. Restarts ONLY the affected service(s): backend / web / marketplace
 *      by calling deploy.js, which also runs `npm install` if package.json changed.
 *
 * Run standalone:  node automation/watcher.js
 * Run via PM2:      pm2 start ecosystem.config.js --only jil-watcher
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const chokidar = require("chokidar");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const DEBOUNCE_MS = 60 * 1000; // 60 seconds
const SERVICES = ["backend", "web", "marketplace"];

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const line = "[" + new Date().toISOString() + "] " + msg;
  console.log(line);
  try {
    fs.appendFileSync(path.join(LOG_DIR, "watcher.log"), line + "\n");
  } catch (e) {
    /* ignore log write errors */
  }
}

function run(cmd, cwd) {
  log("$ " + cmd);
  try {
    const out = execSync(cmd, { cwd: cwd || ROOT, stdio: "pipe" }).toString();
    if (out.trim()) log(out.trim());
    return { ok: true, out: out };
  } catch (e) {
    const msg = ((e.stdout || "") + "" + (e.stderr || "")).toString();
    log("! command non-zero: " + (msg.trim() || e.message));
    return { ok: false, out: msg };
  }
}

const changed = new Set();
let timer = null;

function schedule(changedPath) {
  const rel = path.relative(ROOT, changedPath).split(path.sep).join("/");
  const top = rel.split("/")[0];
  if (SERVICES.indexOf(top) !== -1) changed.add(top);
  log("change: " + rel);
  if (timer) clearTimeout(timer);
  timer = setTimeout(act, DEBOUNCE_MS);
}

function gitSync() {
  run("git add .");
  // commit is non-zero when there is nothing to commit - that is fine.
  run('git commit -m "auto: local changes ' + new Date().toISOString() + '"');
  const remote = run("git remote").out.trim();
  if (remote) run("git push");
  else log("no git remote configured - skipping push");
}

function deployService(svc) {
  log("deploy -> " + svc);
  const r = spawnSync("node", [path.join(__dirname, "deploy.js"), svc], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) log("! deploy " + svc + " exited with " + r.status);
}

function act() {
  timer = null;
  const services = Array.from(changed);
  changed.clear();
  log("debounce elapsed - acting on: " + (services.join(", ") || "(git only)"));
  gitSync();
  for (const svc of services) deployService(svc);
  log("cycle complete");
}

log("watcher started. root=" + ROOT + " debounce=" + DEBOUNCE_MS + "ms");

chokidar
  .watch(ROOT, {
    ignoreInitial: true,
    ignored: [
      /(^|[/\\])\.git([/\\]|$)/,
      /(^|[/\\])node_modules([/\\]|$)/,
      /(^|[/\\])\.next([/\\]|$)/,
      /(^|[/\\])dist([/\\]|$)/,
      /(^|[/\\])logs([/\\]|$)/,
      /(^|[/\\])\.expo([/\\]|$)/,
    ],
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  })
  .on("add", schedule)
  .on("change", schedule)
  .on("unlink", schedule);
