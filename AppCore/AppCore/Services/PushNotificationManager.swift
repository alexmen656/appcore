import Foundation
import UserNotifications
import UIKit

@Observable
final class PushNotificationManager: NSObject {
    static let shared = PushNotificationManager()

    var isRegistered = false
    var deviceToken: String?
    var permissionStatus: UNAuthorizationStatus = .notDetermined

    override private init() {
        super.init()
    }

    func requestPermission() async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            await checkPermissionStatus()
        } catch {
            print("Push notification permission error: \(error)")
        }
    }

    func checkPermissionStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        permissionStatus = settings.authorizationStatus
    }

    func handleDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        self.deviceToken = tokenString
        self.isRegistered = true

        Task {
            try? await APIService.shared.registerDeviceToken(tokenString)
        }
    }

    func handleRegistrationError(_ error: Error) {
        print("Failed to register for remote notifications: \(error)")
        self.isRegistered = false
    }
}

// MARK: - Notification Categories

extension PushNotificationManager {
    static let keywordRankCategory = "KEYWORD_RANK_UPDATE"
    static let submissionCategory = "SUBMISSION_UPDATE"
    static let jobCompleteCategory = "JOB_COMPLETE"

    func setupCategories() {
        let rankAction = UNNotificationAction(
            identifier: "VIEW_KEYWORDS",
            title: "View Keywords",
            options: .foreground
        )
        let rankCategory = UNNotificationCategory(
            identifier: Self.keywordRankCategory,
            actions: [rankAction],
            intentIdentifiers: []
        )

        let submissionAction = UNNotificationAction(
            identifier: "VIEW_VERSIONS",
            title: "View Versions",
            options: .foreground
        )
        let submissionCategory = UNNotificationCategory(
            identifier: Self.submissionCategory,
            actions: [submissionAction],
            intentIdentifiers: []
        )

        let jobAction = UNNotificationAction(
            identifier: "VIEW_JOBS",
            title: "View Jobs",
            options: .foreground
        )
        let jobCategory = UNNotificationCategory(
            identifier: Self.jobCompleteCategory,
            actions: [jobAction],
            intentIdentifiers: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            rankCategory, submissionCategory, jobCategory
        ])
    }
}
