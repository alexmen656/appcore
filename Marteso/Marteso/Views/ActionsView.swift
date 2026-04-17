import SwiftUI

struct ActionsView: View {
    let bundleId: String?

    @State private var jobs: [Job] = []
    @State private var schedulerStatus: SchedulerStatus?
    @State private var isLoading = true
    @State private var runningAction: String?
    @State private var error: String?

    private let actions: [(name: String, action: String, icon: String, color: Color, description: String)] = [
        ("Scrape", "scrape", "globe", .blue, "Scrape App Store metadata"),
        ("Analyze", "analyze", "brain", .purple, "Run AI analysis"),
        ("Sync ASC", "sync", "arrow.triangle.2.circlepath", .green, "Sync from App Store Connect"),
        ("Track Keywords", "track-keywords", "chart.bar.fill", .orange, "Track keyword rankings"),
        ("Discover Keywords", "discover-keywords", "magnifyingglass", .cyan, "AI keyword discovery"),
        ("Discover Competitors", "discover-competitors", "person.2.fill", .pink, "Find competitors"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if isLoading && jobs.isEmpty {
                    LoadingView("Loading...")
                } else {
                    // Scheduler Status
                    if let scheduler = schedulerStatus {
                        schedulerCard(scheduler)
                    }

                    // Action Cards
                    actionCards

                    // Jobs List
                    if !jobs.isEmpty {
                        jobsList
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Actions & Jobs")
        .refreshable { await loadData() }
        .task { await loadData() }
    }

    // MARK: - Scheduler Card

    @ViewBuilder
    private func schedulerCard(_ scheduler: SchedulerStatus) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                SectionHeader("Scheduler", icon: "clock.arrow.circlepath")
                Text(scheduler.running ? "Running" : "Stopped")
                    .font(.subheadline)
                    .foregroundStyle(scheduler.running ? .green : .secondary)
            }
            Spacer()
            Button {
                Task {
                    if scheduler.running {
                        try? await APIService.shared.stopScheduler()
                    } else {
                        try? await APIService.shared.startScheduler()
                    }
                    await loadData()
                }
            } label: {
                Image(systemName: scheduler.running ? "stop.circle.fill" : "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(scheduler.running ? .red : .green)
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    // MARK: - Action Cards

    @ViewBuilder
    private var actionCards: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(actions, id: \.action) { item in
                Button {
                    Task {
                        runningAction = item.action
                        try? await APIService.shared.triggerAction(item.action)
                        runningAction = nil
                        await loadData()
                    }
                } label: {
                    VStack(spacing: 8) {
                        if runningAction == item.action {
                            ProgressView()
                                .frame(height: 30)
                        } else {
                            Image(systemName: item.icon)
                                .font(.title3)
                                .foregroundStyle(item.color)
                                .frame(height: 30)
                        }
                        Text(item.name)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                        Text(item.description)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .glassEffect(.regular, in: .rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .disabled(runningAction != nil)
            }
        }
    }

    // MARK: - Jobs List

    @ViewBuilder
    private var jobsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Recent Jobs", icon: "list.bullet.circle.fill")

            ForEach(jobs.prefix(20)) { job in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(job.type.replacing("-", with: " ").capitalized)
                            .font(.subheadline)
                            .fontWeight(.medium)

                        HStack(spacing: 8) {
                            Text(formatDate(job.createdAt))
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            if let items = job.itemsCount {
                                Text("\(items) items")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if let error = job.error {
                            Text(error)
                                .font(.caption2)
                                .foregroundStyle(.red)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                    StatusBadge(status: job.status)
                }
                .padding()
                .glassEffect(.regular, in: .rect(cornerRadius: 14))
            }
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateStr) else { return dateStr }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .abbreviated
        return relative.localizedString(for: date, relativeTo: Date())
    }

    private func loadData() async {
        isLoading = true
        do {
            async let jobsResult = APIService.shared.getJobs()
            async let schedulerResult = APIService.shared.getSchedulerStatus()
            let (j, s) = try await (jobsResult, schedulerResult)
            jobs = j
            schedulerStatus = s
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
