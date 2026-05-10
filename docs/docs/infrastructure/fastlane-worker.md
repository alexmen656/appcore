---
id: fastlane-worker
title: Fastlane Worker
sidebar_position: 1
---

# Fastlane Worker Architecture

## Overview

The Fastlane Worker separates macOS-dependent Fastlane operations (deliver, snapshot, frameit) from the main Marteso server. This allows the main server to run in a datacenter while Fastlane commands execute on a Mac Mini at home, connected via WireGuard VPN.

```
┌─────────────────────────────────────────┐     WireGuard VPN     ┌──────────────────────────┐
│  Datacenter (app.marteso.com)           │◄────────────────────►│  Mac Mini (Home)          │
│                                         │                       │                           │
│  Main Server (:3100)                    │   HTTP over VPN       │  Fastlane Worker (:3200)  │
│  ├── API routes                         │──────────────────────►│  ├── /worker/deliver      │
│  ├── GitHub webhooks                    │                       │  ├── /worker/snapshot     │
│  ├── Scheduler / Jobs                   │◄──────────────────────│  ├── /worker/frameit      │
│  ├── Database (Prisma)                  │   Results + Logs      │  └── /worker/health       │
│  └── Web UI                             │                       │                           │
│                                         │                       │  Requirements:            │
│  GitHub webhooks come here:             │                       │  ├── Xcode + Simulators   │
│  POST /api/github/webhook               │                       │  ├── Fastlane (Ruby gem)  │
│                                         │                       │  ├── Node.js + sharp      │
└─────────────────────────────────────────┘                       └──────────────────────────┘
```

## Setup

### 1. WireGuard VPN

Install WireGuard on both the datacenter server and the Mac Mini.

**Datacenter server** (`/etc/wireguard/wg0.conf`):
```ini
[Interface]
PrivateKey = <server-private-key>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <mac-mini-public-key>
AllowedIPs = 10.0.0.50/32
```

**Mac Mini** (`/etc/wireguard/wg0.conf`):
```ini
[Interface]
PrivateKey = <mac-mini-private-key>
Address = 10.0.0.50/24

[Peer]
PublicKey = <server-public-key>
Endpoint = app.marteso.com:51820
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

Start WireGuard on both machines:
```bash
sudo wg-quick up wg0
```

### 2. Mac Mini (Worker)

```bash
git clone <repo-url> ~/marteso
cd ~/marteso
npm install

export FASTLANE_WORKER_SECRET="your-shared-secret-here"
export FASTLANE_WORKER_PORT=3200  # optional, default 3200

npm run worker
```

Ensure Fastlane is installed:
```bash
brew install fastlane
# or
gem install fastlane
```

### 3. Datacenter Server (Main Server)

Add to your `.env`:
```bash
FASTLANE_WORKER_URL=http://10.0.0.50:3200
FASTLANE_WORKER_SECRET=your-shared-secret-here
```

Then start as usual:
```bash
npm run dev
# or
npm start
```

## How It Works

### When `FASTLANE_WORKER_URL` is set (production)

1. **Fastlane Deliver** — Main server gathers metadata from ASC API, sends locale data as JSON to worker. Worker writes files, runs `fastlane deliver`, returns logs.
2. **Fastlane Snapshot** — On GitHub push webhook, main server tells worker to clone the repo and run `fastlane snapshot`. Worker returns screenshots as base64.
3. **Fastlane Frameit** — Main server sends source images as base64, worker runs `fastlane frameit`, returns framed images.

### When `FASTLANE_WORKER_URL` is NOT set (development)

Everything runs locally — no behavioral change. This is the fallback for development environments.

## Worker API

All endpoints require an `Authorization: Bearer <FASTLANE_WORKER_SECRET>` header.

| Method | Endpoint | Description | Timeout |
|--------|----------|-------------|---------|
| GET | `/health` | Basic health check (no auth) | — |
| GET | `/worker/health` | Detailed health with fastlane version | — |
| POST | `/worker/deliver` | Run fastlane deliver | ~5 min |
| POST | `/worker/snapshot` | Run fastlane snapshot | ~20 min |
| POST | `/worker/frameit` | Run fastlane frameit | ~5 min |

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `FASTLANE_WORKER_URL` | Main Server | Worker base URL (e.g. `http://10.0.0.50:3200`) |
| `FASTLANE_WORKER_SECRET` | Both | Shared authentication secret |
| `FASTLANE_WORKER_PORT` | Worker | Port to listen on (default: `3200`) |

## File Structure

```
src/worker/                    # Worker process (runs on Mac Mini)
  server.ts                    # Express server entry point
  auth.ts                      # Bearer token authentication
  routes.ts                    # Handler for deliver/snapshot/frameit
  fastlane-utils.ts            # Shared utilities (findFastlane, etc.)

src/services/
  worker-client.ts             # HTTP client (used by main server)
  fastlane.ts                  # FastlaneService (delegates to worker when configured)
  frame-screenshots.ts         # frameWithFastlane (delegates to worker when configured)
```

## Running as a Service (Mac Mini)

Create a launchd plist at `~/Library/LaunchAgents/com.marteso.worker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.marteso.worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/alex/marteso/node_modules/.bin/tsx</string>
    <string>/Users/alex/marteso/src/worker/server.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/alex/marteso</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FASTLANE_WORKER_SECRET</key>
    <string>your-shared-secret-here</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/marteso-worker.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/marteso-worker.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.marteso.worker.plist
```
