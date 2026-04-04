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
        setupSnapshot(app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    private func login() {
        let env = ProcessInfo.processInfo.environment
        let email    = env["EMAIL"]    ?? ""
        let password = env["PASSWORD"] ?? ""

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Email field not found")
        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5))
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["Sign In"].tap()

        XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 20), "Tab bar not found after login")
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
