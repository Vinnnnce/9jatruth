import { generateAiText } from "@/lib/ai-providers";
import { getUserId } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate — Generate text using the AI ensemble (Deepseek + Kimi).
 *
 * Body:
 *   - prompt: string (required) — the user prompt
 *   - systemPrompt: string (optional) — system prompt override
 *   - maxTokens: number (optional, default 500) — max output tokens
 *
 * Returns: { text: string, source: string }
 */
export async function POST(request: Request) {
  const userHash = await getUserId(request);
  if (!userHash) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, systemPrompt, maxTokens } = body;

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ message: "Prompt is required" }, { status: 400 });
  }

  const defaultSystemPrompt = "You are a helpful AI assistant for the 9jatruth community platform. Generate concise, engaging, and community-focused content. Keep responses short and natural.";

  try {
    const { text, source } = await generateAiText(
      systemPrompt || defaultSystemPrompt,
      prompt,
      { temperature: 0.7, maxOutputTokens: maxTokens || 500 }
    );

    if (text) {
      return Response.json({ text, source });
    }

    return Response.json(
      { message: "AI generation failed — no provider configured", text: null, source: "fallback" },
      { status: 200 }
    );
  } catch (err) {
    return Response.json(
      { message: "AI generation error", error: String(err), text: null, source: "error" },
      { status: 500 }
    );
  }
}
