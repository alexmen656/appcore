const path = require("path");
const dotenv = require("dotenv");

const env = dotenv.config({ path: path.join(__dirname, ".env") }).parsed ?? {};

module.exports = {
  apps: [
    {
      name: "appcore-worker",
      script: "src/server.ts",
      interpreter: path.join(__dirname, "node_modules/.bin/tsx"),
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
        ...env,
      },
    },
  ],
};
