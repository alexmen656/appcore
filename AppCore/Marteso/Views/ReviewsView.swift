import SwiftUI

struct ReviewsView: View {
    let bundleId: String?

    @State private var reviews: [Review] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && reviews.isEmpty {
                LoadingView("Loading reviews...")
            } else if let error, reviews.isEmpty {
                ErrorView(message: error) { Task { await loadReviews() } }
            } else if reviews.isEmpty {
                EmptyStateView(
                    icon: "star.bubble.fill",
                    title: "No Reviews",
                    message: "Sync analytics to load app reviews."
                )
            } else {
                reviewsList
            }
        }
        .navigationTitle("Reviews")
        .refreshable { await loadReviews() }
        .task { await loadReviews() }
    }

    @ViewBuilder
    private var reviewsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                // Summary
                if !reviews.isEmpty {
                    let avgRating = Double(reviews.reduce(0) { $0 + $1.rating }) / Double(reviews.count)
                    HStack(spacing: 16) {
                        VStack(spacing: 4) {
                            Text(String(format: "%.1f", avgRating))
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                            RatingStars(rating: avgRating)
                            Text("\(reviews.count) reviews")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Distribution
                        VStack(alignment: .trailing, spacing: 3) {
                            ForEach((1...5).reversed(), id: \.self) { star in
                                HStack(spacing: 4) {
                                    Text("\(star)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .frame(width: 10)
                                    Image(systemName: "star.fill")
                                        .font(.system(size: 8))
                                        .foregroundStyle(.yellow)
                                    GeometryReader { geo in
                                        let count = reviews.filter { $0.rating == star }.count
                                        let pct = Double(count) / Double(reviews.count)
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(pct > 0 ? Color.yellow : Color.secondary.opacity(0.25))
                                            .frame(width: geo.size.width * pct)
                                    }
                                    .frame(width: 100, height: 8)
                                }
                            }
                        }
                    }
                    .padding()
                    .glassEffect(.regular, in: .rect(cornerRadius: 20))
                    .padding(.horizontal)
                }

                ForEach(reviews) { review in
                    reviewCard(review)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    @ViewBuilder
    private func reviewCard(_ review: Review) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                RatingStars(rating: Double(review.rating))
                Spacer()
                if let territory = review.territory {
                    Text(countryFlag(territory) + " " + territory)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            if let title = review.title, !title.isEmpty {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            if let body = review.body, !body.isEmpty {
                Text(body)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(5)
            }

            HStack {
                if let reviewer = review.reviewerNickname {
                    Text(reviewer)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Spacer()
                if let date = review.reviewedAt {
                    Text(formatDate(date))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding()
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    private func countryFlag(_ code: String) -> String {
        let base: UInt32 = 127397
        return String(code.uppercased().unicodeScalars.compactMap { UnicodeScalar(base + $0.value) }.map { Character($0) })
    }

    private func formatDate(_ dateStr: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = iso.date(from: dateStr) else { return dateStr }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func loadReviews() async {
        isLoading = true
        error = nil
        do {
            reviews = try await APIService.shared.getReviews(bundleId: bundleId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
