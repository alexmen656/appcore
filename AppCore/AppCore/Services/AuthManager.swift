import Foundation

@Observable
final class AuthManager {
    static let shared = AuthManager()

    var currentUser: AuthUser?
    var isAuthenticated: Bool { APIService.shared.isAuthenticated }
    var isLoading = false
    var error: String?

    private init() {}

    func checkAuth() async {
        guard APIService.shared.isAuthenticated else { return }
        do {
            currentUser = try await APIService.shared.getCurrentUser()
        } catch APIError.unauthorized {
            // Token is definitively rejected by the server — clear it
            APIService.shared.logout()
            currentUser = nil
        } catch {
            // Network/server error — keep the token, don't log the user out
            print("checkAuth error (keeping session): \(error)")
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let response = try await APIService.shared.login(email: email, password: password)
            currentUser = response.user
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func register(email: String, password: String, name: String) async {
        isLoading = true
        error = nil
        do {
            let response = try await APIService.shared.register(email: email, password: password, name: name)
            currentUser = response.user
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func logout() {
        APIService.shared.logout()
        currentUser = nil
    }
}
