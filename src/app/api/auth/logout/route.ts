import { getAuthCookieName, isFallbackAuthEnabled } from "@/lib/fallback-auth";

/**
 * Logout endpoint.
 *
 * With Clerk, sessions are managed client-side via Clerk's session tokens.
 * With fallback auth, clears the JWT cookie.
 */
export async function POST(request: Request) {
  const headers = new Headers();

  if (isFallbackAuthEnabled()) {
    headers.append(
      "Set-Cookie",
      `${getAuthCookieName()}=; httpOnly=true; secure=${process.env.NODE_ENV === "production"}; sameSite=lax; path=/; max-age=0`
    );
  }

  return Response.json({ success: true }, { headers });
}
