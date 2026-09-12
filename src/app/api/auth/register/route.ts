import { ensureDbInitialized } from "@/lib/db";
import { registerUser, getAuthCookieOptions, getAuthCookieName, isFallbackAuthEnabled } from "@/lib/fallback-auth";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50, "Display name is too long"),
});

export async function POST(request: Request) {
  // Only allow fallback auth when Clerk is not configured
  if (!isFallbackAuthEnabled()) {
    return Response.json({ message: "Use Clerk for authentication" }, { status: 400 });
  }

  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const result = await registerUser(parsed.data.email, parsed.data.password, parsed.data.displayName);

    if ("error" in result) {
      return Response.json({ message: result.error }, { status: 409 });
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `${getAuthCookieName()}=${result.token}; ${Object.entries(getAuthCookieOptions())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")}`
    );

    return Response.json(
      { user: result.user, ok: true },
      { status: 201, headers }
    );
  } catch (err) {
    console.error("[auth/register] Error:", err);
    return Response.json({ message: "Registration failed. Please try again." }, { status: 500 });
  }
}
