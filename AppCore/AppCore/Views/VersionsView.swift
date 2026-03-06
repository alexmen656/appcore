import SwiftUI

struct VersionsView: View {
    let bundleId: String?

    @State private var versions: [VersionSummary] = []
    @State private var selectedVersion: VersionSummary?
    @State private var versionData: VersionsData?
    @State private var isLoading = true
    @State private var error: String?

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
                    versionContent
                }
            }
            .navigationTitle("Versions")
            .refreshable { await loadVersions() }
        }
        .task { await loadVersions() }
    }

    @ViewBuilder
    private var versionContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Version Picker
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(versions) { version in
                            versionChip(version)
                        }
                    }
                    .padding(.horizontal)
                }

                // Version Details
                if let data = versionData {
                    versionDetails(data)
                } else if selectedVersion != nil {
                    LoadingView("Loading version details...")
                }
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func versionChip(_ version: VersionSummary) -> some View {
        Button {
            selectedVersion = version
            Task { await loadVersionDetails(version) }
        } label: {
            VStack(spacing: 4) {
                Text("v\(version.versionString)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                StatusBadge(status: version.appStoreState)
                if let platform = version.platform {
                    Text(platform)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .glassEffect(
                selectedVersion?.id == version.id ? .regular : .regular,
                in: .rect(cornerRadius: 14)
            )
            .overlay {
                if selectedVersion?.id == version.id {
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(.tint, lineWidth: 2)
                }
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func versionDetails(_ data: VersionsData) -> some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(data.appName)
                        .font(.headline)
                    Text("v\(data.versionString)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusBadge(status: data.appStoreState)
                if data.isEditable {
                    Image(systemName: "pencil.circle.fill")
                        .foregroundStyle(.blue)
                }
            }
            .padding()
            .glassEffect(.regular, in: .rect(cornerRadius: 16))
            .padding(.horizontal)

            // Localizations
            ForEach(data.localizations) { loc in
                localizationCard(loc, isEditable: data.isEditable)
                    .padding(.horizontal)
            }
        }
    }

    @ViewBuilder
    private func localizationCard(_ loc: VersionLocalization, isEditable: Bool) -> some View {
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

    private func localeDisplayName(_ code: String) -> String {
        Locale.current.localizedString(forIdentifier: code) ?? code
    }

    private func loadVersions() async {
        isLoading = true
        error = nil
        do {
            versions = try await APIService.shared.getVersionsList(bundleId: bundleId)
            if let first = versions.first, selectedVersion == nil {
                selectedVersion = first
                await loadVersionDetails(first)
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func loadVersionDetails(_ version: VersionSummary) async {
        versionData = nil
        do {
            versionData = try await APIService.shared.getVersionDetails(
                bundleId: bundleId,
                versionId: version.versionId
            )
        } catch {
            print("Failed to load version: \(error)")
        }
    }
}
