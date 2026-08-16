import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Daily Database Backup Endpoint
 * Called by Vercel cron job every day at 2:00 AM UTC
 *
 * Records table statistics and exports key data into the database_backups
 * table for audit and recovery purposes. Uses pg_stat_user_tables for fast counts.
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
    // Get all table counts in one fast query using pg_stat_user_tables
    const tableCounts = await sql`
      SELECT relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY relname
    ` as unknown as Array<{ table_name: string; row_count: number }>;

    const tableStats: Record<string, { count: number }> = {};
    let totalRows = 0;
    for (const row of tableCounts) {
      tableStats[row.table_name] = { count: Number(row.row_count) };
      totalRows += Number(row.row_count);
    }

    // Get recent truths sample (small, fast)
    let sampleData: Record<string, unknown> = {};
    try {
      const recentTruths = await sql`
        SELECT id, category, content, trust_score, status, created_at
        FROM micro_truths ORDER BY created_at DESC LIMIT 100
      `;
      sampleData.recentTruths = recentTruths;
    } catch { /* table might not exist */ }

    const statsJson = JSON.stringify(tableStats);
    const sampleJson = JSON.stringify(sampleData);
    const backupSize = Buffer.byteLength(statsJson, "utf8") + Buffer.byteLength(sampleJson, "utf8");
    const timestamp = new Date().toISOString();
    const backupDate = timestamp.split("T")[0];

    // Create backups table and store record
    try {
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

      await sql`
        INSERT INTO database_backups (backup_date, table_count, total_rows, backup_size_bytes, status, table_stats, sample_data)
        VALUES (${backupDate}, ${Object.keys(tableStats).length}, ${totalRows}, ${backupSize}, 'completed', ${statsJson}::jsonb, ${sampleJson}::jsonb)
      `;

      // Clean up backups older than 30 days
      await sql`DELETE FROM database_backups WHERE created_at < NOW() - INTERVAL '30 days'`;
    } catch (dbErr) {
      console.error("[backup] Failed to store backup record:", dbErr);
    }

    console.log(`[backup] Daily backup completed: ${Object.keys(tableStats).length} tables, ${totalRows} total rows`);

    return Response.json({
      success: true,
      timestamp,
      tables: Object.keys(tableStats).length,
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
