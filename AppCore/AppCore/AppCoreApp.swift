//
//  AppCoreApp.swift
//  AppCore
//
//  Created by Alex Polan on 3/6/26.
//

import SwiftUI
import UserNotifications

@main
struct AppCoreApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

// MARK: - App Delegate for Push Notifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        PushNotificationManager.shared.setupCategories()
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushNotificationManager.shared.handleDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushNotificationManager.shared.handleRegistrationError(error)
    }

    // Handle foreground notifications
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .badge, .sound]
    }

    // Handle notification taps
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let categoryId = response.notification.request.content.categoryIdentifier
        let actionId = response.actionIdentifier

        // Post notification for navigation
        NotificationCenter.default.post(
            name: .pushNotificationTapped,
            object: nil,
            userInfo: [
                "category": categoryId,
                "action": actionId
            ]
        )
    }
}

extension Notification.Name {
    static let pushNotificationTapped = Notification.Name("pushNotificationTapped")
}
