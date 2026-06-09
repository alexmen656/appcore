<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the marteso React app. PostHog is initialized in `src/main.tsx` with `PostHogProvider` and `PostHogErrorBoundary` wrapping the entire app, enabling automatic error capture and the React hooks API throughout the component tree. Users are identified on every sign-in and sign-up path (email/password, passkey, demo, GitHub OAuth, and Google OAuth), and `posthog.reset()` is called on logout to cleanly separate sessions. Fifteen events cover the full user lifecycle: acquisition, onboarding, core ASO actions (suggestions, keywords, competitors), billing intent, and team growth.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created a new account | `src/components/login/Login.tsx` |
| `user_logged_in` | User successfully signed in | `src/components/login/Login.tsx`, `src/App.tsx` |
| `app_imported` | User imported an app from the App Store during onboarding | `src/components/Onboarding.tsx` |
| `onboarding_completed` | User completed the onboarding flow | `src/components/Onboarding.tsx` |
| `ai_analysis_started` | User triggered an AI-powered ASO analysis run | `src/components/suggestions/Suggestions.tsx` |
| `suggestion_approved` | User approved an AI-generated metadata suggestion | `src/components/suggestions/Suggestions.tsx` |
| `suggestion_rejected` | User rejected an AI-generated metadata suggestion | `src/components/suggestions/Suggestions.tsx` |
| `suggestion_applied` | User applied an approved suggestion to their App Store metadata | `src/components/suggestions/Suggestions.tsx` |
| `keyword_added` | User added one or more keywords to track | `src/components/keywords/Keywords.tsx` |
| `keyword_deleted` | User removed a tracked keyword | `src/components/keywords/Keywords.tsx` |
| `keyword_discovery_started` | User triggered automated keyword discovery | `src/components/keywords/Keywords.tsx` |
| `competitor_discovery_started` | User triggered automated competitor discovery | `src/components/competitors/Competitors.tsx` |
| `team_member_invited` | User sent a team invitation | `src/components/Team.tsx` |
| `checkout_started` | User initiated a subscription checkout | `src/components/settings/Billing.tsx` |
| `settings_saved` | User saved team settings (ASC credentials, GitHub, presets) | `src/components/settings/Settings.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/197848/dashboard/736332)
- [Signup to Onboarding Funnel](https://eu.posthog.com/project/197848/insights/TahAOUNK)
- [AI Analysis to Suggestion Applied](https://eu.posthog.com/project/197848/insights/FhPaO0Pn)
- [New Signups](https://eu.posthog.com/project/197848/insights/tQZ5a5RM)
- [Core Feature Adoption](https://eu.posthog.com/project/197848/insights/PnW50uUB)
- [Checkout Started](https://eu.posthog.com/project/197848/insights/Ke1WWfll)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
