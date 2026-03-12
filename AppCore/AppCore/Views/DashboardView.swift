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
                if let app = data.app {
                    appInfoCard(app)
                }

                statsGrid(data.stats)

                if let downloads, !downloads.byDay.isEmpty {
                    downloadsChart(downloads.byDay)
                }

                if !data.recentSuggestions.isEmpty {
                    recentSuggestionsSection(data.recentSuggestions)
                }
            }
            .padding()
        }
    }

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

    private struct DownloadChartDay: Identifiable {
        let date: Date
        let downloads: Int

        var id: Date { date }
    }

    private struct SevenDayDownloadSnapshot {
        let days: [DownloadChartDay]
        let total: Int
        let previousTotal: Int
        let dailyAverage: Int
        let yUpperBound: Int
    }

    @ViewBuilder
    private func downloadsChart(_ days: [DayData]) -> some View {
        let snapshot = buildSevenDaySnapshot(from: days)
        let trend = trendPercent(current: snapshot.total, previous: snapshot.previousTotal)
        let firstDate = snapshot.days.first?.date
        let lastDate = snapshot.days.last?.date
        let xAxisDates = [firstDate, lastDate].compactMap { $0 }

        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Downloads")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Daily Average: \(snapshot.dailyAverage)")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 6) {
                    Text(snapshot.total.formatted())
                        .font(.system(size: 44, weight: .semibold, design: .rounded))

                    HStack(spacing: 6) {
                        Image(systemName: trendSymbol(for: trend))
                        Text("\(abs(trend))%")
                    }
                    .font(.title2)
                    .foregroundStyle(trendColor(for: trend))
                }
            }

            Chart(snapshot.days) { day in
                BarMark(
                    x: .value("Date", day.date, unit: .day),
                    y: .value("Downloads", day.downloads)
                )
                .foregroundStyle(.blue.gradient)
                .cornerRadius(6)
            }
            .frame(height: 190)
            .chartYScale(domain: 0...Double(snapshot.yUpperBound))
            .chartYAxis {
                AxisMarks(position: .trailing, values: [0, Double(snapshot.yUpperBound) / 2, Double(snapshot.yUpperBound)]) { value in
                    if let yValue = value.as(Double.self), yValue == Double(snapshot.yUpperBound) / 2 {
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                            .foregroundStyle(.quaternary)
                    } else {
                        AxisGridLine()
                            .foregroundStyle(.quaternary)
                    }

                    AxisTick(stroke: StrokeStyle(lineWidth: 0))

                    AxisValueLabel {
                        if let yValue = value.as(Double.self), Int(yValue) == snapshot.yUpperBound {
                            Text(snapshot.yUpperBound.formatted())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: xAxisDates) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0))
                    AxisTick(stroke: StrokeStyle(lineWidth: 0))
                    AxisValueLabel {
                        if let date = value.as(Date.self) {
                            Text(xAxisLabel(for: date, firstDate: firstDate, lastDate: lastDate))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

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

    private func parseDate(_ string: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: String(string.prefix(10))) ?? Date()
    }

    private func buildSevenDaySnapshot(from days: [DayData]) -> SevenDayDownloadSnapshot {
        let calendar = Calendar.current
        var downloadsByDate: [Date: Int] = [:]

        for day in days {
            let normalizedDate = calendar.startOfDay(for: parseDate(day.date))
            downloadsByDate[normalizedDate, default: 0] += day.downloads
        }

        let anchorDate = downloadsByDate.keys.max() ?? calendar.startOfDay(for: Date())
        let fourteenDays: [DownloadChartDay] = (0..<14).compactMap { offset in
            guard let date = calendar.date(byAdding: .day, value: offset - 13, to: anchorDate) else {
                return nil
            }
            let normalizedDate = calendar.startOfDay(for: date)
            return DownloadChartDay(date: normalizedDate, downloads: downloadsByDate[normalizedDate] ?? 0)
        }

        let previousWeek = Array(fourteenDays.prefix(7))
        let currentWeek = Array(fourteenDays.suffix(7))
        let currentTotal = currentWeek.reduce(0) { $0 + $1.downloads }
        let previousTotal = previousWeek.reduce(0) { $0 + $1.downloads }
        let dailyAverage = currentTotal / max(currentWeek.count, 1)
        let maxValue = currentWeek.map(\.downloads).max() ?? 0

        return SevenDayDownloadSnapshot(
            days: currentWeek,
            total: currentTotal,
            previousTotal: previousTotal,
            dailyAverage: dailyAverage,
            yUpperBound: chartUpperBound(for: maxValue)
        )
    }

    private func chartUpperBound(for maxValue: Int) -> Int {
        guard maxValue > 5 else { return 5 }

        let magnitude = pow(10.0, floor(log10(Double(maxValue))))
        let normalized = Double(maxValue) / magnitude
        let rounded: Double

        if normalized <= 1 {
            rounded = 1
        } else if normalized <= 2 {
            rounded = 2
        } else if normalized <= 5 {
            rounded = 5
        } else {
            rounded = 10
        }

        return Int(rounded * magnitude)
    }

    private func trendPercent(current: Int, previous: Int) -> Int {
        guard previous > 0 else {
            return current == 0 ? 0 : 100
        }
        return Int((Double(current - previous) / Double(previous) * 100).rounded())
    }

    private func trendSymbol(for trend: Int) -> String {
        if trend > 0 { return "arrow.up.right" }
        if trend < 0 { return "arrow.down.right" }
        return "arrow.right"
    }

    private func trendColor(for trend: Int) -> Color {
        if trend > 0 { return .green }
        if trend < 0 { return .red }
        return .secondary
    }

    private func xAxisLabel(for date: Date, firstDate: Date?, lastDate: Date?) -> String {
        let calendar = Calendar.current

        if let firstDate, calendar.isDate(date, inSameDayAs: firstDate) {
            return formatMonthDay(date)
        }

        if let firstDate, let lastDate, calendar.isDate(date, inSameDayAs: lastDate) {
            let sameMonth = calendar.isDate(firstDate, equalTo: lastDate, toGranularity: .month)
            let sameYear = calendar.isDate(firstDate, equalTo: lastDate, toGranularity: .year)
            return (sameMonth && sameYear) ? formatDay(date) : formatMonthDay(date)
        }

        return formatMonthDay(date)
    }

    private func formatMonthDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func formatDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private func loadData() async {
        isLoading = true
        error = nil
        do {
            async let dashResult = APIService.shared.getDashboard(bundleId: bundleId)
            async let downloadResult = APIService.shared.getDownloads(bundleId: bundleId, days: 14)
            let (dash, dl) = try await (dashResult, downloadResult)
            dashboard = dash
            downloads = dl
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
