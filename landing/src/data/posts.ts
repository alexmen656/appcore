export interface PostSection {
  type: 'h2' | 'p' | 'ul' | 'callout';
  text?: string;
  items?: string[];
}

export interface Post {
  slug: string;
  title: string;
  category: string;
  catClass: string;
  date: string;
  author: { initials: string; name: string };
  readTime: string;
  excerpt: string;
  content: PostSection[];
}

export const posts: Post[] = [
  {
    slug: 'how-to-pick-keywords-that-actually-rank-in-2026',
    title: 'How to pick keywords that actually rank in 2026',
    category: 'ASO',
    catClass: 'cat-aso',
    date: 'March 5, 2026',
    author: { initials: 'LK', name: 'Lena K.' },
    readTime: '8 min read',
    excerpt:
      'The App Store algorithm has changed significantly over the past 18 months. Here\'s the exact keyword selection framework we recommend — backed by data from 2.4 million tracked keywords.',
    content: [
      {
        type: 'p',
        text: 'If you\'ve been doing ASO the same way since 2023, you\'re leaving downloads on the table. Apple and Google have both updated how they weigh keyword signals, and the strategies that worked 18 months ago are producing noticeably worse results today.',
      },
      {
        type: 'p',
        text: 'We analyzed over 2.4 million tracked keywords across the Marteso platform to build this framework. Here\'s what the data actually says.',
      },
      { type: 'h2', text: 'The volume trap' },
      {
        type: 'p',
        text: 'Most teams still start keyword research by sorting by search volume and picking the highest numbers. This is the single most common mistake we see. High-volume keywords are dominated by apps with hundreds of thousands of ratings. Unless you\'re already in the top 10, you won\'t rank — no matter how well you optimize.',
      },
      {
        type: 'p',
        text: 'The better metric is the difficulty-to-volume ratio. You want keywords with enough searches to matter, but where the competition hasn\'t fully saturated the top results.',
      },
      { type: 'h2', text: 'The framework: 3 keyword tiers' },
      {
        type: 'p',
        text: 'We recommend building your keyword strategy in three tiers:',
      },
      {
        type: 'ul',
        items: [
          'Anchor keywords (5–10): Your core category terms. High volume, high difficulty. You probably won\'t rank #1, but being in the top 20 still drives discovery.',
          'Growth keywords (20–40): Medium volume, medium difficulty. These are your workhorse terms — the ones that will drive most of your organic installs within 90 days.',
          'Long-tail keywords (50–100): Low volume, low competition. These punch above their weight because conversion rates are much higher when intent is specific.',
        ],
      },
      { type: 'h2', text: 'Signals the algorithm now weights heavily' },
      {
        type: 'p',
        text: 'Based on our data from Q4 2025 through Q1 2026, the App Store algorithm shows significantly stronger correlation between installs and ranking for the following:',
      },
      {
        type: 'ul',
        items: [
          'Keyword appearance in reviews (not just metadata)',
          'Session length and retention for users who found the app via that keyword',
          'Velocity of installs in the first 72 hours after a metadata update',
          'Ratings from users acquired via organic search (vs. paid)',
        ],
      },
      {
        type: 'callout',
        text: 'Keywords that appear naturally in your user reviews carry roughly 1.4× more ranking weight than the same keywords in your subtitle field alone. Encourage users to write detailed reviews.',
      },
      { type: 'h2', text: 'How to validate before committing' },
      {
        type: 'p',
        text: 'Never update your metadata with an untested keyword set. Use Marteso\'s keyword simulator to estimate rank potential before publishing. Run 2-week sprints: update, track rank changes, roll back or double down based on data.',
      },
      {
        type: 'p',
        text: 'The teams seeing the best results are running keyword updates every 3–4 weeks with tight feedback loops. Not quarterly. Not annually. Monthly.',
      },
      { type: 'h2', text: 'The one thing to do today' },
      {
        type: 'p',
        text: 'Pull your current keyword list and remove anything with a difficulty score above 80 where you\'re not already ranking in the top 15. Redirect that character budget to 5–8 growth-tier keywords you haven\'t tested yet. Check back in two weeks.',
      },
    ],
  },
  {
    slug: '60-day-aso-playbook',
    title: 'The 60-day ASO playbook: from launch to top charts',
    category: 'Growth',
    catClass: 'cat-growth',
    date: 'Feb 26, 2026',
    author: { initials: 'MR', name: 'Marc R.' },
    readTime: '12 min read',
    excerpt:
      'A step-by-step roadmap for new apps: what to focus on in weeks 1–2, 3–6, and 7–12 to build momentum in the rankings.',
    content: [
      {
        type: 'p',
        text: 'Most apps fail at ASO not because of bad optimization, but because of bad sequencing. They try to do everything at once and end up with a diluted strategy that produces mediocre results across the board.',
      },
      {
        type: 'p',
        text: 'This playbook is built on one principle: do fewer things at the right time. Here\'s the 60-day structure we recommend for every new app.',
      },
      { type: 'h2', text: 'Week 1–2: Foundation' },
      {
        type: 'p',
        text: 'Before you touch metadata, you need a baseline. Your first two weeks are about measurement, not optimization.',
      },
      {
        type: 'ul',
        items: [
          'Set up keyword tracking for 80–120 terms across your three tiers',
          'Benchmark your current conversion rate from store listing views to installs',
          'Analyze your top 5 competitors\' full metadata stack',
          'Identify the 3 keyword clusters where you have the most realistic path to top 10',
        ],
      },
      {
        type: 'p',
        text: 'Don\'t update anything yet. You\'re establishing your starting point.',
      },
      { type: 'h2', text: 'Week 3–6: First metadata sprint' },
      {
        type: 'p',
        text: 'Now you move. Rewrite your title, subtitle, and keyword fields based on your week 1–2 research. Focus exclusively on your growth-tier keywords — the medium-volume, medium-difficulty terms.',
      },
      {
        type: 'callout',
        text: 'One metadata update per sprint. If you change your icon, description, and keywords all at once, you won\'t know what moved the needle.',
      },
      {
        type: 'p',
        text: 'During weeks 3–6, also launch your first icon A/B test. Start with a single variable: background color or foreground element, not both. Let it run for at least 14 days before reading results.',
      },
      { type: 'h2', text: 'Week 7–10: Double down' },
      {
        type: 'p',
        text: 'By now you should have 4 weeks of post-update data. Look at which keyword clusters moved. Double down on the ones gaining traction — add supporting long-tail terms, work those keywords into your description.',
      },
      {
        type: 'p',
        text: 'This is also the week to start your screenshot refresh. Your screenshots are often the highest-leverage conversion element after your icon. Focus on the first two frames — 80% of users never scroll past them.',
      },
      { type: 'h2', text: 'Week 11–60: Compound iteration' },
      {
        type: 'p',
        text: 'The last phase is about compounding. Run one metadata sprint every 3–4 weeks. Run one creative test per sprint. Build a ratings response template so you\'re replying to every review within 48 hours — this directly impacts your conversion rate.',
      },
      {
        type: 'p',
        text: 'By day 60, apps following this playbook typically see a 40–60% increase in organic install volume versus their day-1 baseline. The gains come from three places: higher keyword ranks, better conversion, and improved review sentiment.',
      },
      { type: 'h2', text: 'What most teams skip' },
      {
        type: 'p',
        text: 'The most common failure mode is abandoning the process after two weeks because results feel slow. ASO compounds over 30–90 day windows. The teams that win are the ones who stay consistent with monthly sprints for at least two quarters.',
      },
    ],
  },
  {
    slug: 'ab-testing-app-icon',
    title: 'A/B testing your app icon: what we learned from 200+ experiments',
    category: 'Guide',
    catClass: 'cat-guide',
    date: 'Feb 18, 2026',
    author: { initials: 'JB', name: 'Julia B.' },
    readTime: '9 min read',
    excerpt:
      'Icon tests consistently show the highest conversion lift of any store listing element. Here\'s what works, what doesn\'t, and how to read the data correctly.',
    content: [
      {
        type: 'p',
        text: 'We\'ve tracked over 200 icon A/B tests run through Marteso, covering categories from productivity and games to health and finance. The data is surprisingly consistent — and often counterintuitive.',
      },
      { type: 'h2', text: 'Why icons matter more than you think' },
      {
        type: 'p',
        text: 'In search results, your icon is often the only visual element a user sees before deciding whether to tap your listing. Store listing page views where the icon was the primary variable show an average 22% difference in click-through rate between the best and worst variants.',
      },
      {
        type: 'p',
        text: 'That 22% difference in CTR translates directly to installs — and indirectly to keyword ranking, since install velocity is an algorithm signal.',
      },
      { type: 'h2', text: 'What consistently wins' },
      {
        type: 'ul',
        items: [
          'High contrast backgrounds: Icons with strong contrast between foreground and background outperform low-contrast variants in 78% of tests',
          'Faces and characters: Human faces and character-based icons show +15% average CTR lift in non-game categories',
          'Single focal element: Icons with one clear focal element beat busy, multi-element designs in 71% of tests',
          'Warm color palettes: Red, orange, and yellow backgrounds consistently outperform cool colors in Browse (not search) surfaces',
        ],
      },
      { type: 'h2', text: 'What consistently loses' },
      {
        type: 'ul',
        items: [
          'Text in icons: Any icon with text (including the app name) underperforms at small sizes',
          'Gradients without contrast: Subtle gradient backgrounds get lost in the store grid',
          'Category clichés: Icons that look identical to the top 3 apps in their category rarely beat those apps on CTR',
          'White backgrounds: Performs poorly on iOS where white backgrounds blend into the store UI',
        ],
      },
      {
        type: 'callout',
        text: 'The most impactful single change you can make: switch from a gradient to a solid, high-saturation background. This one change produces a measurable lift in 6 out of 10 tests.',
      },
      { type: 'h2', text: 'How to run a valid test' },
      {
        type: 'p',
        text: 'Apple\'s Product Page Optimization tool requires a minimum of 90 days and enough traffic to achieve statistical significance. For most apps, this means at least 2,000 impressions per variant before the results are trustworthy.',
      },
      {
        type: 'p',
        text: 'Common mistakes that invalidate results: running a test during an unusual traffic period (holiday seasons, major update launch), testing too many variables at once, or stopping the test too early because one variant looks like it\'s winning.',
      },
      { type: 'h2', text: 'Reading the data correctly' },
      {
        type: 'p',
        text: 'A lift in tap-through rate doesn\'t automatically mean the winning icon is better for your business. Look at downstream metrics: do users who installed via the winning icon have better Day-1 retention? Lower early churn? If the "better" icon attracts users who don\'t stick around, you may be optimizing for the wrong signal.',
      },
    ],
  },
  {
    slug: 'review-sentiment-product-backlog',
    title: 'How to use review sentiment to prioritize your product backlog',
    category: 'ASO',
    catClass: 'cat-aso',
    date: 'Feb 10, 2026',
    author: { initials: 'LK', name: 'Lena K.' },
    readTime: '7 min read',
    excerpt:
      'Your reviews are a goldmine of product intelligence. Here\'s how to systematically extract actionable insights from thousands of reviews each month.',
    content: [
      {
        type: 'p',
        text: 'The average top-100 app receives 800–2,000 reviews per month. Almost no team has a system for reading them systematically. The ones that do have a meaningful competitive advantage — not just in ASO, but in product development.',
      },
      { type: 'h2', text: 'Why reviews are underused' },
      {
        type: 'p',
        text: 'Most teams rely on the average star rating and spot-check a few recent reviews. This approach misses the signal. Individual reviews are noisy; aggregated sentiment across topics is where the intelligence lives.',
      },
      {
        type: 'p',
        text: 'When you look at sentiment by feature cluster — onboarding, core functionality, pricing, support, performance — patterns emerge that you can\'t see from your analytics dashboard.',
      },
      { type: 'h2', text: 'The sentiment tagging system' },
      {
        type: 'p',
        text: 'Start by categorizing every review into one of three sentiment buckets per topic: positive mention, negative mention, neutral/no mention. You\'re building a frequency map, not reading for individual stories.',
      },
      {
        type: 'callout',
        text: 'Marteso\'s review analysis feature automatically tags reviews by topic cluster and sentiment, then surfaces the top themes by volume and rating impact. You can filter by date, star rating, or region.',
      },
      { type: 'h2', text: 'Turning sentiment into backlog priorities' },
      {
        type: 'p',
        text: 'Once you have sentiment data by topic, apply a simple scoring matrix:',
      },
      {
        type: 'ul',
        items: [
          'High mention frequency + negative sentiment = fix this first (it\'s hurting your rating)',
          'High mention frequency + positive sentiment = protect this in every release',
          'Low mention frequency + negative sentiment = monitor but don\'t prioritize',
          'Low mention frequency + positive sentiment = potential differentiator to amplify in your store listing',
        ],
      },
      { type: 'h2', text: 'The ASO connection' },
      {
        type: 'p',
        text: 'Review sentiment has a direct relationship with your store ranking. Apps that improve their average rating by 0.1 stars (e.g., from 4.2 to 4.3) see an average 8% uplift in conversion from listing view to install.',
      },
      {
        type: 'p',
        text: 'More importantly: the keywords users use in negative reviews signal exactly what your competitors\' weak points are. If users keep writing "better than [Competitor X] because it doesn\'t crash," you should be ranking for "[Competitor X] alternative."',
      },
      { type: 'h2', text: 'What to do this week' },
      {
        type: 'p',
        text: 'Pull your last 6 months of reviews. Group them by star rating. Read all the 2-star and 3-star reviews carefully — these are your most actionable: users who tried your app, had a problem, but still care enough to explain why. That explanation is your product backlog.',
      },
    ],
  },
  {
    slug: 'writing-app-store-titles',
    title: 'Writing App Store titles that rank and convert',
    category: 'Guide',
    catClass: 'cat-guide',
    date: 'Jan 30, 2026',
    author: { initials: 'MR', name: 'Marc R.' },
    readTime: '6 min read',
    excerpt:
      'Your 30-character title is the single most impactful ASO lever you have. Here\'s how to use every character strategically without keyword stuffing.',
    content: [
      {
        type: 'p',
        text: 'Apple gives you 30 characters for your app title. Google gives you 30 characters for your short title. In both stores, this field carries more ranking weight than any other metadata field — and yet most apps waste it.',
      },
      { type: 'h2', text: 'The two jobs of your title' },
      {
        type: 'p',
        text: 'Your title needs to do two things simultaneously: rank for keywords, and convince a human to tap. These goals are in tension. A title optimized purely for keywords looks spammy and reduces conversion. A title optimized purely for brand recall leaves ranking potential untapped.',
      },
      {
        type: 'p',
        text: 'The formula that works: [Brand name] – [Primary keyword phrase]. The dash or em-dash creates a natural visual separator that improves readability while cramming a keyword into a visible, high-weight field.',
      },
      { type: 'h2', text: 'Character budget allocation' },
      {
        type: 'ul',
        items: [
          'Brand name: 8–14 characters (keep it short if possible — every saved character is an opportunity)',
          'Separator: 3 characters ( – )',
          'Keyword phrase: 13–19 characters remaining',
        ],
      },
      {
        type: 'p',
        text: 'With 17 characters of keyword space, you can fit one strong 2–3 word phrase. Don\'t try to fit two — it reads as keyword stuffing and Apple has been rejecting apps with titles like "App Name – Keyword1 Keyword2 Keyword3."',
      },
      {
        type: 'callout',
        text: 'Apple\'s review team now flags titles with more than 3 keyword-like terms after the dash. Stick to one clear, natural-sounding phrase.',
      },
      { type: 'h2', text: 'Picking the right keyword for your title' },
      {
        type: 'p',
        text: 'Your title keyword should be your single best growth-tier keyword: high enough volume to matter, low enough competition that you can realistically break into the top 15. Don\'t waste the title on an anchor keyword you\'ll never rank for.',
      },
      {
        type: 'p',
        text: 'Check your current rankings first. If you\'re already in the top 5 for a keyword from your subtitle, it may make sense to elevate that keyword to your title to capture even more ranking weight.',
      },
      { type: 'h2', text: 'What to avoid' },
      {
        type: 'ul',
        items: [
          'Category descriptors as your only keyword ("Productivity App", "Fitness Tracker") — too broad to rank for',
          'Superlatives ("Best", "#1", "Ultimate") — Apple rejects these',
          'Version numbers in titles ("v2.0", "Pro 2026") — wastes characters',
          'Your company name if it\'s different from the app name — use the subtitle for that',
        ],
      },
      { type: 'h2', text: 'Test before you commit' },
      {
        type: 'p',
        text: 'A title change is a high-stakes update — it affects both ranking and conversion simultaneously. Use Marteso\'s keyword simulator to forecast rank impact before submitting. Then track your conversion rate for 14 days after the change to catch any negative conversion effects before they compound.',
      },
    ],
  },
  {
    slug: 'competitor-keyword-research',
    title: 'Competitor keyword research: a step-by-step framework',
    category: 'Growth',
    catClass: 'cat-growth',
    date: 'Jan 22, 2026',
    author: { initials: 'JB', name: 'Julia B.' },
    readTime: '11 min read',
    excerpt:
      'How to systematically analyze what your top competitors rank for — and identify the gaps you can fill in your next metadata update.',
    content: [
      {
        type: 'p',
        text: 'Your competitors have already done years of keyword experimentation. Their current metadata reflects what works in your category. Ignoring it is leaving free intelligence on the table.',
      },
      {
        type: 'p',
        text: 'This framework walks through the process of extracting competitor keyword data and turning it into actionable updates for your own metadata.',
      },
      { type: 'h2', text: 'Step 1: Define your competitor set' },
      {
        type: 'p',
        text: 'Start with direct competitors — apps your target users would consider as alternatives to yours. Limit this to 5–7 apps. You\'re looking for competitors who are actively investing in ASO (update their metadata regularly, have strong keyword ranks) not just apps in your category.',
      },
      {
        type: 'p',
        text: 'Signals that a competitor is doing serious ASO: frequent metadata updates (check version history), high keyword diversity across their listing, strong ranks for mid-difficulty terms.',
      },
      { type: 'h2', text: 'Step 2: Extract their keyword footprint' },
      {
        type: 'p',
        text: 'For each competitor, pull their full keyword rank profile using Marteso\'s competitor analysis view. You\'re looking for:',
      },
      {
        type: 'ul',
        items: [
          'All keywords where they rank in the top 10',
          'Keywords where they rank 11–25 (these are their "almost there" terms — they\'re investing here)',
          'Keywords they rank for that you don\'t track at all yet',
        ],
      },
      { type: 'h2', text: 'Step 3: Build a gap matrix' },
      {
        type: 'p',
        text: 'A gap matrix maps your current keyword performance against your competitors\'. The goal is to find keywords where:',
      },
      {
        type: 'ul',
        items: [
          'Multiple competitors rank well, but you don\'t — indicates demand without your presence',
          'You rank better than competitors — indicates opportunities to protect and expand',
          'Nobody ranks well — indicates potential untapped whitespace',
        ],
      },
      {
        type: 'callout',
        text: 'Focus first on the first bucket: keywords where 3+ competitors rank in the top 10 but you\'re not in the top 25. This is proven demand with a clear gap to fill.',
      },
      { type: 'h2', text: 'Step 4: Prioritize by realistic rank potential' },
      {
        type: 'p',
        text: 'Not every gap keyword is worth pursuing. Filter by: volume (minimum 500 monthly searches), difficulty relative to your app\'s authority (don\'t chase keywords where all top-10 apps have 100k+ ratings if you have 2k), and relevance (only keywords where users finding your app via that keyword would convert well).',
      },
      { type: 'h2', text: 'Step 5: Map gaps to metadata fields' },
      {
        type: 'p',
        text: 'Once you have your priority gap keywords, map each one to the most appropriate metadata field. High-priority terms go in title or subtitle. Medium-priority go in your keyword field. Support terms go in your description for Google Play.',
      },
      {
        type: 'p',
        text: 'Avoid keyword cannibalization: don\'t use the same keyword stem in both your title and keyword field. You get no additional ranking benefit, and you waste character budget.',
      },
      { type: 'h2', text: 'Ongoing monitoring' },
      {
        type: 'p',
        text: 'Competitor keyword strategy isn\'t a one-time exercise. Set up alerts in Marteso to notify you when a competitor makes a significant metadata change. When they update their title or subtitle, they\'re telling you what they think is worth optimizing for right now.',
      },
    ],
  },
  {
    slug: 'marteso-v1-7-autonomous-mode',
    title: 'Introducing Marteso v1.7: Autonomous Mode',
    category: 'Product',
    catClass: 'cat-product',
    date: 'Jan 10, 2026',
    author: { initials: 'AP', name: 'Marteso Team' },
    readTime: '5 min read',
    excerpt:
      'Our biggest release yet: Autonomous Mode lets Marteso proactively surface opportunities and draft actions for you to approve — without replacing your judgment.',
    content: [
      {
        type: 'p',
        text: 'Today we\'re releasing Marteso v1.7, and with it the feature we\'ve been building toward since day one: Autonomous Mode. This is the biggest product update in our history.',
      },
      { type: 'h2', text: 'What is Autonomous Mode?' },
      {
        type: 'p',
        text: 'Autonomous Mode turns Marteso from a passive analytics tool into an active ASO partner. Instead of waiting for you to log in and check your dashboard, Marteso now proactively monitors your keyword portfolio, competitor movements, and conversion data — and surfaces the actions it recommends you take.',
      },
      {
        type: 'p',
        text: 'Crucially: Marteso never takes action without your approval. Every recommendation comes with a one-click approve or dismiss interface. You\'re always in control. We\'ve designed this explicitly to augment your judgment, not replace it.',
      },
      { type: 'h2', text: 'What Autonomous Mode watches for' },
      {
        type: 'ul',
        items: [
          'Keyword ranking drops: When a keyword you rely on drops more than 5 positions in 48 hours, Marteso investigates why and drafts a recovery action',
          'Competitor metadata changes: When a top competitor updates their title or keyword field, Marteso flags it and suggests whether you should respond',
          'Conversion rate anomalies: When your store listing conversion rate drops below your 30-day baseline, Marteso identifies the most likely cause',
          'Review sentiment shifts: When a new topic cluster emerges in your reviews, Marteso surfaces it with a suggested response strategy',
          'Keyword opportunity windows: When a mid-tier keyword you track becomes less competitive (a top-ranked app drops), Marteso flags the opening',
        ],
      },
      { type: 'h2', text: 'How the recommendations work' },
      {
        type: 'p',
        text: 'Each recommendation includes: the signal that triggered it, the supporting data, the proposed action (including a draft metadata update if applicable), and an estimated impact score based on historical data from similar apps in your category.',
      },
      {
        type: 'callout',
        text: 'In our beta, teams using Autonomous Mode responded to ranking changes 4× faster than teams without it — and saw 28% better recovery rates on dropped keywords.',
      },
      { type: 'h2', text: 'Setting up Autonomous Mode' },
      {
        type: 'p',
        text: 'Autonomous Mode is available on all paid plans starting today. Go to Settings → Autonomous Mode to configure which signals you want Marteso to monitor and how you\'d like to receive recommendations (in-app, email, or Slack).',
      },
      {
        type: 'p',
        text: 'You can also set sensitivity thresholds — if you only want to be notified about high-confidence recommendations, set the confidence filter to 80%+. If you want to see everything, leave it at the default.',
      },
      { type: 'h2', text: 'What\'s next' },
      {
        type: 'p',
        text: 'v1.7 is the foundation. In Q2 2026, we\'re building direct metadata submission — so when you approve a Marteso recommendation, it can push the update to App Store Connect directly. No copy-pasting required. We\'ll have more to share in March.',
      },
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
