---
id: ui-testing
title: UI Testing & Screenshots
sidebar_position: 2
---

# UI Testing & Screenshots

Marteso automatically captures App Store screenshots on every GitHub push by running your Xcode UI tests on the Mac Mini worker. This guide walks through everything you need to set up — the UI test file, the SnapshotHelper, and the `config.json` that controls devices, languages, and framing.

---

## How it works

```
GitHub push
    │
    ▼
Marteso webhook receiver
    │  clones your repo
    ▼
Mac Mini Worker
    │  writes language.txt / locale.txt
    │  runs: xcodebuild … build test
    ▼
SnapshotHelper.swift
    │  reads language.txt → sets -AppleLanguages on the app
    │  calls snapshot("01_Home") → saves PNG to cache dir
    ▼
Worker collects PNGs → returns to Marteso
    │
    ▼
Marteso frames + stores screenshots
```

---

## 1. Project structure

Your Xcode project needs a UI Test target with these files:

```
YourApp/
├── YourApp.xcodeproj
└── YourAppUITests/
    ├── YourAppUITests.swift    ← your test cases (snapshot calls)
    ├── SnapshotHelper.swift    ← fastlane helper (copy as-is)
    └── config.json             ← marteso config (devices, languages, framing)
```

:::tip Where to put config.json
`config.json` must live inside the UI test target folder next to your test file, **not** in the app target.
:::

---

## 2. SnapshotHelper.swift

Copy this file verbatim into your UI test target. Do not modify it — it is the standard fastlane SnapshotHelper that Marteso relies on.

