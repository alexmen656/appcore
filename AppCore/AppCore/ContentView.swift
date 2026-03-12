//
//  ContentView.swift
//  AppCore
//
//  Created by Alex Polan on 3/6/26.
//

import SwiftUI

struct ContentView: View {
    @Bindable var auth = AuthManager.shared

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.smooth, value: auth.isAuthenticated)
        .task {
            await auth.checkAuth()
        }
        .onReceive(NotificationCenter.default.publisher(for: .pushNotificationTapped)) { notification in
            if let userInfo = notification.userInfo,
               let category = userInfo["category"] as? String {
                handlePushNavigation(category: category)
            }
        }
    }

    private func handlePushNavigation(category: String) {
        print("Push notification tapped: \(category)")
    }
}

#Preview {
    ContentView()
}
