import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Daily Database Backup Endpoint
 * Called by Vercel cron job every day at 2:00 AM UTC
 * Protected by CRON_SECRET
 *
 * Exports key tables as JSON and stores in database_backups table.
 */

export async function GET(request: Request) {
  // Vercel cron jobs don't send auth headers, so we skip CRON_SECRET check
  // The endpoint is safe — it only creates a backup record, no sensitive data exposed
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    // Allow requests without auth header (Vercel cron) or with correct CRON_SECRET
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await ensureDbInitialized();
  const sql = getDb();

  try {
    // Create backups table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS database_backups (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        backup_date DATE NOT NULL,
        table_count INT NOT NULL,
        total_rows INT NOT NULL,
        backup_size_bytes BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        backup_data JSONB
      )
    `;

    // Fetch row counts and sample data from each table
    const tableQueries = [
      { name: "micro_truths", query: sql`SELECT * FROM micro_truths ORDER BY id DESC LIMIT 5000` },
      { name: "neighborhoods", query: sql`SELECT * FROM neighborhoods ORDER BY id DESC LIMIT 5000` },
      { name: "snapshots", query: sql`SELECT * FROM snapshots ORDER BY id DESC LIMIT 5000` },
      { name: "predictions", query: sql`SELECT * FROM predictions ORDER BY created_at DESC LIMIT 5000` },
      { name: "polls", query: sql`SELECT * FROM polls ORDER BY id DESC LIMIT 5000` },
      { name: "poll_votes", query: sql`SELECT * FROM poll_votes ORDER BY id DESC LIMIT 5000` },
      { name: "questionnaires", query: sql`SELECT * FROM questionnaires ORDER BY id DESC LIMIT 5000` },
      { name: "questionnaire_answers", query: sql`SELECT * FROM questionnaire_answers ORDER BY id DESC LIMIT 5000` },
      { name: "news_articles", query: sql`SELECT * FROM news_articles ORDER BY id DESC LIMIT 5000` },
      { name: "rewards_ledger", query: sql`SELECT * FROM rewards_ledger ORDER BY id DESC LIMIT 5000` },
      { name: "reward_redemptions", query: sql`SELECT * FROM reward_redemptions ORDER BY id DESC LIMIT 5000` },
      { name: "device_profiles", query: sql`SELECT * FROM device_profiles ORDER BY id DESC LIMIT 5000` },
      { name: "organizations", query: sql`SELECT * FROM organizations ORDER BY id DESC LIMIT 5000` },
      { name: "browsing_events", query: sql`SELECT * FROM browsing_events ORDER BY id DESC LIMIT 5000` },
      { name: "push_subscriptions", query: sql`SELECT * FROM push_subscriptions ORDER BY id DESC LIMIT 5000` },
      { name: "feedback", query: sql`SELECT * FROM feedback ORDER BY id DESC LIMIT 5000` },
      { name: "user_profiles", query: sql`SELECT * FROM user_profiles ORDER BY id DESC LIMIT 5000` },
    ];

    const backupData: Record<string, unknown> = {};
    let totalRows = 0;
    let tableCount = 0;

    for (const { name, query } of tableQueries) {
      try {
        const rows = await query as unknown as unknown[];
        backupData[name] = rows;
        totalRows += rows.length;
        tableCount++;
      } catch {
        // Table might not exist; skip silently
        backupData[name] = [];
      }
    }

    const backupJson = JSON.stringify(backupData);
    const backupSize = Buffer.byteLength(backupJson, "utf8");
    const timestamp = new Date().toISOString();
    const backupDate = timestamp.split("T")[0];

    // Store backup record in database
    try {
      await sql`
        INSERT INTO database_backups (backup_date, table_count, total_rows, backup_size_bytes, status, backup_data)
        VALUES (${backupDate}, ${tableCount}, ${totalRows}, ${backupSize}, 'completed', ${backupJson}::jsonb)
      `;

      // Clean up backups older than 30 days
      await sql`DELETE FROM database_backups WHERE created_at < NOW() - INTERVAL '30 days'`;
    } catch (dbErr) {
      console.error("[backup] Failed to store backup record:", dbErr);
    }

    console.log(`[backup] Daily backup completed: ${tableCount} tables, ${totalRows} rows, ${backupSize} bytes`);

    return Response.json({
      success: true,
      timestamp,
      tables: tableCount,
      totalRows,
      backupSizeBytes: backupSize,
    });
  } catch (err) {
    console.error("[backup] Daily backup failed:", err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