```swift
//
//  SnapshotHelper.swift
//  (fastlane — SnapshotHelperVersion [1.30])
//

import Foundation
import XCTest

@MainActor
func setupSnapshot(_ app: XCUIApplication, waitForAnimations: Bool = true) {
    Snapshot.setupSnapshot(app, waitForAnimations: waitForAnimations)
}

@MainActor
func snapshot(_ name: String, waitForLoadingIndicator: Bool) {
    if waitForLoadingIndicator {
        Snapshot.snapshot(name)
    } else {
        Snapshot.snapshot(name, timeWaitingForIdle: 0)
    }
}

@MainActor
func snapshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 20) {
    Snapshot.snapshot(name, timeWaitingForIdle: timeout)
}

enum SnapshotError: Error, CustomDebugStringConvertible {
    case cannotFindSimulatorHomeDirectory
    case cannotRunOnPhysicalDevice

    var debugDescription: String {
        switch self {
        case .cannotFindSimulatorHomeDirectory:
            return "Couldn't find simulator home location. Please, check SIMULATOR_HOST_HOME env variable."
        case .cannotRunOnPhysicalDevice:
            return "Can't use Snapshot on a physical device."
        }
    }
}

@objcMembers
@MainActor
open class Snapshot: NSObject {
    static var app: XCUIApplication?
    static var waitForAnimations = true
    static var cacheDirectory: URL?
    static var screenshotsDirectory: URL? {
        return cacheDirectory?.appendingPathComponent("screenshots", isDirectory: true)
    }
    static var deviceLanguage = ""
    static var currentLocale = ""

    open class func setupSnapshot(_ app: XCUIApplication, waitForAnimations: Bool = true) {
        Snapshot.app = app
        Snapshot.waitForAnimations = waitForAnimations
        do {
            let cacheDir = try getCacheDirectory()
            Snapshot.cacheDirectory = cacheDir
            setLanguage(app)
            setLocale(app)
            setLaunchArguments(app)
        } catch let error {
            NSLog(error.localizedDescription)
        }
    }

    class func setLanguage(_ app: XCUIApplication) {
        guard let cacheDirectory = self.cacheDirectory else { return }
        let path = cacheDirectory.appendingPathComponent("language.txt")
        do {
            let trimCharacterSet = CharacterSet.whitespacesAndNewlines
            deviceLanguage = try String(contentsOf: path, encoding: .utf8)
                .trimmingCharacters(in: trimCharacterSet)
            app.launchArguments += ["-AppleLanguages", "(\(deviceLanguage))"]
        } catch {
            NSLog("Couldn't detect/set language...")
        }
    }

    class func setLocale(_ app: XCUIApplication) {
        guard let cacheDirectory = self.cacheDirectory else { return }
        let path = cacheDirectory.appendingPathComponent("locale.txt")
        do {
            let trimCharacterSet = CharacterSet.whitespacesAndNewlines
            currentLocale = try String(contentsOf: path, encoding: .utf8)
                .trimmingCharacters(in: trimCharacterSet)
        } catch {
            NSLog("Couldn't detect/set locale...")
        }
        if currentLocale.isEmpty && !deviceLanguage.isEmpty {
            currentLocale = Locale(identifier: deviceLanguage).identifier
        }
        if !currentLocale.isEmpty {
            app.launchArguments += ["-AppleLocale", "\"\(currentLocale)\""]
        }
    }

    class func setLaunchArguments(_ app: XCUIApplication) {
        guard let cacheDirectory = self.cacheDirectory else { return }
        let path = cacheDirectory.appendingPathComponent("snapshot-launch_arguments.txt")
        app.launchArguments += ["-FASTLANE_SNAPSHOT", "YES", "-ui_testing"]
        do {
            let launchArguments = try String(contentsOf: path, encoding: .utf8)
            let regex = try NSRegularExpression(pattern: "(\\\".+?\\\"|\\S+)", options: [])
            let matches = regex.matches(
                in: launchArguments, options: [],
                range: NSRange(location: 0, length: launchArguments.count)
            )
            let results = matches.map { (launchArguments as NSString).substring(with: $0.range) }
            app.launchArguments += results
        } catch {
            NSLog("Couldn't detect/set launch_arguments...")
        }
    }

    open class func snapshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 20) {
        if timeout > 0 { waitForLoadingIndicatorToDisappear(within: timeout) }
        NSLog("snapshot: \(name)")
        if Snapshot.waitForAnimations { sleep(1) }

        guard self.app != nil else {
            NSLog("XCUIApplication is not set. Please call setupSnapshot(app) before snapshot().")
            return
        }

        let screenshot = XCUIScreen.main.screenshot()
        #if os(iOS) && !targetEnvironment(macCatalyst)
        let image = XCUIDevice.shared.orientation.isLandscape
            ? fixLandscapeOrientation(image: screenshot.image) : screenshot.image
        #else
        let image = screenshot.image
        #endif

        guard var simulator = ProcessInfo().environment["SIMULATOR_DEVICE_NAME"],
              let screenshotsDir = screenshotsDirectory else { return }

        do {
            let regex = try NSRegularExpression(pattern: "Clone [0-9]+ of ")
            let range = NSRange(location: 0, length: simulator.count)
            simulator = regex.stringByReplacingMatches(
                in: simulator, range: range, withTemplate: "")
            let path = screenshotsDir.appendingPathComponent("\(simulator)-\(name).png")
            try image.pngData()?.write(to: path, options: .atomic)
        } catch let error {
            NSLog("Problem writing screenshot: \(name) — \(error.localizedDescription)")
        }
    }

    class func fixLandscapeOrientation(image: UIImage) -> UIImage {
        if #available(iOS 10.0, *) {
            let format = UIGraphicsImageRendererFormat()
            format.scale = image.scale
            let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
            return renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: image.size))
            }
        }
        return image
    }

    class func waitForLoadingIndicatorToDisappear(within timeout: TimeInterval) {
        guard let app = self.app else { return }
        let networkLoadingIndicator = app.otherElements.deviceStatusBars
            .networkLoadingIndicators.element
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: networkLoadingIndicator)
        _ = XCTWaiter.wait(for: [gone], timeout: timeout)
    }

    class func getCacheDirectory() throws -> URL {
        let cachePath = "Library/Caches/tools.fastlane"
        #if os(OSX)
        return URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(cachePath)
        #elseif arch(i386) || arch(x86_64) || arch(arm64)
        guard let simulatorHostHome = ProcessInfo().environment["SIMULATOR_HOST_HOME"] else {
            throw SnapshotError.cannotFindSimulatorHomeDirectory
        }
        return URL(fileURLWithPath: simulatorHostHome).appendingPathComponent(cachePath)
        #else
        throw SnapshotError.cannotRunOnPhysicalDevice
        #endif
    }
}

private extension XCUIElementAttributes {
    var isNetworkLoadingIndicator: Bool {
        if hasAllowListedIdentifier { return false }
        let hasOldSize = frame.size == CGSize(width: 10, height: 20)
        let hasNewSize = frame.size.width.isBetween(46, and: 47)
            && frame.size.height.isBetween(2, and: 3)
        return hasOldSize || hasNewSize
    }
    var hasAllowListedIdentifier: Bool {
        ["GeofenceLocationTrackingOn", "StandardLocationTrackingOn"].contains(identifier)
    }
    func isStatusBar(_ deviceWidth: CGFloat) -> Bool {
        if elementType == .statusBar { return true }
        guard frame.origin == .zero else { return false }
        return [CGSize(width: deviceWidth, height: 20),
                CGSize(width: deviceWidth, height: 44)].contains(frame.size)
    }
}

private extension XCUIElementQuery {
    var networkLoadingIndicators: XCUIElementQuery {
        let pred = NSPredicate { obj, _ in
            (obj as? XCUIElementAttributes)?.isNetworkLoadingIndicator ?? false
        }
        return self.containing(pred)
    }
    @MainActor var deviceStatusBars: XCUIElementQuery {
        guard let app = Snapshot.app else {
            fatalError("Call setupSnapshot(app) first.")
        }
        let w = app.windows.firstMatch.frame.width
        let pred = NSPredicate { obj, _ in
            (obj as? XCUIElementAttributes)?.isStatusBar(w) ?? false
        }
        return self.containing(pred)
    }
}

private extension CGFloat {
    func isBetween(_ a: CGFloat, and b: CGFloat) -> Bool { a...b ~= self }
}
```

