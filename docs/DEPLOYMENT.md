# Tuklas AI: Deployment Runbook

This is the path from this repository to a public site. It follows master plan Phases 29, 31 and
32 (reliability, security and pilot). Read "Before the first public visitor" first.

## What runs where

- One Node.js web service (Express serves the API and the built React app) and one PostgreSQL
  database (Neon or Supabase). Run **one instance**: rate limits are kept in memory.
- Files: `Dockerfile` (build and run), `render.yaml` (Render blueprint), `/api/health` (health check).

## Environment variables

Set these in the host's dashboard. Never commit real values.

| Name | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production`. The server refuses to start without valid settings. |
| `DATABASE_URL` | yes | PostgreSQL connection string (use the pooled one on Neon). |
| `AUTH_SECRET` | yes | At least 32 random characters, unique to this deployment. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `APP_URL` | yes | The public `https://` address. Used by the cross-site request check. |
| `GEMINI_API_KEY` | no | Without it the tutor uses its built-in rule-based engine. |
| `AI_MODEL` | no | Check the model name in your Google AI account. If it is rejected the app falls back automatically. |
| `YOUTUBE_API_KEY` | no | Without it video search uses the built-in Mathisipan catalog. |
| `PORT` | no | The host usually sets it. |

## Before the first public visitor

1. **Use a fresh database if you can.** Run `npx prisma migrate deploy` (Render does this before each
   start through `preDeployCommand`). A database that already has tables from `prisma db push` must
   first be marked as migrated: `npx prisma migrate resolve --applied 0001_baseline`. Back it up first.
2. **Secure any database that was ever seeded.** The demo accounts (`student@`, `teacher@`,
   `admin@tuklas.ai`) have a password that was published in this repository's history.
   ```bash
   npx tsx scripts/secure-demo-accounts.ts            # shows what would change
   NEW_ADMIN_PASSWORD="<12+ characters>" npx tsx scripts/secure-demo-accounts.ts --apply
   ```
   A fresh database never needs the demo accounts. Do not run `prisma db seed` in production.
3. **Create the first administrator.** Register on the site, then:
   ```bash
   npx tsx scripts/promote-user.ts --email you@example.com --role ADMIN --apply
   ```
   Sign out and in again. Administrators promote teachers on the Admin page.
4. **Load the curriculum structure and the Q1 draft lessons** (dry run first, then `--apply`):
   ```bash
   npx tsx scripts/seed-bow-restructure.ts --pdf-dir "<folder with the DepEd PDFs>"
   ```
   The six lessons arrive as DRAFT. A teacher reviews them, sends them to review, an administrator
   approves, and then they are published. Students never see drafts.
5. **Rotate the Gemini key** if it has ever been in a shared file or chat, and set a quota alert.
6. **Review the privacy side.** The site stores student names, emails and learning records. Add the
   school's privacy notice and parent or guardian consent process before real students sign up
   (Data Privacy Act of 2012). The DepEd Lesson Exemplars say they are for teacher use, so the PDFs are
   stored as teacher-only reference documents and their text is never sent to students.

## After deploying

```bash
APP_URL=https://your-domain npx tsx scripts/smoke-test-pilot-flows.ts
```

It registers one throwaway student (`smoke-…@example.invalid`) and must print `0 failed`. Then check by hand,
in Microsoft Edge and Google Chrome over HTTPS: register, open Lesson 1, answer a checkpoint, open the
AI Tutor, read a reply aloud, and sign in as a teacher.

## Known limitations

- The tutor falls back to a rule-based engine when Gemini is busy or unavailable. Its answers are
  correct but less flexible.
- Voice uses the browser's own speech tools. Chrome on Windows has no Filipino voice; Edge does.
  Microphone input and read-aloud have not been validated on real classroom devices.
- A changed role takes effect at the person's next sign-in (their session lasts up to 7 days).
- Rate limits are per instance. Run one instance, or move them to a shared store first.
- `npm audit` reports 3 moderate issues in `mammoth` (used only for teacher document uploads).
  The fix is a breaking downgrade, so it is deferred.
- The Admin research card still reads a fixed demo student id and stays empty on a new database.
- No password reset and no email verification exist yet. Administrators cannot reset a password.
- Sign-ups are open to anyone with the link. Share the address only with the pilot school.
