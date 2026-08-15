---
name: adhd-website-maintainer
description: Maintain, modify, optimize, extend, test, and safely release the jin40225-boop/ADHD-Website React/Vite + Supabase platform. Use for public content edits, UI changes, admin features, bug fixes, GitHub Pages deployments, Supabase migrations or Edge Functions, production diagnosis, version reconciliation, and takeover/status reporting for this repository.
---

# ADHD Website Maintainer

## Overview

Use the deployed GitHub Pages version as the starting truth, then make changes in a verified Git checkout without weakening privacy, data, or release boundaries. A passing local build is evidence, not a production deployment.

## Required reading

1. Read repository `AGENTS.md` and preserve its privacy and data rules.
2. Read `adhd-platform/docs/CODEX_MAINTENANCE_BASELINE.md`.
3. Read the relevant part of `adhd-platform/docs/PROJECT_BASELINE.md`.
4. Read [references/release-and-data-boundaries.md](references/release-and-data-boundaries.md) before changing Supabase, integrations, CI, or deployment.

## Workflow

### 1. Reconcile the source of truth

- Confirm Git root, origin URL, branch, status, and HEAD.
- Fetch `origin`; compare the checkout with `origin/main` and the latest successful Pages run.
- Use `gh run list --workflow deploy.yml --branch main --limit 5` and verify that the successful run SHA matches the production source under review.
- Treat `origin/main` plus its successful deployment as authoritative. Preserve unknown local changes; never reset, clean, or overwrite them to force alignment.
- If a historical document names an unavailable checkout, report the conflict; do not silently rewrite governance.
- Record folder, branch, commit, and live or preview URL at checkpoints.

### 2. Classify the change

- Content/UI/frontend only: work on a feature branch from current `origin/main`.
- SQL, RLS, Storage, Auth, Edge Functions, secrets, Gmail, Calendar, Meet, or CAPTCHA: apply the extra data and integration gates in the reference.
- Never put real personal data, email contents, credentials, tokens, private migration contents, or production exports in Git, chat, logs, screenshots, or test fixtures.
- Use the workspace-write `content_maintainer` subagent for bounded content, accessibility, responsive UI, or frontend implementation. It must not commit, push, deploy, or touch backend/integration boundaries.
- Use the read-only `maintenance_auditor` subagent for bounded inventory or regression review when parallel QA saves time. The main agent owns diff integration, commits, releases, backend work, and final decisions.

### 3. Implement narrowly

- Preserve the established visual language unless the user asks for redesign.
- The public homepage route is declared in `adhd-platform/src/router.tsx` and currently implemented by `adhd-platform/src/pages/public/HomePage.tsx`; re-resolve this mapping before editing instead of assuming it never changes.
- Trace data-backed UI through its API/view/RLS contract; do not infer success from component rendering alone.
- Stage only intended files. Review the diff and protect unrelated user changes.
- Do not deploy database or integration changes merely because frontend CI passes.

### 4. Verify locally

From `adhd-platform/`, run:

```powershell
npm ci
npm audit --omit=dev --audit-level=high
npm run typecheck
npm run check:operations
npm run deploy
npm run check:site
```

Also run targeted tests for the changed execution path. For UI work, inspect affected routes on desktop and 390px mobile, including console errors and horizontal overflow. A local asset hash without production environment values is not a production-equivalence proof.

### 5. Release and prove

- Recheck that `origin/main` did not move before integration.
- Commit and push only when the user has authorized publication. Keep Git history auditable.
- Wait for the GitHub Pages workflow; verify success and the live root plus every affected deep route.
- For backend changes, separately verify migration history, deployed Function version/status, RLS/auth behavior, audit trail, and the real external integration when authorized.
- Update the maintenance baseline after content or functional releases and after backend state changes. Add a concise newest-first entry to private `cairn/LOG.md` when available.

## Completion standard

Report separately whether work is committed locally, pushed to GitHub, deployed by Pages, deployed to Supabase, and verified live. Do not collapse these states into a single "done" claim. Missing evidence remains an explicit open item.
