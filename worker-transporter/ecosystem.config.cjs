const path = require("path");
const dotenv = require("dotenv");

module.exports = {
  apps: [
    {
      name: "appcore-transporter",
      script: "src/server.ts",
      interpreter: path.join(__dirname, "node_modules/.bin/tsx"),
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
        ...dotenv.config({ path: path.join(__dirname, ".env") }).parsed ?? {},
      },
    },
  ],
};
