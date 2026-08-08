/**
import { csrfCheck } from "@/lib/security";
 * Logout endpoint.
 *
 * With Clerk, sessions are managed client-side via Clerk's session tokens.
 * The client should call Clerk's signOut() to destroy the session. This
 * endpoint acknowledges the request and remains for backward compatibility.
 */
export async function POST() {
  return Response.json({ success: true });
}
