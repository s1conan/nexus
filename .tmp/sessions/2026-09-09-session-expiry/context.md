# Task Context: Auth session expiry + stale-JWT recovery

Session ID: 2026-09-09-session-expiry
Created: 2026-09-09T00:00:00+07:00
Status: in_progress

## Current Request
User approved: (1) stale-JWT recovery in auth-provider (401/JWT-expired → clean signOut instead of timeout hang), (2) auto-logout "login expiry" when user is idle too long, browser closed, or computer sleeps/hibernates.

## Context Files (Standards to Follow)
- A:\Projects\nids\.opencode\context\project-intelligence\technical-domain.md
- A:\Projects\nids\AGENTS.md
- A:\Projects\nids\coding-preferences.md (surgical edits, dict-based text en/id)

## Reference Files (Source Material to Look At)
- nids-app/components/auth-provider.tsx (has MSG_SESSION_EXPIRED toast on SIGNED_OUT; getUser() already used; getProfile 5s timeout race)
- nids-app/lib/site-content.ts (SITE_CONFIG at top; MSG_SESSION_EXPIRED / MSG_RELOGIN exist in en+id)
- nids-app/lib/notifications.ts (notify.warning(title, desc, duration))
- nids-app/app/page.tsx (login page; sonner toast imported)
- nids-app/hooks/ (existing kebab-case hook files)

## Design
- New hook nids-app/hooks/use-session-expiry.ts: activity-based expiry persisted to localStorage `nids_last_active`; covers idle, sleep/hibernate (wall-clock check on visibilitychange + 30s interval), browser-closed (timestamp persists → expires on next mount). One timeout: SITE_CONFIG.sessionTimeoutMinutes (30).
- auth-provider: expireSession callback (signOut local scope, clear nids_* keys, redirect /?expired=1), guard syncProfile redirect with !isManualSignOut, getProfile 401/PGRST301/"JWT expired"/"Invalid API key" → expireSession.
- app/page.tsx: on mount, ?expired=1 → toast.warning(MSG_SESSION_EXPIRED, MSG_RELOGIN) + strip param.

## Constraints
- Surgical edits only in auth-provider.tsx (user-tuned file); preserve existing structure/debug logs.
- All user-facing text via dict keys (existing MSG_SESSION_EXPIRED / MSG_RELOGIN reused — no new keys needed).
- No new dependencies.

## Exit Criteria
- [ ] Idle/sleep/closed-browser beyond 30 min → auto signOut + redirect to login with expiry toast
- [ ] Expired-JWT 401 in getProfile → clean signOut, no timeout hang
- [ ] `npm run lint` and `npm run typecheck` pass in nids-app
