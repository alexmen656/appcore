import SwiftUI
import Charts

struct KeywordsView: View {
    let bundleId: String?

    @State private var keywords: [Keyword] = []
    @State private var selectedKeyword: Keyword?
    @State private var history: KeywordHistoryData?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAddSheet = false
    @State private var searchText = ""
    @State private var sortBy: SortOption = .popularity

    enum SortOption: String, CaseIterable {
        case popularity = "Popularity"
        case term = "A-Z"
        case rank = "Rank"
    }

    var filteredKeywords: [Keyword] {
        var result = keywords
        if !searchText.isEmpty {
            result = result.filter { $0.term.localizedCaseInsensitiveContains(searchText) }
        }
        switch sortBy {
        case .popularity:
            result.sort { ($0.popularity ?? 0) > ($1.popularity ?? 0) }
        case .term:
            result.sort { $0.term < $1.term }
        case .rank:
            result.sort { ($0.ourRank ?? 999) < ($1.ourRank ?? 999) }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && keywords.isEmpty {
                    LoadingView("Loading keywords...")
                } else if let error, keywords.isEmpty {
                    ErrorView(message: error) { Task { await loadKeywords() } }
                } else if keywords.isEmpty {
                    EmptyStateView(
                        icon: "key.fill",
                        title: "No Keywords",
                        message: "Add keywords to track their rankings."
                    )
                } else {
                    keywordsList
                }
            }
            .navigationTitle("Keywords")
            .searchable(text: $searchText, prompt: "Search keywords")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Button {
                                sortBy = option
                            } label: {
                                HStack {
                                    Text(option.rawValue)
                                    if option == sortBy {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAddSheet = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddSheet) {
                AddKeywordSheet { await loadKeywords() }
            }
            .sheet(item: $selectedKeyword) { keyword in
                KeywordDetailSheet(keyword: keyword)
            }
            .refreshable { await loadKeywords() }
        }
        .task { await loadKeywords() }
    }

    @ViewBuilder
    private var keywordsList: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                // Summary
                HStack(spacing: 12) {
                    StatCard(
                        title: "Total",
                        value: "\(keywords.count)",
                        icon: "key.fill",
                        color: .blue
                    )
                    StatCard(
                        title: "Ranked",
                        value: "\(keywords.filter { $0.ourRank != nil }.count)",
                        icon: "chart.bar.fill",
                        color: .green
                    )
                }
                .padding(.horizontal)

                ForEach(filteredKeywords) { keyword in
                    keywordRow(keyword)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func keywordRow(_ keyword: Keyword) -> some View {
        Button {
            selectedKeyword = keyword
        } label: {
            VStack(spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(keyword.term)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)

                        HStack(spacing: 8) {
                            Label(keyword.country, systemImage: "globe")
                            if let lang = keyword.language {
                                Text("·")
                                Text(lang)
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }

                    Spacer()

                    // Rank
                    if let rank = keyword.ourRank {
                        VStack(spacing: 2) {
                            Text("#\(rank)")
                                .font(.title3)
                                .fontWeight(.bold)
                                .fontDesign(.rounded)
                                .foregroundStyle(rankColor(rank))
                            Text("Rank")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Text("—")
                            .font(.title3)
                            .foregroundStyle(.tertiary)
                    }
                }

                // Metrics Bar
                HStack(spacing: 16) {
                    if let pop = keyword.popularity {
                        metricPill("Pop", value: "\(pop)", color: .blue)
                    }
                    if let diff = keyword.difficulty {
                        metricPill("Diff", value: String(format: "%.0f", diff), color: difficultyColor(diff))
                    }
                    if let volume = keyword.searchVolume {
                        metricPill("Vol", value: formatCompact(volume), color: .purple)
                    }
                    if let comp = keyword.topCompetitor {
                        metricPill(comp.name, value: "#\(comp.rank)", color: .red)
                    }
                    Spacer()
                }
            }
            .padding()
            .glassEffect(.regular, in: .rect(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task {
                    try? await APIService.shared.deleteKeyword(id: keyword.id)
                    await loadKeywords()
                }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func metricPill(_ label: String, value: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .foregroundStyle(.secondary)
            Text(value)
                .fontWeight(.medium)
                .foregroundStyle(color)
        }
        .font(.caption2)
    }

    private func rankColor(_ rank: Int) -> Color {
        if rank <= 5 { return .green }
        if rank <= 20 { return .blue }
        if rank <= 50 { return .orange }
        return .red
    }

    private func difficultyColor(_ diff: Double) -> Color {
        if diff < 30 { return .green }
        if diff < 60 { return .orange }
        return .red
    }

    private func formatCompact(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.0fK", Double(n) / 1_000) }
        return "\(n)"
    }

    private func loadKeywords() async {
        isLoading = true
        error = nil
        do {
            keywords = try await APIService.shared.getKeywords(bundleId: bundleId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Add Keyword Sheet

struct AddKeywordSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var term = ""
    @State private var country = "US"
    @State private var language = ""
    @State private var isLoading = false

    let onAdded: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Keyword") {
                    TextField("Keyword term", text: $term)
                        .textInputAutocapitalization(.never)
                }

                Section("Region") {
                    TextField("Country code (e.g. US)", text: $country)
                        .textInputAutocapitalization(.characters)
                    TextField("Language (optional)", text: $language)
                        .textInputAutocapitalization(.never)
                }
            }
            .navigationTitle("Add Keyword")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            isLoading = true
                            try? await APIService.shared.addKeyword(
                                term: term,
                                country: country,
                                language: language.isEmpty ? nil : language
                            )
                            await onAdded()
                            isLoading = false
                            dismiss()
                        }
                    }
                    .disabled(term.isEmpty || country.isEmpty || isLoading)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Keyword Detail Sheet

struct KeywordDetailSheet: View {
    let keyword: Keyword

    @State private var history: KeywordHistoryData?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Keyword Info
                    VStack(spacing: 8) {
                        Text(keyword.term)
                            .font(.title2)
                            .fontWeight(.bold)

                        HStack(spacing: 16) {
                            if let pop = keyword.popularity {
                                Label("\(pop) pop", systemImage: "flame.fill")
                                    .foregroundStyle(.orange)
                            }
                            if let diff = keyword.difficulty {
                                Label(String(format: "%.0f diff", diff), systemImage: "gauge.medium")
                                    .foregroundStyle(.blue)
                            }
                            Label(keyword.country, systemImage: "globe")
                                .foregroundStyle(.secondary)
                        }
                        .font(.subheadline)

                        if let rank = keyword.ourRank {
                            Text("Current Rank: #\(rank)")
                                .font(.headline)
                                .foregroundStyle(.green)
                                .padding(.top, 4)
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .glassEffect(.regular, in: .rect(cornerRadius: 20))

                    // Ranking History Chart
                    if let history, !history.rankings.isEmpty {
                        rankingChart(history.rankings)
                    } else if isLoading {
                        ProgressView("Loading history...")
                            .padding(40)
                    }
                }
                .padding()
            }
            .navigationTitle("Keyword Detail")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            do {
                history = try await APIService.shared.getKeywordHistory(id: keyword.id)
            } catch {
                print("Failed to load history: \(error)")
            }
            isLoading = false
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private func rankingChart(_ rankings: [RankingEntry]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Ranking History", icon: "chart.line.uptrend.xyaxis")

            let ourRankings = rankings.filter { $0.appBundleId == keyword.term || true }
                .sorted { $0.trackedAt < $1.trackedAt }

            Chart(ourRankings) { entry in
                LineMark(
                    x: .value("Date", parseDate(entry.trackedAt)),
                    y: .value("Rank", entry.rank)
                )
                .foregroundStyle(.blue)
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2.5))

                PointMark(
                    x: .value("Date", parseDate(entry.trackedAt)),
                    y: .value("Rank", entry.rank)
                )
                .foregroundStyle(.blue)
                .symbolSize(30)
            }
            .frame(height: 250)
            .chartYScale(domain: .automatic(includesZero: false))
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                }
            }

            // Rankings Table
            if ourRankings.count > 1 {
                Text("Recent Rankings")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .padding(.top, 8)

                ForEach(ourRankings.suffix(10).reversed()) { entry in
                    HStack {
                        Text(entry.appName)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                        Text("#\(entry.rank)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(entry.rank <= 10 ? .green : .secondary)
                        Text(formatShortDate(entry.trackedAt))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

    private func parseDate(_ string: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? Date()
    }

    private func formatShortDate(_ string: String) -> String {
        let date = parseDate(string)
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
