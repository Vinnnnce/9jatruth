import { ensureDbInitialized } from "@/lib/db";
import { getSiteConfig, getFeatureConfig } from "@/lib/config";

/**
 * GET /api/config
 * Public (unauthenticated) endpoint returning the live site + feature config.
 * Used by the SiteConfigBridge on the frontend to apply colors, the announcement
 * bar, the logo, and feature visibility in real time. Cache-busted on every
 * `site.config.updated` / `feature.config.updated` event emitted by the admin.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbInitialized();
  const [site, features] = await Promise.all([getSiteConfig(), getFeatureConfig()]);
  // Never leak admin-only internals; only the fields the public UI needs.
  return Response.json({
    site: {
      primary_color: site.primary_color,
      secondary_color: site.secondary_color,
      logo_url: site.logo_url,
      homepage_banner_text: site.homepage_banner_text,
      announcement_bar: site.announcement_bar,
      referral_base_url: site.referral_base_url,
    },
    features,
  });
}
