//
//  AppCoreUITests.swift
//  AppCoreUITests
//

import XCTest

@MainActor
final class AppCoreUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-clearAuth"]
        setupSnapshot(app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Env Vars (read from fastlane cache)

    private static let snapshotEnv: [String: String] = {
        let cachePath = "Library/Caches/tools.fastlane"
        guard let home = ProcessInfo().environment["SIMULATOR_HOST_HOME"] ?? ProcessInfo().environment["HOME"] else {
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

    // MARK: - Login

    private func login() {
        let email    = Self.snapshotEnv["EMAIL"]    ?? ""
        let password = Self.snapshotEnv["PASSWORD"] ?? ""

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Email field not found")
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["Sign In"].tap()
        XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 30), "Tab bar not found after login")
    }

    // MARK: - Screenshots

    func testScreenshot01_Dashboard() throws {
        app.launch()
        login()

        XCTAssertTrue(app.navigationBars["Dashboard"].waitForExistence(timeout: 10))
        snapshot("01_Dashboard")
    }

    func testScreenshot02_Keywords() throws {
        app.launch()
        login()

        app.tabBars.buttons["Keywords"].tap()
        XCTAssertTrue(app.navigationBars["Keywords"].waitForExistence(timeout: 10))
        snapshot("02_Keywords")
    }

    func testScreenshot03_Analytics() throws {
        app.launch()
        login()

        app.tabBars.buttons["Analytics"].tap()
        XCTAssertTrue(app.navigationBars["Analytics"].waitForExistence(timeout: 10))
        snapshot("03_Analytics")
    }

    func testScreenshot04_Versions() throws {
        app.launch()
        login()

        app.tabBars.buttons["Versions"].tap()
        XCTAssertTrue(app.navigationBars["Versions"].waitForExistence(timeout: 10))
        snapshot("04_Versions")
    }

    func testScreenshot05_More() throws {
        app.launch()
        login()

        app.tabBars.buttons["More"].tap()
        XCTAssertTrue(app.navigationBars["More"].waitForExistence(timeout: 10))
        snapshot("05_More")
    }
}
