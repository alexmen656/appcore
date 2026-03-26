---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# Marteso Documentation

Marteso is an automated ASO (App Store Optimization) engine that manages metadata, screenshots, and App Store submissions for iOS apps.

## What Marteso does

- **Metadata management** — AI-generated titles, subtitles, descriptions, and keywords for every locale
- **Screenshot automation** — runs `fastlane snapshot` on every GitHub push to capture fresh screenshots
- **Framing** — applies device frames via `fastlane frameit`
- **App Store delivery** — submits metadata and screenshots to App Store Connect via `fastlane deliver`
- **CI/CD pipeline** — triggered by GitHub webhooks, fully automated from push to submission

## Architecture

The system consists of two processes:

| Process | Where it runs | Responsibility |
|---------|--------------|----------------|
| **Main Server** (`:3100`) | Datacenter | API, webhooks, scheduler, database, Web UI |
| **Fastlane Worker** (`:3200`) | Mac Mini (home) | All Fastlane operations requiring macOS + Xcode |

The two are connected over a WireGuard VPN. See [Fastlane Worker](infrastructure/fastlane-worker) for the full setup.

## Quick links

- [Fastlane Worker setup](infrastructure/fastlane-worker)
- [iOS Code Signing (.p12 & mobileprovision)](ios/code-signing)
