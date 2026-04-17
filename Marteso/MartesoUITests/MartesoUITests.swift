//
//  MartesoUITests.swift
//  MartesoUITests
//

import XCTest

@MainActor
final class MartesoUITests: XCTestCase {

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

    private func login() {
        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10), "Email field not found")
        emailField.tap()
        emailField.typeText(Snapshot.snapshotEnv["EMAIL"] ?? "")

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText(Snapshot.snapshotEnv["PASSWORD"] ?? "")

        app.buttons["Sign In"].tap()
        XCTAssertTrue(app.navigationBars["Dashboard"].waitForExistence(timeout: 30), "Dashboard not found after login")

        dismissSavePasswordPromptIfNeeded()
    }

    private func dismissSavePasswordPromptIfNeeded() {
        sleep(3)
        if app.scrollViews.otherElements.buttons["Später"].waitForExistence(timeout: 2) {
            app.scrollViews.otherElements.buttons["Später"].tap()
        }
    }

    func testScreenshot01_Dashboard() throws {
        app.launch()
        login()

        XCTAssertTrue(app.navigationBars["Dashboard"].waitForExistence(timeout: 15))
        snapshot("01_Dashboard")
    }

    func testScreenshot02_Keywords() throws {
        app.launch()
        login()

        let keywordsBtn = app.tabBars.buttons["Keywords"]
        XCTAssertTrue(keywordsBtn.waitForExistence(timeout: 10), "Keywords tab button not found")
        keywordsBtn.tap()
        XCTAssertTrue(app.navigationBars["Keywords"].waitForExistence(timeout: 15))
        snapshot("02_Keywords")
    }

    func testScreenshot03_Analytics() throws {
        app.launch()
        login()

        let analyticsBtn = app.tabBars.buttons["Analytics"]
        XCTAssertTrue(analyticsBtn.waitForExistence(timeout: 10), "Analytics tab button not found")
        analyticsBtn.tap()
        XCTAssertTrue(app.navigationBars["Analytics"].waitForExistence(timeout: 15))
        snapshot("03_Analytics")
    }

    func testScreenshot04_Versions() throws {
        app.launch()
        login()

        let versionsBtn = app.tabBars.buttons["Versions"]
        XCTAssertTrue(versionsBtn.waitForExistence(timeout: 10), "Versions tab button not found")
        versionsBtn.tap()
        XCTAssertTrue(app.navigationBars["Versions"].waitForExistence(timeout: 15))
        snapshot("04_Versions")
    }

    func testScreenshot05_More() throws {
        app.launch()
        login()

        let moreBtn = app.tabBars.buttons["More"]
        XCTAssertTrue(moreBtn.waitForExistence(timeout: 10), "More tab button not found")
        moreBtn.tap()
        XCTAssertTrue(app.navigationBars["More"].waitForExistence(timeout: 15))
        snapshot("05_More")
    }
}
