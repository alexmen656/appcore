---
id: code-signing
title: iOS Code Signing
sidebar_position: 1
---

# iOS Code Signing — .p12 & .mobileprovision

Marteso needs a Signing Certificate (`.p12`) and a Provisioning Profile (`.mobileprovision`) to build a signed IPA after every commit.

---

## 1. Signing Certificate (.p12)

### Why can't I export "Apple Distribution"?

This is the most common issue. A certificate can only be exported as `.p12` if the **private key** lives in your Mac's Keychain.

**How to recognize it in Keychain Access:**
- Certificate **with** private key: has an arrow/triangle you can expand → **exportable**
- Certificate **without** private key: no arrow → **not exportable** — because it was created on a different Mac

### Solution: Create a new certificate from your Mac

The certificate must be created with a CSR from your Mac so the private key ends up there.

**Step 1: Create a CSR**

1. Open **Keychain Access** on your Mac
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
3. Enter your email address (the one on your Apple account)
4. Select "Saved to disk" → **Continue** → save the file (`CertificateSigningRequest.certSigningRequest`)

**Step 2: Create the certificate in the Developer Portal**

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles → Certificates → +**
3. Choose **Apple Distribution** (for App Store & TestFlight)
4. Upload your CSR file → **Continue**
5. Download the certificate (`.cer`)
6. Double-click the `.cer` to install it in Keychain

**Step 3: Export as .p12**

1. Open **Keychain Access → My Certificates**
2. Find "Apple Distribution: ..." — it should now have an arrow (expandable)
3. Right-click → **Export "Apple Distribution: ..."**
4. Format: **Personal Information Exchange (.p12)**
5. Set a password (don't leave it empty!)

:::tip Certificate on another Mac?
The owner of the old Mac must export the `.p12` there and send it to you. Alternatively, revoke the old certificate in the Developer Portal and create a new one from your Mac.
:::

---

## 2. Provisioning Profile (.mobileprovision)

The Provisioning Profile links your app bundle (e.g. `com.example.myapp`) with the certificate and your team.

### Which type do I need?

| Purpose | Profile type |
|---------|-------------|
| App Store / TestFlight upload | **App Store Distribution** |
| Ad-hoc on specific devices | **Ad Hoc** |
| Local testing only | **Development** |

Marteso uses `export_method("app-store")` by default → you need **App Store Distribution**.

### Create a profile

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles → Profiles → +**
3. Choose **App Store** under "Distribution"
4. Select your App ID (must match your bundle identifier, e.g. `com.example.myapp`)
5. Select the certificate you just created
6. Give it a name → **Generate** → **Download**

The file ends in `.mobileprovision`.

---

## 3. Apple Team ID

The Team ID is a 10-character alphanumeric ID (e.g. `ABC123XYZ1`).

**Where to find it:**
- [developer.apple.com/account](https://developer.apple.com/account) → top right under the account name, or under **Membership Details**
- In Xcode: **Project → Signing & Capabilities → Team** → click the team, the ID is shown below

---

## 4. Upload to Marteso

1. Open Marteso → **App Settings** (select your app in the sidebar)
2. Scroll to **iOS Code Signing**
3. Upload your `.p12`, password, `.mobileprovision`, and Team ID
4. Click **Save Credentials**

Marteso will automatically build a signed IPA on the next GitHub push.

---

## Common errors

| Error | Cause |
|-------|-------|
| Export option greyed out in Keychain | No private key on this Mac → recreate the certificate with a CSR |
| `errSecInternalComponent` | Wrong or empty `.p12` password |
| `No profiles for ... were found` | Profile does not match the bundle identifier |
| `Certificate ... is not installed` | Certificate and profile don't match (e.g. different teams) |
| `DEVELOPMENT_TEAM not set` | Team ID missing or doesn't match the profile |
| `ambiguous` / multiple identities | Multiple distribution certs in Keychain — select the correct one explicitly |

---

## Tip: Fastlane Match

For teams with multiple developers or build servers, consider [fastlane match](https://docs.fastlane.tools/actions/match/). Match stores certificates and profiles encrypted in a Git repo or S3 and syncs them automatically across all machines.
