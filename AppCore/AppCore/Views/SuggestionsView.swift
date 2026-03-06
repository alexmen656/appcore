import SwiftUI

struct SuggestionsView: View {
    let bundleId: String?

    @State private var suggestions: [Suggestion] = []
    @State private var total = 0
    @State private var selectedFilter: String? = nil
    @State private var isLoading = true
    @State private var error: String?

    private let filters = ["All", "PENDING", "APPROVED", "APPLIED", "REJECTED"]

    var filteredSuggestions: [Suggestion] {
        guard let filter = selectedFilter, filter != "All" else { return suggestions }
        return suggestions.filter { $0.status == filter }
    }

    // Group by locale
    var groupedSuggestions: [(String, [Suggestion])] {
        Dictionary(grouping: filteredSuggestions) { $0.locale }
            .sorted { $0.key < $1.key }
    }

    var body: some View {
        Group {
            if isLoading && suggestions.isEmpty {
                LoadingView("Loading suggestions...")
            } else if let error, suggestions.isEmpty {
                ErrorView(message: error) { Task { await loadSuggestions() } }
            } else if suggestions.isEmpty {
                EmptyStateView(
                    icon: "lightbulb.fill",
                    title: "No Suggestions",
                    message: "Run AI analysis to generate ASO suggestions."
                )
            } else {
                suggestionsContent
            }
        }
        .navigationTitle("Suggestions")
        .refreshable { await loadSuggestions() }
        .task { await loadSuggestions() }
    }

    @ViewBuilder
    private var suggestionsContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Filter Chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(filters, id: \.self) { filter in
                            Button {
                                selectedFilter = filter == "All" ? nil : filter
                            } label: {
                                Text(filter.capitalized)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .glassEffect(.regular, in: .capsule)
                                    .overlay {
                                        if (selectedFilter ?? "All") == filter {
                                            Capsule().stroke(.tint, lineWidth: 2)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                }

                // Stats
                HStack(spacing: 12) {
                    StatCard(
                        title: "Total",
                        value: "\(total)",
                        icon: "lightbulb.fill",
                        color: .blue
                    )
                    StatCard(
                        title: "Pending",
                        value: "\(suggestions.filter { $0.status == "PENDING" }.count)",
                        icon: "clock.fill",
                        color: .orange
                    )
                }
                .padding(.horizontal)

                // Grouped List
                ForEach(groupedSuggestions, id: \.0) { locale, items in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(localeDisplayName(locale))
                                .font(.headline)
                            Text(locale)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.quaternary)
                                .clipShape(Capsule())
                            Spacer()
                            Text("\(items.count)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)

                        ForEach(items) { suggestion in
                            suggestionCard(suggestion)
                                .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func suggestionCard(_ suggestion: Suggestion) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(suggestion.type.capitalized, systemImage: typeIcon(suggestion.type))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.tint)
                Spacer()
                StatusBadge(status: suggestion.status)
            }

            if let current = suggestion.currentValue, !current.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Current")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(current)
                        .font(.caption)
                        .lineLimit(2)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Suggested")
                    .font(.caption2)
                    .foregroundStyle(.green)
                Text(suggestion.suggestedValue)
                    .font(.caption)
                    .lineLimit(3)
            }

            if let reasoning = suggestion.reasoning, !reasoning.isEmpty {
                Text(reasoning)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let confidence = suggestion.confidenceScore {
                    Label(String(format: "%.0f%%", confidence * 100), systemImage: "gauge.medium")
                        .font(.caption2)
                        .foregroundStyle(confidence > 0.7 ? .green : .orange)
                }
                if let keyword = suggestion.keyword {
                    Label(keyword, systemImage: "key.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()

                if suggestion.status == "PENDING" {
                    HStack(spacing: 8) {
                        Button {
                            Task {
                                try? await APIService.shared.approveSuggestion(id: suggestion.id)
                                await loadSuggestions()
                            }
                        } label: {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        }

                        Button {
                            Task {
                                try? await APIService.shared.applySuggestion(id: suggestion.id)
                                await loadSuggestions()
                            }
                        } label: {
                            Image(systemName: "paperplane.circle.fill")
                                .foregroundStyle(.blue)
                        }

                        Button {
                            Task {
                                try? await APIService.shared.rejectSuggestion(id: suggestion.id)
                                await loadSuggestions()
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    private func typeIcon(_ type: String) -> String {
        switch type.uppercased() {
        case "TITLE": return "textformat"
        case "SUBTITLE": return "text.below.photo"
        case "KEYWORDS": return "tag.fill"
        case "DESCRIPTION": return "doc.text.fill"
        default: return "lightbulb.fill"
        }
    }

    private func localeDisplayName(_ code: String) -> String {
        Locale.current.localizedString(forIdentifier: code) ?? code
    }

    private func loadSuggestions() async {
        isLoading = true
        error = nil
        do {
            let response = try await APIService.shared.getSuggestions(bundleId: bundleId)
            suggestions = response.flat  // flatten the locale-keyed dictionary
            total = response.total
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
