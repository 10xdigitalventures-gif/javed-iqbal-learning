/*
 * auto-git-push.js  -  simple automatic commit + push.
 *
 * 10 minutes after the LAST file change it runs (in the project root):
 *     git add .
 *     git commit -m "code updated"
 *     git push
 *
 * Assumes the git remote is already configured (origin + branch upstream).
 * Ignores: .git, node_modules, .next, dist, logs, .expo.
 * Only commits when something actually changed.
 *
 * Run standalone:  node automation/auto-git-push.js
 * Run via PM2:      pm2 start ecosystem.config.js --only jil-git-push
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chokidar = require("chokidar");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const line = "[" + new Date().toISOString() + "] " + msg;
  console.log(line);
  try {
    fs.appendFileSync(path.join(LOG_DIR, "git-push.log"), line + "\n");
  } catch (e) {}
}

function run(cmd) {
  log("$ " + cmd);
  try {
    const out = execSync(cmd, { cwd: ROOT, stdio: "pipe" }).toString();
    if (out.trim()) log(out.trim());
    return { ok: true, out: out };
  } catch (e) {
    const msg = ((e.stdout || "") + "" + (e.stderr || "")).toString();
    log("! " + (msg.trim() || e.message));
    return { ok: false, out: msg };
  }
}

let timer = null;

function schedule(changedPath) {
  const rel = path.relative(ROOT, changedPath).split(path.sep).join("/");
  log("change: " + rel + "  (push in 10 min if idle)");
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushNow, DEBOUNCE_MS);
}

function pushNow() {
  timer = null;
  run("git add .");
  const status = run("git status --porcelain").out.trim();
  if (!status) {
    log("nothing to commit - skipping");
    return;
  }
  run('git commit -m "code updated"');
  const pushed = run("git push");
  log(pushed.ok ? "pushed to remote." : "push failed - see message above.");
}

log("auto-git-push started. root=" + ROOT + " debounce=10min");

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
