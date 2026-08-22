import { redirect } from "next/navigation";

/**
 * /r/[code] — clean, shareable referral short-link.
 *
 * Visiting https://9jatruth.com/r/<code> redirects to the homepage with
 * ?ref=<code>, which the <ReferralCapture /> component then records against
 * the referrer's account. The code is the referrer's stable userHash
 * (e.g. dev_1a2b3c4d5e6f) — a mix of numbers and letters — so it resolves
 * directly to the referrer without an extra lookup table.
 */
export default async function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safe = encodeURIComponent(code.slice(0, 64));
  redirect(`/?ref=${safe}`);
}
