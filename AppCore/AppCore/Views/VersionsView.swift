import SwiftUI

struct VersionsView: View {
    let bundleId: String?

    @State private var versions: [VersionSummary] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var appIconURL: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && versions.isEmpty {
                    LoadingView("Loading versions...")
                } else if let error, versions.isEmpty {
                    ErrorView(message: error) { Task { await loadVersions() } }
                } else if versions.isEmpty {
                    EmptyStateView(
                        icon: "doc.text.fill",
                        title: "No Versions",
                        message: "Connect your App Store Connect account to see versions."
                    )
                } else {
                    versionsList
                }
            }
            .navigationTitle("Versions")
            .refreshable { await loadVersions() }
        }
        .task(id: bundleId) { await loadVersions() }
    }

    @ViewBuilder
    private var versionsList: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(spacing: 0) {
                    ForEach(Array(versions.enumerated()), id: \.element.id) { index, version in
                        versionRow(version)

                        if index < versions.count - 1 {
                            Divider()
                                .padding(.leading, 90)
                                .overlay(.white.opacity(0.08))
                        }
                    }
                }
                .padding(.vertical, 6)
                .glassEffect(.regular, in: .rect(cornerRadius: 24))
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func versionRow(_ version: VersionSummary) -> some View {
        NavigationLink(destination: VersionDetailView(bundleId: bundleId, version: version)) {
            HStack(spacing: 16) {
                AppIconView(url: appIconURL, size: 56)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Version \(version.versionString)")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.primary)

                    VersionStatusView(status: version.appStoreState)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }

    private func loadVersions() async {
        guard bundleId != nil else { return }
        isLoading = true
        error = nil
        appIconURL = nil
        do {
            versions = try await APIService.shared.getVersionsList(bundleId: bundleId)

            if let app = try? await resolveAppItem() {
                appIconURL = app.iconUrl
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func resolveAppItem() async throws -> AppItem? {
        let apps = try await APIService.shared.getApps(bundleId: bundleId)

        if let bundleId {
            return apps.first { $0.bundleId == bundleId }
        }

        return apps.first { $0.isOwnApp }
    }
}

private struct VersionDetailView: View {
    let bundleId: String?
    let version: VersionSummary

    @State private var versionData: VersionsData?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && versionData == nil {
                LoadingView("Loading version details...")
            } else if let error, versionData == nil {
                ErrorView(message: error) { Task { await loadVersionDetails() } }
            } else if let data = versionData {
                versionContent(data)
            }
        }
        .navigationTitle("v\(version.versionString)")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard versionData == nil else { return }
            await loadVersionDetails()
        }
    }

    @ViewBuilder
    private func versionContent(_ data: VersionsData) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                headerCard(data)

                if data.localizations.isEmpty {
                    EmptyStateView(
                        icon: "globe",
                        title: "No Localizations",
                        message: "No localized metadata is available for this version yet."
                    )
                } else {
                    ForEach(data.localizations) { loc in
                        localizationCard(loc)
                    }
                }
            }
            .padding()
        }
        .refreshable { await loadVersionDetails() }
    }

    @ViewBuilder
    private func headerCard(_ data: VersionsData) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(data.appName)
                        .font(.headline)
                    Text(data.bundleId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let platform = version.platform {
                        Label(platformDisplayName(platform), systemImage: platformIcon(platform))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 8) {
                    VersionStatusView(status: data.appStoreState)
                    if data.isEditable {
                        Label("Editable", systemImage: "pencil")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                    }
                }
            }

            HStack(spacing: 12) {
                detailPill(title: "Version", value: data.versionString, icon: "number")
                detailPill(title: "Locales", value: "\(data.localizations.count)", icon: "globe")
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    @ViewBuilder
    private func localizationCard(_ loc: VersionLocalization) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(localeDisplayName(loc.locale))
                    .font(.subheadline)
                    .fontWeight(.bold)
                Text(loc.locale)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.quaternary)
                    .clipShape(Capsule())
                Spacer()
            }

            if let name = loc.name, !name.isEmpty {
                metadataField("Name", value: name, icon: "textformat")
            }
            if let subtitle = loc.subtitle, !subtitle.isEmpty {
                metadataField("Subtitle", value: subtitle, icon: "text.below.photo")
            }
            if let keywords = loc.keywords, !keywords.isEmpty {
                metadataField("Keywords", value: keywords, icon: "tag.fill")
            }
            if let whatsNew = loc.whatsNew, !whatsNew.isEmpty {
                metadataField("What's New", value: whatsNew, icon: "sparkles")
            }
            if let desc = loc.description, !desc.isEmpty {
                metadataField("Description", value: desc, icon: "doc.text", lines: 4)
            }
            if let promo = loc.promotionalText, !promo.isEmpty {
                metadataField("Promo Text", value: promo, icon: "megaphone.fill")
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    @ViewBuilder
    private func metadataField(_ label: String, value: String, icon: String, lines: Int = 2) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(label, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .lineLimit(lines)
        }
    }

    @ViewBuilder
    private func detailPill(title: String, value: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
    }

    private func platformDisplayName(_ platform: String) -> String {
        switch platform.lowercased() {
        case "ios":
            return "iOS"
        case "mac_os", "macos":
            return "macOS"
        case "tvos":
            return "tvOS"
        case "visionos":
            return "visionOS"
        default:
            return platform
        }
    }

    private func platformIcon(_ platform: String) -> String {
        switch platform.lowercased() {
        case "ios":
            return "iphone"
        case "mac_os", "macos":
            return "desktopcomputer"
        case "tvos":
            return "tv"
        case "visionos":
            return "visionpro"
        default:
            return "app.badge"
        }
    }

    private func localeDisplayName(_ code: String) -> String {
        Locale.current.localizedString(forIdentifier: code) ?? code
    }

    private func loadVersionDetails() async {
        isLoading = true
        error = nil
        do {
            versionData = try await APIService.shared.getVersionDetails(
                bundleId: bundleId,
                versionId: version.versionId
            )
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct VersionStatusView: View {
    let status: String
    var prominent = false

    private var normalizedStatus: String {
        status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var color: Color {
        switch normalizedStatus {
        case "prepare_for_submission", "waiting_for_review", "pending_developer_release", "pending_apple_release":
            return .yellow
        case "ready_for_sale", "ready_for_distribution", "approved", "replaced_with_new_version":
            return .green
        case "processing_for_distribution", "in_review":
            return .blue
        case "rejected", "metadata_rejected", "developer_rejected", "invalid_binary":
            return .red
        case "developer_removed_from_sale", "removed_from_sale", "removed":
            return .gray
        default:
            return .secondary
        }
    }

    private var symbolName: String {
        switch normalizedStatus {
        case "prepare_for_submission":
            return "exclamationmark.circle.fill"
        case "waiting_for_review", "pending_developer_release", "pending_apple_release":
            return "clock.fill"
        case "ready_for_sale", "ready_for_distribution", "approved", "replaced_with_new_version":
            return "checkmark.circle.fill"
        case "processing_for_distribution", "in_review":
            return "arrow.triangle.2.circlepath.circle.fill"
        case "rejected", "metadata_rejected", "developer_rejected", "invalid_binary":
            return "xmark.circle.fill"
        case "developer_removed_from_sale", "removed_from_sale", "removed":
            return "minus.circle.fill"
        default:
            return "circle.fill"
        }
    }

    private var displayText: String {
        normalizedStatus
            .replacingOccurrences(of: "_", with: " ")
            .localizedCapitalized
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbolName)
                .font(prominent ? .title2 : .subheadline)
                .foregroundStyle(color)

            Text(displayText)
                .font(prominent ? .title3 : .subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
        }
    }
}