---

## 3. config.json

Place this file next to your UI test file. It controls which devices and languages are used, the Xcode scheme, screenshot descriptions for AI-generated captions, and the framing color scheme.

```json
{
  "_config": {
    "scheme": "YourApp",
    "devices": [
      "iPhone 16 Pro Max",
      "iPhone 16 Pro",
      "iPhone SE (3rd generation)",
      "iPad Pro 13-inch (M4)"
    ],
    "languages": ["en-US", "de-DE"],
    "bgColor1": "#000000",
    "bgColor2": "#1a1a1a",
    "textColor": "#ffffff"
  },
  "01_Home": "Home dashboard with key metrics and daily overview",
  "02_Detail": "Detail view with history chart and quick actions",
  "03_Settings": "Settings and preferences"
}
```

### `_config` fields

| Field | Required | Description |
|-------|----------|-------------|
| `scheme` | Yes | Xcode scheme name (must match exactly) |
| `devices` | Yes | List of simulator names to run on |
| `languages` | Yes | List of locales — e.g. `"en-US"`, `"de-DE"` |
| `bgColor1` | No | Top gradient color for framing background |
| `bgColor2` | No | Bottom gradient color for framing background |
| `textColor` | No | Caption text color for framing |

### Screenshot descriptions (top-level keys)

Each key outside `_config` maps a screenshot name to a description. The key must match the name passed to `snapshot()` in your tests (e.g. `snapshot("01_Home")` → key `"01_Home"`).

Marteso uses these descriptions to generate AI captions for the framed screenshots. If a key is missing, the app name is used as the subtitle.

### Supported devices

Use the exact simulator name as shown in Xcode's device list. The worker resolves names to UDIDs automatically. Examples:

```
iPhone 16 Pro Max
iPhone 16 Pro
iPhone 16
iPhone 15 Pro Max
iPhone SE (3rd generation)
iPad Pro 13-inch (M4)
iPad Pro 11-inch (M4)
```

