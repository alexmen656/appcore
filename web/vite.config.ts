import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/app/",
  plugins: [tailwindcss(), react()],
  server: {
    allowedHosts: ["b494-85-127-44-161.ngrok-free.app", "dfaf-46-229-228-35.ngrok-free.app", "78d6-85-127-44-161.ngrok-free.app"],
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        changeOrigin: true,
      },
      "/screenshots": {
        target: "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
