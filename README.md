## Marteso

Marteso is a platform which combines iOS CI&CD pipeline with ASO tool. The core is the screenshot pipeline which automatically generates screenshots and valid signed binary on every GitHub push, basically like Vercel but for iOS apps.

## Demo

App: [marteso.com](https://marteso.com)

## 6 parts

- Admin: React + Shadcn
  link: /admin
- Docs: Docosaurus
  link: /docs
- Landing: Astro
  link: /
- Main App: Reac (frontend), TypeScript (backend)
  link: /app
- Worker: TypeScript - manages ios stuff which needs MacOs/Xcode

## important

Setup DHCP lease
Disable mac minis 1 minute auto sleep
Should be on smae network (security) although there is a secret for communication
recommended: Atleast 16gb of ram - ImageMagic and iOS simulators need a lot of Ram and should be latest Version of MacOs

- iOS App: Swift - Not upodate atm - mostly used for push notifications

## AI transparency

I used AI mainly for debugging Xcode-related code around the screenshots pipeline, and also for parts of the landing page. I also used it for the MCP server, since recreating all web API endpoints again in a different format for the AI is mostly just repetitive busywork.

iOS app

## Credits

Main App's Design partly inspired by RevenueCat
Landing page design partly inspired by Linear and Vercel
Using Fastlane and Frameit for Screenshot pipeline