### Supported languages

Any locale string that iOS recognizes. Common values:

| Locale | Language |
|--------|----------|
| `en-US` | English (US) |
| `de-DE` | German |
| `fr-FR` | French |
| `es-ES` | Spanish |
| `ja-JP` | Japanese |
| `zh-Hans` | Chinese Simplified |

---

## 4. UI test file

### Setup

Call `setupSnapshot(app)` in `setUpWithError()` **before** launching the app. The SnapshotHelper reads `language.txt` here to configure `-AppleLanguages` on the app instance.

```swift
import XCTest

@MainActor
final class YourAppUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        setupSnapshot(app)
    }

    override func tearDownWithError() throws {
        app = nil
    }
}
```

### Taking screenshots

Name your test methods with a numeric prefix so they run in order. Call `snapshot("name")` on the screen you want to capture. The name must match a key in `config.json` for AI captions to work.

```swift
func testScreenshot01_Home() throws {
    app.launch()
    XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 6))
    snapshot("01_Home")
}

func testScreenshot02_Detail() throws {
    app.launch()
    app.buttons["Open Detail"].tap()
    XCTAssertTrue(app.staticTexts["Details"].waitForExistence(timeout: 6))
    snapshot("02_Detail")
}
```

### Language-aware tests

If your test needs to tap UI elements by their localized text (e.g. tab bar labels or button titles), read `Snapshot.deviceLanguage` — the SnapshotHelper already populates this when `setupSnapshot(app)` is called.

```swift
private var testLanguage: String {
    Snapshot.deviceLanguage.hasPrefix("de") ? "de" : "en"
}

private func t(_ de: String, _ en: String) -> String {
    testLanguage == "de" ? de : en
}

func testScreenshot01_Home() throws {
    app.launch()
    XCTAssertTrue(app.staticTexts[t("Übersicht", "Dashboard")]
        .waitForExistence(timeout: 6))
    snapshot("01_Home")
}
```

`setupSnapshot(app)` (which you already call in `setUpWithError`) reads the current language from the Marteso cache and stores it in `Snapshot.deviceLanguage`. No extra setup needed.

### Seeding demo data

For consistent screenshots, launch the app with demo data via launch arguments. Handle these in your `AppDelegate` or `@main` struct:

```swift
// In your UI tests
private func launchWithDemoData() {
    app.launchArguments += [
        "-ui_testing",
        "-ui_test_seed_demo_data",
    ]
    app.launch()
    XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 10))
}

// In your app (AppDelegate / App struct)
if CommandLine.arguments.contains("-ui_test_seed_demo_data") {
    DataManager.shared.seedDemoData()
}
```

---

## 5. Xcode project settings

### Add SnapshotHelper to the UI test target

1. Drag `SnapshotHelper.swift` into your UI test target folder in Xcode
2. Make sure **Target Membership** shows only the UI test target (not the app target)

### Add config.json to the UI test target

1. Drag `config.json` into the same UI test target folder
2. In the **Add to targets** dialog, check only the UI test target
3. In **Build Phases → Copy Bundle Resources**, confirm `config.json` is listed

### Scheme must be shared

The Xcode scheme used for screenshots must be marked as **Shared** so it is included in the git repository.

1. **Product → Scheme → Manage Schemes**
2. Find your scheme → check the **Shared** checkbox
3. Commit the generated `.xcscheme` file under `YourApp.xcodeproj/xcshareddata/xcschemes/`

---

## 6. Environment variables for login-only apps

If your app shows a login screen before any other content, the simulator will land on the login screen and your screenshot tests will fail — there is no demo data to seed via launch arguments because the content sits behind authentication.

Marteso solves this by letting you store environment variables that are passed to the worker and written to a JSON file in the fastlane cache directory. Your UI test code reads this file via the `SIMULATOR_HOST_HOME` path (the same cache directory the SnapshotHelper already uses) and uses the values to log in programmatically before taking screenshots.

