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
    },
    {
      name: "appcore-admin",
      script: "npm",
      args: "run start:admin",
      cwd: "/home/ubuntu/appcore",
      max_memory_restart: "2000M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
