import SwiftUI

struct LoginView: View {
    @Bindable var auth = AuthManager.shared

    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isRegistering = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    VStack(spacing: 12) {
                        Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                            .font(.system(size: 72))
                            .foregroundStyle(.tint)
                            .symbolRenderingMode(.hierarchical)

                        Text("Marteso")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .fontDesign(.rounded)

                        Text("ASO Intelligence Platform")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    VStack(spacing: 16) {
                        if isRegistering {
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .textFieldStyle(.plain)
                                .padding()
                                .glassEffect(.regular, in: .rect(cornerRadius: 14))
                        }

                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .textFieldStyle(.plain)
                            .padding()
                            .glassEffect(.regular, in: .rect(cornerRadius: 14))

                        SecureField("Password", text: $password)
                            .textContentType(isRegistering ? .newPassword : .password)
                            .textFieldStyle(.plain)
                            .padding()
                            .glassEffect(.regular, in: .rect(cornerRadius: 14))


                    }
                    .padding(.horizontal)

                    if let error = auth.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .padding(.horizontal)
                    }

                    VStack(spacing: 12) {
                        Button {
                            Task {
                                if isRegistering {
                                    await auth.register(email: email, password: password, name: name)
                                } else {
                                    await auth.login(email: email, password: password)
                                }
                            }
                        } label: {
                            Group {
                                if auth.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text(isRegistering ? "Create Account" : "Sign In")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.borderedProminent)
                        .buttonBorderShape(.roundedRectangle(radius: 14))
                        .disabled(email.isEmpty || password.isEmpty || auth.isLoading)

                        Button {
                            withAnimation(.smooth) {
                                isRegistering.toggle()
                                auth.error = nil
                            }
                        } label: {
                            Text(isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register")
                                .font(.subheadline)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.bottom, 40)
            }
        }
    }
}
