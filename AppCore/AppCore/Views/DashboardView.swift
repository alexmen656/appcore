import SwiftUI
import Charts

struct DashboardView: View {
    let bundleId: String?

    @State private var dashboard: DashboardData?
    @State private var downloads: DownloadsData?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView("Loading dashboard...")
                } else if let error {
                    ErrorView(message: error) { Task { await loadData() } }
                } else if let dashboard {
                    dashboardContent(dashboard)
                }
            }
            .navigationTitle("Dashboard")
            .refreshable { await loadData() }
        }
        .task { await loadData() }
    }

    @ViewBuilder
    private func dashboardContent(_ data: DashboardData) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                // App Info Card
                if let app = data.app {
                    appInfoCard(app)
                }

                // Stats Grid
                statsGrid(data.stats)

                // Downloads Chart
                if let downloads, !downloads.byDay.isEmpty {
                    downloadsChart(downloads.byDay)
                }

                // Last Job & Config
                HStack(spacing: 12) {
                    if let lastJob = data.lastJob {
                        lastJobCard(lastJob)
                    }
                    configCard(data.config)
                }

                // Recent Suggestions
                if !data.recentSuggestions.isEmpty {
                    recentSuggestionsSection(data.recentSuggestions)
                }
            }
            .padding()
        }
    }

    // MARK: - App Info

    @ViewBuilder
    private func appInfoCard(_ app: AppInfo) -> some View {
        HStack(spacing: 16) {
            AppIconView(url: app.iconUrl, size: 64)

            VStack(alignment: .leading, spacing: 4) {
                Text(app.name)
                    .font(.title3)
                    .fontWeight(.bold)
                Text(app.bundleId)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let rating = app.rating {
                    HStack(spacing: 6) {
                        RatingStars(rating: rating)
                        Text(String(format: "%.1f", rating))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let count = app.ratingsCount {
                            Text("(\(count))")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

    // MARK: - Stats

    @ViewBuilder
    private func statsGrid(_ stats: Stats) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            StatCard(title: "Keywords", value: "\(stats.keywords)", icon: "key.fill", color: .blue)
            StatCard(title: "Rankings", value: "\(stats.rankings)", icon: "chart.bar.fill", color: .green)
            StatCard(title: "Pending", value: "\(stats.pendingSuggestions)", icon: "lightbulb.fill", color: .orange)
            StatCard(title: "Applied", value: "\(stats.appliedSuggestions)", icon: "checkmark.seal.fill", color: .purple)
        }
    }

    // MARK: - Downloads Chart

    @ViewBuilder
    private func downloadsChart(_ days: [DayData]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Downloads (90 days)", icon: "arrow.down.circle.fill")

            Chart(days) { day in
                AreaMark(
                    x: .value("Date", parseDate(day.date)),
                    y: .value("Downloads", day.downloads)
                )
                .foregroundStyle(
                    .linearGradient(
                        colors: [.blue.opacity(0.4), .blue.opacity(0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.catmullRom)

                LineMark(
                    x: .value("Date", parseDate(day.date)),
                    y: .value("Downloads", day.downloads)
                )
                .foregroundStyle(.blue)
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 15)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .frame(height: 200)
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

    // MARK: - Last Job

    @ViewBuilder
    private func lastJobCard(_ job: LastJob) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Last Job", icon: "clock.fill")
            Text(job.type.replacing("-", with: " ").capitalized)
                .font(.subheadline)
                .fontWeight(.medium)
            StatusBadge(status: job.status)
            if let items = job.itemsCount {
                Text("\(items) items")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    // MARK: - Config

    @ViewBuilder
    private func configCard(_ config: DashboardConfig) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Config", icon: "gearshape.fill")
            Group {
                if let country = config.country {
                    Label(country, systemImage: "globe")
                }
                HStack(spacing: 4) {
                    if config.hasASC == true { configDot(.green) }
                    if config.hasOpenAI == true { configDot(.blue) }
                    if config.hasAnthropic == true { configDot(.purple) }
                }
                if let interval = config.scrapeInterval {
                    Label("\(interval)h interval", systemImage: "clock.arrow.circlepath")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    private func configDot(_ color: Color) -> some View {
        Circle().fill(color).frame(width: 8, height: 8)
    }

    // MARK: - Recent Suggestions

    @ViewBuilder
    private func recentSuggestionsSection(_ suggestions: [RecentSuggestion]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Recent Suggestions", icon: "lightbulb.fill")

            ForEach(suggestions.prefix(5)) { suggestion in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(suggestion.type)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.tint)
                            Text(suggestion.locale)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Text(suggestion.value)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    Spacer()
                    StatusBadge(status: suggestion.status)
                }
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

    // MARK: - Helpers

    private func parseDate(_ string: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(string.prefix(10))) ?? Date()
    }

    private func loadData() async {
        isLoading = true
        error = nil
        do {
            async let dashResult = APIService.shared.getDashboard(bundleId: bundleId)
            async let downloadResult = APIService.shared.getDownloads(bundleId: bundleId, days: 90)
            let (dash, dl) = try await (dashResult, downloadResult)
            dashboard = dash
            downloads = dl
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
