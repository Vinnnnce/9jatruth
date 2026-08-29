import { ensureDbInitialized, getDb } from "@/lib/db";
import { generateAudio } from "@/lib/news-external";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * POST /api/news/external/[id]/audio — generate audio for an article
 *
 * Marks is_audio_generated = true and sets audio_url to a client-side TTS
 * endpoint. The client uses the browser's SpeechSynthesis API to read the
 * article content aloud.
 *
 * Returns: { ok: true, audio_url: "..." }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const resolvedParams = await params;
  const parsed = idParamSchema.safeParse(resolvedParams);

  if (!parsed.success) {
    return Response.json(
      { message: "Invalid article ID" },
      { status: 400 }
    );
  }

  const articleId = parsed.data.id;

  // Verify the article exists before generating audio
  const sql = getDb();
  const existing = (await sql`
    SELECT id, title FROM news_external WHERE id = ${articleId} LIMIT 1
  `) as unknown as { id: number; title: string }[];

  if (existing.length === 0) {
    return Response.json(
      { message: "Article not found" },
      { status: 404 }
    );
  }

  const result = await generateAudio(articleId);

  if (!result) {
    return Response.json(
      { message: "Failed to generate audio" },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    audio_url: result.audio_url,
  });
}
