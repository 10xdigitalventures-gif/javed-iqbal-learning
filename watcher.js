const chokidar = require("chokidar");
const { exec } = require("child_process");

const WATCH_PATH = ".";

// Ignore folders
const ignored = [
  "**/.git/**",
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/coverage/**",
  "**/logs/**",
  "**/android/build/**",
  "**/ios/build/**"
];

let timer = null;
let isDeploying = false;

console.log("==================================");
console.log(" Auto Deployment Watcher Started");
console.log(" Waiting for file changes...");
console.log("==================================");

const watcher = chokidar.watch(WATCH_PATH, {
  ignored,
  ignoreInitial: true,
  persistent: true
});

watcher.on("all", (event, path) => {

  console.log(`[${event}] ${path}`);

  clearTimeout(timer);

  timer = setTimeout(() => {

    if (isDeploying) return;

    isDeploying = true;

    console.log("\nStarting Auto Deployment...\n");

    exec(`
git add .
git commit -m "Auto Update"
git push
node deploy.js
`, { shell: true }, (error, stdout, stderr) => {

      console.log(stdout);

      if (stderr)
        console.log(stderr);

      if (error)
        console.log(error);

      console.log("\nDeployment Finished\n");

      isDeploying = false;

    });

  }, 60000); // 1 Minute Wait

});

process.on("SIGINT", () => {

  console.log("Watcher Stopped");

  watcher.close();

  process.exit();

});