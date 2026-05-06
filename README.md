<h1>
  <img src="readme_files/logo.svg" alt="Marteso logo" width="36">
  Marteso
</h1>

Marteso is a platform which combines iOS CI&CD pipeline with ASO tools. The core is the screenshot pipeline which automatically generates screenshots and valid signed binaries on every GitHub push, basically like Vercel but for iOS apps.

## Demo

App: [marteso.com](https://marteso.com)

## Screenshots

| Admin                            | Landing                              |
| -------------------------------- | ------------------------------------ |
| ![Admin](readme_files/admin.png) | ![Landing](readme_files/landing.png) |

| Main App                          | Docs                           |
| --------------------------------- | ------------------------------ |
| ![Main App](readme_files/app.png) | ![Docs](readme_files/docs.png) |

## Important Features

- Analytics: Shows Impressions, Page Views and Dwonloads by country and date
- Keywords: Tracks your App ranking and discovers new keywords with Ai based on competitors text, category etc.
- Competitors: Tracks your App competitors and gathers intel about them:
  - Summarized Reviews
  - Tracking of Metadata changes
- Suggestions: Suggests better metadata based on tracked keywords and competitors (doesb't work that great yet)
- Monetization: Manages Subscriptios and One time purchases (one time pruchases not implemented yet)
- Versions: Metdata managament with auto translate feature
- More/Gamecenter: Management of game center related stuff like leaderbaords, achievements and challenges (experiment)
- Team: Marteso supports Teams although roles arent fully implemented yet, but you can already invite other users
- MCP Agents support

## Secondary/Specific Features

- Passkeys
- Autonomous mode (planned)
- admin panel
- ios app for notifications

## Architecture

Marteso consists of a main server, web dashboard, admin panel, landing page, docs site, macOS Fastlane worker, and an optional iOS companion app.

- Main Server: Express API, Prisma/Postgres, pg-boss jobs, MCP server
- Web App: Main user dashboard at `/app`
- Admin: Internal admin panel at `/admin`
- Landing: Public website at `/`
- Docs: Docusaurus docs at `/docs`
- Worker: macOS-only Fastlane/Xcode worker for screenshots, frameit, deliver and IPA builds
- iOS App: Companion app for push notifications

## Prerequisites

- Node.js 22+
- PostgreSQL
- macOS + Xcode for Worker/iOS screenshot features
- Fastlane for Worker features
- Apple Developer account for App Store Connect features

## Local Development

```bash
npm install
npm install --prefix web
npm install --prefix admin
npm install --prefix landing
npm install --prefix docs
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

Main server runs on `http://localhost:3100`.

Frontend dev servers:

- Landing: `http://localhost:4321`
- Web App: `http://localhost:5173/app`
- Admin: `http://localhost:5174/admin`

The root `npm run dev` starts the main server, web app and admin panel. Landing and docs can be started separately:

```bash
cd landing && npm run dev
cd docs && npm start -- --port 3030
```

## Development URLs

- Main server: `http://localhost:3100`
- Landing: `http://localhost:4321`
- Web App: `http://localhost:5173/app`
- Admin: `http://localhost:5174/admin`
- Docs: `http://localhost:3030/docs`
- Worker: `http://localhost:3200`

## Environment

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY` for encrypted team settings in production

Optional integrations:

- App Store Connect credentials
- Apple Search Ads credentials
- GitHub OAuth / webhooks
- Fastlane Worker URL + secret
- APNs credentials
- Resend email credentials

Use `.env.example` as the starting point.

## Database

Marteso uses PostgreSQL with Prisma.

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Build

```bash
npm run build
npm run web:build
npm run admin:build
cd landing && npm run build
cd docs && npm run build
```

## Routes

- `/` Landing page
- `/app` Main Marteso dashboard
- `/admin` Admin panel
- `/docs` Documentation
- `/api/*` Backend API
- `/mcp` MCP endpoint

## Repository Structure

- `src/` Main server, API routes, jobs, services and MCP server
- `web/` Main React dashboard
- `admin/` Internal admin panel
- `landing/` Astro marketing site
- `docs/` Docusaurus documentation
- `worker/` macOS Fastlane worker
- `Marteso/` iOS companion app and UI tests
- `prisma/` Database schema and migrations
- `readme_files/` README assets

## 6 parts

### Admin

- React + Shadcn
- link: `/admin`

### Docs

- Technology: Docosaurus
- link: `/docs`

### Landing

- Technology: Astro
- link: `/`

### Main App

- Technology: React (frontend), TypeScript (backend)
- link: `/app`

### Worker

- Technology: TypeScript - manages ios stuff which needs MacOs/Xcode

#### important

- Setup DHCP lease
- Disable mac minis 1 minute auto sleep
- Should be on smae network (security) although there is a secret for communication
- recommended: Atleast 16gb of ram - ImageMagic and iOS simulators need a lot of Ram and should be latest Version of MacOs

### iOS App

- Technology: Swift - Not upodate atm - mostly used for push notifications

## Fastlane Worker

The worker runs on macOS because screenshots, simulators, Xcode builds, fastlane snapshot, frameit and deliver require Xcode/macOS.

Worker endpoints:

- `GET /health`
- `POST /worker/snapshot`
- `POST /worker/build`
- `POST /worker/frameit`
- `POST /worker/deliver`

More details: [`docs/docs/infrastructure/fastlane-worker.md`](docs/docs/infrastructure/fastlane-worker.md)

## Background Jobs

Marteso uses pg-boss for scheduled and manual jobs.

Scheduled jobs:

- keyword tracking
- analytics sync

Manual jobs (should be scheduled but because of Ai costs disabled atm):

- metadata sync
- competitor intel
- localization translation
- keyword discovery / analysis experiments

## Integrations

- App Store Connect API
- GitHub OAuth and webhooks
- Fastlane
- Xcode simulators
- APNs push notifications
- OpenAI / Anthropic for AI suggestions and analysis
- Ollama (experimental)
- MCP server for AI agent access

## Security

Do not commit `.env`, Apple private keys, certificates, provisioning profiles, APNs keys or signing secrets. Production should set `JWT_SECRET` and `ENCRYPTION_KEY` explicitly.

## Known Notes

- Root `npm run dev` does not start landing/docs.
- Worker features require macOS, Xcode and simulators.
- Some App Store Connect features need valid team credentials and app access.
- Game Center and autonomous features are experimental.

## Project Status

Marteso is actively developed. Some features are experimental or incomplete:

- autonomous mode
- one-time purchases
- Game Center management
- team roles
- iOS companion app
- docs

## AI transparency

I used AI mainly for debugging Xcode-related code around the screenshots pipeline, and also for parts of the landing page. I also used it for the MCP server, since recreating all web API endpoints again in a different format for the AI is mostly just repetitive busywork.

- Docs - I had no time to write proper docs yet
- iOS app

## Credits

- Main App's Design partly inspired by RevenueCat
- Landing page design partly inspired by Linear and Vercel
- Using Fastlane and Frameit for Screenshot pipeline
