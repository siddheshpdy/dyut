# Phase 29.3 Migration Log

This log records the server-authority rollout independently from code commits.
The capability flag remains disabled until the acceptance and staging gates
are complete.

| Date | Stage | Result | Authority flag | Rollback state |
| --- | --- | --- | --- | --- |
| 2026-08-15 | Functions foundation and shared engine | Implemented; 19 Functions tests pass | Off | Client fallback preserved |
| 2026-08-15 | Client bridge and economy routing | Implemented; 124 client tests and 16 Playwright tests pass | Off | Disable flag to restore fallback |
| 2026-08-15 | Authority hardening | Added delayed-retry replay, leave-race protection, paid forfeits, legacy-record rejection, resumable/refund-safe lobby start, emulator isolation, and browser/server parity fixtures | Off | No production activation |
| 2026-08-15 | Trust-boundary hardening | Restricted public reservation/refund lifecycle and seat ownership, prevented profile edits from creating unverified leaderboard rows, and validated online piece entitlements and fixed initialization | Off | No production activation |
| 2026-08-15 | Local build and static gates | Lint, standalone build, CrazyGames build, and diff checks pass | Off | Not applicable |
| 2026-08-15 | Emulator acceptance and two-client convergence | Full Functions unit/integration suite and two-client host/guest authority smoke passed using the emulator-specific namespace config; direct writes, replay, stale actions, rewards, settlements, and trigger projections verified | Off | No production activation |
| Pending | Firebase staging deployment and two-browser validation | Requires authenticated Firebase CLI and staging project | Off | Deploy rules/functions separately |
| Pending | Controlled production rollout | Requires staging sign-off and monitoring | Off | Revert UI flag; preserve server ledger/settlements |

## Activation record template

Before enabling `VITE_SERVER_AUTHORITY_ENABLED=true`, record:

- Firebase project and Functions region.
- Git revision deployed for Functions, RTDB rules, and Firestore rules.
- Emulator integration and two-client results.
- Staging two-browser/reconnect result.
- App Check enforcement state.
- Server `CG_ENABLE_ADS` and web `VITE_CG_ENABLE_ADS` values.
- Rollback owner and time window.
