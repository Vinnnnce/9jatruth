import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Daily Database Backup Endpoint
 * Called by Vercel cron job every day at 2:00 AM UTC
 *
 * Records table statistics into database_backups table.
 * Uses pg_stat_user_tables for fast single-query counts.
 */

export async function GET(request: Request) {
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
    // Get all table counts in one fast query
    const tableCounts = await sql`
      SELECT relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY relname
    ` as unknown as Array<{ table_name: string; row_count: number }>;

    const tableStats: Record<string, number> = {};
    let totalRows = 0;
    for (const row of tableCounts) {
      tableStats[row.table_name] = Number(row.row_count);
      totalRows += Number(row.row_count);
    }

    const statsJson = JSON.stringify(tableStats);
    const backupSize = Buffer.byteLength(statsJson, "utf8");
    const timestamp = new Date().toISOString();
    const backupDate = timestamp.split("T")[0];
    const tableCount = Object.keys(tableStats).length;

    // Store backup metadata only (no large JSON data)
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
          table_stats JSONB NOT NULL
        )
      `;

      await sql`
        INSERT INTO database_backups (backup_date, table_count, total_rows, backup_size_bytes, status, table_stats)
        VALUES (${backupDate}, ${tableCount}, ${totalRows}, ${backupSize}, 'completed', ${statsJson}::jsonb)
      `;

      // Clean up backups older than 30 days
      await sql`DELETE FROM database_backups WHERE created_at < NOW() - INTERVAL '30 days'`;
    } catch (dbErr) {
      console.error("[backup] Failed to store backup record:", dbErr);
    }

    return Response.json({
      success: true,
      timestamp,
      tables: tableCount,
      totalRows,
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