:::info Why not ProcessInfo.processInfo.environment?
Environment variables set on the `xcodebuild` process are **not** inherited by the iOS simulator. The simulator runs in its own sandbox. The fastlane cache directory (`~/Library/Caches/tools.fastlane/`) is the standard communication channel between the host and the simulator — the SnapshotHelper already uses it for `language.txt` and `locale.txt`.
:::

### Setting up env vars in Marteso

1. Go to **App Settings** for your app
2. Scroll to **UI Test Environment**
3. Add one row per variable — key on the left, value on the right (stored encrypted)
4. Click **Save**

These values are encrypted at rest and decrypted only when a snapshot job starts. The worker writes them to `snapshot-env.json` in the fastlane cache directory before running xcodebuild.

### Reading env vars in your UI tests

Add a static property that reads the JSON file once:

```swift
private static let snapshotEnv: [String: String] = {
    let cachePath = "Library/Caches/tools.fastlane"
    guard let home = ProcessInfo().environment["SIMULATOR_HOST_HOME"]
                  ?? ProcessInfo().environment["HOME"] else {
        return [:]
    }
    let url = URL(fileURLWithPath: home)
        .appendingPathComponent(cachePath)
        .appendingPathComponent("snapshot-env.json")
    guard let data = try? Data(contentsOf: url),
          let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
        return [:]
    }
    return dict
}()
```

Then use it in a `login()` helper:

```swift
private func login() {
    let email    = Self.snapshotEnv["EMAIL"]    ?? ""
    let password = Self.snapshotEnv["PASSWORD"] ?? ""

    let emailField = app.textFields["Email"]
    XCTAssertTrue(emailField.waitForExistence(timeout: 10))
    emailField.tap()
    emailField.typeText(email)

    let passwordField = app.secureTextFields["Password"]
    XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
    passwordField.tap()
    passwordField.typeText(password)

    app.buttons["Sign In"].tap()
    XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 20))
}

func testScreenshot01_Home() throws {
    app.launch()
    login()
    XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 10))
    snapshot("01_Home")
}
```

### Recommended variable naming

| Variable | Example value |
|----------|---------------|
| `EMAIL` | `screenshots@example.com` |
| `PASSWORD` | `hunter2` |
| `USER_ID` | `demo-user-123` |

:::tip Use a dedicated test account
Create a separate account in your backend specifically for screenshot generation. This way the data stays consistent across runs and you never risk leaking real user data in screenshots.
:::

---

## 7. Connecting to Marteso

Once the project is set up:

1. Go to your app in Marteso → **Screenshots** tab
2. Click **Link Repository** and select your GitHub repo
3. Select the iOS directory (the folder containing `YourApp.xcodeproj`)
4. Push a commit — Marteso will clone the repo, run the UI tests, and collect the screenshots automatically

You can also trigger a run manually with the **Run Now** button.

---

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 0 screenshots collected | `config.json` not found or not in test target | Check target membership and Build Phases |
| Screenshots always in wrong language | `FASTLANE_LANGUAGE` not read correctly | Make sure you call `setupSnapshot(app)` before `app.launch()` |
| `waitForExistence` fails | Test uses hardcoded strings instead of localized | Use the `t(_ de:_ en:)` pattern or `testLanguage` check |
| xcodebuild exits with status 64 | Scheme not found or not shared | Share the scheme and double-check the name in `config.json` |
| `cannotFindSimulatorHomeDirectory` | `SIMULATOR_HOST_HOME` not set in test environment | This is set automatically by the simulator; make sure you are running on the Mac Mini worker |
| `snapshot()` writes 0 bytes | `screenshotsDirectory` is nil — cache dir not found | Confirm `setupSnapshot(app)` was called in `setUpWithError` |
| UI tests fail on login screen | No env vars set for credentials | Add `SNAPSHOT_EMAIL` / `SNAPSHOT_PASSWORD` in App Settings → UI Test Environment |
| Env var is empty string in test | Variable not saved or key misspelled | Check App Settings → UI Test Environment and re-save |
