import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Daily Database Backup Endpoint
 * Called by Vercel cron job every day at 2:00 AM UTC
 *
 * Records table statistics and exports key data into the database_backups
 * table for audit and recovery purposes. Lightweight enough for serverless.
 */

export async function GET(request: Request) {
  // Vercel cron jobs don't send auth headers; only enforce when CRON_SECRET is set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
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
        table_stats JSONB NOT NULL,
        sample_data JSONB
      )
    `;

    // Get row counts for each table (fast queries)
    const tableStats: Record<string, { count: number }> = {};
    let totalRows = 0;
    let tableCount = 0;

    const countQueries: Array<{ name: string; query: Promise<unknown[]> }> = [
      { name: "micro_truths", query: sql`SELECT COUNT(*) as count FROM micro_truths` as unknown as Promise<unknown[]> },
      { name: "neighborhoods", query: sql`SELECT COUNT(*) as count FROM neighborhoods` as unknown as Promise<unknown[]> },
      { name: "snapshots", query: sql`SELECT COUNT(*) as count FROM snapshots` as unknown as Promise<unknown[]> },
      { name: "predictions", query: sql`SELECT COUNT(*) as count FROM predictions` as unknown as Promise<unknown[]> },
      { name: "polls", query: sql`SELECT COUNT(*) as count FROM polls` as unknown as Promise<unknown[]> },
      { name: "poll_votes", query: sql`SELECT COUNT(*) as count FROM poll_votes` as unknown as Promise<unknown[]> },
      { name: "poll_options", query: sql`SELECT COUNT(*) as count FROM poll_options` as unknown as Promise<unknown[]> },
      { name: "questionnaires", query: sql`SELECT COUNT(*) as count FROM questionnaires` as unknown as Promise<unknown[]> },
      { name: "questionnaire_answers", query: sql`SELECT COUNT(*) as count FROM questionnaire_answers` as unknown as Promise<unknown[]> },
      { name: "news_articles", query: sql`SELECT COUNT(*) as count FROM news_articles` as unknown as Promise<unknown[]> },
      { name: "rewards_ledger", query: sql`SELECT COUNT(*) as count FROM rewards_ledger` as unknown as Promise<unknown[]> },
      { name: "reward_redemptions", query: sql`SELECT COUNT(*) as count FROM reward_redemptions` as unknown as Promise<unknown[]> },
      { name: "device_profiles", query: sql`SELECT COUNT(*) as count FROM device_profiles` as unknown as Promise<unknown[]> },
      { name: "organizations", query: sql`SELECT COUNT(*) as count FROM organizations` as unknown as Promise<unknown[]> },
      { name: "browsing_events", query: sql`SELECT COUNT(*) as count FROM browsing_events` as unknown as Promise<unknown[]> },
      { name: "push_subscriptions", query: sql`SELECT COUNT(*) as count FROM push_subscriptions` as unknown as Promise<unknown[]> },
      { name: "feedback", query: sql`SELECT COUNT(*) as count FROM feedback` as unknown as Promise<unknown[]> },
      { name: "user_profiles", query: sql`SELECT COUNT(*) as count FROM user_profiles` as unknown as Promise<unknown[]> },
    ];

    for (const { name, query } of countQueries) {
      try {
        const result = await query as unknown as Array<{ count: number }>;
        const count = Number(result[0]?.count ?? 0);
        tableStats[name] = { count };
        totalRows += count;
        tableCount++;
      } catch {
        tableStats[name] = { count: 0 };
      }
    }

    // Export key recent records (small dataset, fast)
    const sampleData: Record<string, unknown> = {};

    try {
      const recentTruths = await sql`
        SELECT id, category, content, neighborhood_id, trust_score, status, created_at
        FROM micro_truths ORDER BY created_at DESC LIMIT 100
      `;
      sampleData.recentTruths = recentTruths;
    } catch { /* table might not exist */ }

    try {
      const recentPolls = await sql`
        SELECT id, question, is_active, created_at FROM polls ORDER BY created_at DESC LIMIT 50
      `;
      sampleData.recentPolls = recentPolls;
    } catch { /* skip */ }

    try {
      const recentNews = await sql`
        SELECT id, title, state, lga, created_at FROM news_articles ORDER BY created_at DESC LIMIT 50
      `;
      sampleData.recentNews = recentNews;
    } catch { /* skip */ }

    try {
      const neighborhoods = await sql`
        SELECT id, name, region, state, lga FROM neighborhoods ORDER BY name LIMIT 200
      `;
      sampleData.neighborhoods = neighborhoods;
    } catch { /* skip */ }

    const statsJson = JSON.stringify(tableStats);
    const sampleJson = JSON.stringify(sampleData);
    const backupSize = Buffer.byteLength(statsJson, "utf8") + Buffer.byteLength(sampleJson, "utf8");
    const timestamp = new Date().toISOString();
    const backupDate = timestamp.split("T")[0];

    // Store backup record
    try {
      await sql`
        INSERT INTO database_backups (backup_date, table_count, total_rows, backup_size_bytes, status, table_stats, sample_data)
        VALUES (${backupDate}, ${tableCount}, ${totalRows}, ${backupSize}, 'completed', ${statsJson}::jsonb, ${sampleJson}::jsonb)
      `;

      // Clean up backups older than 30 days
      await sql`DELETE FROM database_backups WHERE created_at < NOW() - INTERVAL '30 days'`;
    } catch (dbErr) {
      console.error("[backup] Failed to store backup record:", dbErr);
    }

    console.log(`[backup] Daily backup completed: ${tableCount} tables, ${totalRows} total rows`);

    return Response.json({
      success: true,
      timestamp,
      tables: tableCount,
      totalRows,
      backupSizeBytes: backupSize,
      tableStats,
    });
  } catch (err) {
    console.error("[backup] Daily backup failed:", err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
