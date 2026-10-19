# Task Context: Fix login → instant logout race (stale idle timestamp)

Session ID: 2026-09-25-login-expiry-race
Created: 2026-09-25T00:00:00+07:00
Status: in_progress

## Current Request
User report: after returning to the app with an expired session (browser closed / PC shutdown),
the FIRST login attempt sometimes succeeds and then immediately logs the user out with
"Session Expired". The second login always works. Intermittent. User approved: primary fix +
hardening, and live repro driven via browser tools with a temporary 1-minute session timeout.

## Context Files (Standards to Follow)
- A:\Projects\nids\.opencode\context\project-intelligence\technical-domain.md
- A:\Projects\nids\AGENTS.md
- A:\Projects\nids\coding-preferences.md (surgical edits, dict-based text en/id)
- A:\Projects\nids\.tmp\sessions\2026-09-09-session-expiry\context.md (original feature design)

## Reference Files (Source Material to Look At)
- nids-app/hooks/use-session-expiry.ts (idle timer; mount check at line 98; key init lines 48-50)
- nids-app/components/auth-provider.tsx (expireSession wipes nids_* keys; SIGNED_OUT handler does NOT)
- nids-app/app/page.tsx (login page; signInWithPassword at line 167; 401-recovery at lines 134-147)
- nids-app/app/auth/callback/page.tsx (exchangeCodeForSession establishes session; needs reset too)
- nids-app/lib/site-content.ts (SITE_CONFIG.sessionTimeoutMinutes: 30 at line 11)
- nids-app/app/signup/page.tsx (checked: does NOT auto-sign-in — no change needed)

## Root Cause
`nids_last_active` (idle-timeout timestamp) survives into a fresh session when the user reaches
the login page via a path that does NOT wipe nids_* localStorage keys (Supabase SIGNED_OUT on
refresh failure, server getUser failure, login page 401-recovery). On the login page the hook is
disabled (user=null) so typing does not refresh the timestamp. After login → /dashboard, the hook
mount check reads the stale timestamp → expireSession() → instant logout. Second login works
because the first expireSession wiped the key (hook then re-initializes it to now).

Path A (idle timeout fires first, Supabase session alive) wipes the key → no bug.
Path B (Supabase session dies first) does not wipe → bug. Intermittency = A vs B + absence > 30min.

## Fix Plan (approved: primary + hardening)
1. app/page.tsx: after successful signInWithPassword (before redirect), reset
   localStorage nids_last_active to Date.now().
2. app/auth/callback/page.tsx: same reset after session established (exchangeCodeForSession
   success or getUser returns user), before router.push(next).
3. auth-provider.tsx SIGNED_OUT handler: also remove nids_last_active (idle stamp belongs to a
   dead session). Keep surgical — do not restructure.
4. app/page.tsx 401-recovery path (stale session clear): also remove nids_last_active.

## Repro Plan (temporary, restore after)
- Set SITE_CONFIG.sessionTimeoutMinutes to 1 (restore to 30 after verification).
- Simulate Path B: delete sb-*-auth-token cookies (kills Supabase session without wiping
  nids_last_active), let timestamp go stale on the login page, login → observe instant logout.
- After fix: same steps → login must succeed and stay logged in.

## Constraints
- Surgical edits only; preserve existing structure/debug logs.
- No new user-facing text (reuse existing dict keys) — no new keys needed.
- No new dependencies.
- Restore sessionTimeoutMinutes to 30 before finishing.

## Exit Criteria
- [ ] Repro confirmed before fix (instant logout after login with stale key)
- [ ] Repro passes after fix (login succeeds and stays logged in)
- [ ] sessionTimeoutMinutes restored to 30
- [ ] npm run lint and npm run typecheck pass in nids-app
