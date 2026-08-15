# Release and data boundaries

## Frontend publication

- Repository: `jin40225-boop/ADHD-Website`
- Production branch: `main`
- Live site: `https://jin40225-boop.github.io/ADHD-Website/`
- GitHub Actions deploys the frontend only. Its current gates are dependency install, production audit at high severity, TypeScript, operations checks, static deployment build, and deep-route validation.
- A successful local build is not a publish. A pushed commit is not a successful deployment. A successful workflow still requires live-route verification.

## Supabase boundary

- Project ref: `sssseazkhiswjhtmbluh`.
- This Supabase project is shared with the LINE assistant, whose data belongs to the `personal_assistant` schema. Do not modify or infer ownership of that schema from this repository.
- Before any schema change, run `npx -y supabase migration list --linked` and `npx -y supabase inspect db table-stats --linked`.
- Stop when local and remote migration histories differ unexpectedly. Do not use a broad `db push` to conceal drift; reconcile the exact migration or use targeted, reviewed SQL.
- Never delete production data as routine cleanup. Prefer status changes and audit notes.
- GitHub Pages does not deploy migrations, Edge Functions, database secrets, Gmail/Calendar configuration, or OAuth consent settings.

## Personal data and secrets

- Never commit real registrations, case notes, email bodies, attachments, contact details, Meet URLs, Calendar IDs, OAuth credentials, refresh tokens, service-role keys, production exports, or private migration payloads.
- Private historical migrations belong only in the ignored private path with a redacted same-version placeholder in Git when the project convention requires it.
- Do not print secrets while diagnosing configuration. Compare key names and presence, not values.

## Integration completion gates

- Gmail: prove the authorized sync/send path, database thread/message state, and audit result with an approved test account or recipient.
- Calendar/Meet: prove event creation or update, Meet URL, database write-back, retry behavior, and audit result with an approved test event.
- Public registration: verify public view/RLS boundaries, capacity policy, submission response, and the corresponding database record without exposing personal data.
- Edge Function: run `deno check` or the project-specific test, deploy explicitly, inspect ACTIVE version/status, then exercise the affected endpoint safely.

## Safe Git sequence

1. Fetch and branch from current `origin/main`.
2. Implement and run local gates.
3. Inspect `git status`, `git diff --check`, and the complete intended diff.
4. Stage named files only; never use `git add .` in a mixed worktree.
5. Commit and push only within the user's publication authorization.
6. Wait for the production workflow and verify the live site.
