# Neon Database Region Migration: Singapore → Ohio

## Context

The 9jatruth Vercel functions now run in **Ohio (Cleveland, `cle1`)** (see `vercel.json`).
To keep the serverless functions and the database in the same region, the Neon
database should also move to **AWS US East (Ohio) — `aws-us-east-2`**.

> **Important:** Neon does not support changing a project's region after creation.
> The database must be recreated in the Ohio region and the data migrated over.
> This is a Neon platform limitation, not a code issue.

## Migration steps

### 1. Create a new Neon project in Ohio

In the Neon Console (https://console.neon.tech):

1. **New Project** → name it `9jatruth-ohio`.
2. **Region:** choose **AWS US East (Ohio) — `aws-us-east-2`**.
3. **Postgres version:** match the current project (16+ recommended).
4. Create the project and copy the new **connection string** (`DATABASE_URL`).

### 2. Bootstrap the schema in the new Ohio database

The application auto-creates its schema on first connection via
`ensureDbInitialized()` (see `src/lib/db.ts`). Two options:

- **Option A (automatic):** set the new `DATABASE_URL` in Vercel, redeploy, and
  hit any API route — the tables, indexes, and reference/seed data are created
  idempotently (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- **Option B (explicit):** dump the schema only from the old project and apply it:

  ```bash
  # From the old (Singapore) project
  pg_dump --schema-only --no-owner "$OLD_DATABASE_URL" > schema.sql
  # Apply to the new (Ohio) project
  psql "$NEW_DATABASE_URL" -f schema.sql
  ```

### 3. Migrate the data (if you have live data)

Copy all rows from the old project to the new one:

```bash
# Full dump (schema + data) from Singapore
pg_dump --no-owner --no-privileges "$OLD_DATABASE_URL" > backup.sql

# Restore into Ohio (skip errors from already-created schema if you ran Option A)
psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=0 -f backup.sql
```

For large databases, use parallel jobs: `pg_dump -j 4 -Fd -f dumpdir ...` /
`pg_restore -j 4 -Fd -d ...`.

### 4. Point the app at the Ohio database

Update the `DATABASE_URL` environment variable in:

- **Vercel:** Project → Settings → Environment Variables → `DATABASE_URL`
  (for Production, Preview, and Development).
- **Local dev:** `.env` file.

Then redeploy on Vercel (push to `main`, or trigger a redeploy).

### 5. Verify + cutover

1. Confirm the app loads and a sample API route returns data, e.g.:
   `curl https://9jatruth.com/api/organizations`
2. Run a quick smoke test of writes (submit a truth, check it appears in the feed).
3. Once verified, you can delete the old Singapore Neon project.

## Why not change the region in place?

Neon stores each project's data in a single AWS region chosen at creation time;
there is no "change region" button. A new project + data copy is the only supported
path. See the Neon docs: https://neon.tech/docs/introduction/regions

## Vercel side

`vercel.json` already specifies `"regions": ["cle1"]` (Cleveland, Ohio).
No further Vercel change is needed — the functions will run in Ohio and sit
close to the Ohio Neon database.
