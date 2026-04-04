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
