module.exports = {
  apps: [
    {
      name: "appcore",
      script: "npm",
      args: "run start",
      cwd: "/home/ubuntu/appcore",
      max_memory_restart: "10500M",
      env: {
        NODE_ENV: "production",
      },
      // V8 heap limit is 9216M (NODE_OPTIONS in npm start script).
      // --heapsnapshot-near-heap-limit=1 writes one snapshot before V8 aborts.
      // pm2 max_memory_restart at 10500M is a safety-net; high enough to let
      // the snapshot finish writing (~9GB) before pm2 force-kills.
    },
  ],
};
