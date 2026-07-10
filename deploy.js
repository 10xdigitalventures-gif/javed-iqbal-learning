const { exec } = require("child_process");

console.log("Running Deployment...");

exec("pm2 restart backend && pm2 restart web", (err, stdout, stderr) => {

    console.log(stdout);

    if (stderr) console.log(stderr);

    if (err) console.log(err);

    console.log("Deployment Complete");

});