# Mobile widget contract and installation

The mobile widget uses `/api/mobile/widget-pulse`, schema version 2. All API
responses are `Cache-Control: no-store`; the service worker never caches API
responses. The browser requires its normal signed-in session.

## Scriptable

1. Sign in and open the mobile view, then the iOS installation guide.
2. Create a widget token. It is displayed once and is not persisted in browser
   storage. Creating another replaces the previous token for the same account.
3. Copy the script, paste into Scriptable, and run it interactively. Enter the
   token in the secure prompt; Scriptable stores it in its Keychain.
4. Add a medium Scriptable home-screen widget and select this script.
5. To replace a token, run the script interactively again. To revoke it, use
   the revoke button in the mobile guide. Tokens expire after 90 days.

The credential grants only GET `/api/mobile/widget-pulse`, not other APIs or
token management. Storage contains a SHA-256 digest, expiry and last-use time,
not the raw secret. Current account activation, session version, roles and
scopes are resolved on every read. Database-user password/session revocation
invalidates widget tokens too. Ordinary browser logout does not revoke a
separately installed widget: use the explicit revoke action for lost devices.
One active widget credential is supported per account, shared across devices.

Scripts use the page's current origin when copied. Production defaults to
`https://copadash.amadehlaziz.com`. Never publish a token or paste a session
cookie into Scriptable. iOS controls the actual refresh schedule; the script's
15-minute refresh request is not a guarantee. Lock-screen layouts are not
implemented. Native Android widgets are not generally supported by PWA
installation; Add to Home Screen installs the web application instead.

## Data semantics

- Visitor plan selection uses the club's current/upcoming/archive/inactive
  ordering. Missing linkage or missing monthly KPIs is unavailable, not an
  executive fallback or a fabricated zero performance result.
- Basket progress is achieved group count (`ratio` in the club KPI) divided by
  the largest group threshold in that KPI's ladder. `basket.achieved_groups`,
  `basket.target_groups` and `basket.progress_pct` make the units explicit.
- Total/rank is the club's completed-month result. Monthly KPIs can be
  provisional. Data completion is not financial settlement; prizes are estimates.
- Executive achievement, target and forecast reuse `target.build_report`, exactly
  as the target page does. Actual is the sum of Rial+Vat including promotions and
  negative returns, not the separately defined net-after-discounts measure.
  `actual_rial` is the canonical field; `net_rial_vat` is a compatibility alias
  for installed scripts. The complete unrounded `summary` matches the target API.
  The default core is an authorized target-enabled core; the default month is
  the latest loaded target month, just as on the target page. Explicit `core`,
  `month` and repeated target-filter parameters use the same validation and RBAC.
  Unsupported cores do not silently aggregate unrelated sales or targets.
- Browser target selection is shared with the widget in the application. Copied
  Scriptable code includes that selection; recopy it after changing the selection.
  Existing external scripts without query parameters use the default target core
  and latest target month. Independent devices do not synchronize browser state.
  Forecast is a simple working-day extrapolation, not a commitment.
- `generated_at` is response time; `as_of_date` is the underlying sales cutoff.
  `freshness` describes BI synchronization only: unknown with no valid success
  timestamp, stale after 24 hours, otherwise fresh. A fresh sync may still contain
  historical sales. Inspect the sales cutoff as well.

## Verification

Run backend pytest, frontend Vitest, the frontend production build and
`git diff --check`. Physical iPhone/Scriptable, Android installation and
authenticated production-browser checks remain separate release gates.