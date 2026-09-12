import { ensureDbInitialized } from "@/lib/db";
import { loginUser, getAuthCookieOptions, getAuthCookieName, isFallbackAuthEnabled } from "@/lib/fallback-auth";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
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
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const result = await loginUser(parsed.data.email, parsed.data.password);

    if ("error" in result) {
      return Response.json({ message: result.error }, { status: 401 });
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
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[auth/login] Error:", err);
    return Response.json({ message: "Login failed. Please try again." }, { status: 500 });
  }
}
