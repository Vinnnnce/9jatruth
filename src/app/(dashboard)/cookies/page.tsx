"use client";

/**
 * Cookie Policy Page
 */

import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";

export default function CookiePolicy() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Cookie className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-700">Cookie Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: August 7, 2026</p>
        </div>
      </div>

      <Card><CardContent className="p-6 space-y-4">
        <section>
          <h2 className="text-base font-semibold">1. What Are Cookies</h2>
          <p className="text-sm text-muted-foreground">Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently and provide a better user experience.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">2. Cookies We Use</h2>
          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">soke_agency_token</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-600">Essential</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">An httpOnly cookie containing a JWT authentication token for agency accounts. Expires after 7 days. Required for login functionality.</p>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">localStorage: soke_seen_quick_tips</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-600">Functional</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">A localStorage flag indicating whether the user has seen the quick navigation tips. Used to show onboarding only to new users.</p>
            </div>
          </div>
        </section>
        <section>
          <h2 className="text-base font-semibold">3. Third-Party Cookies</h2>
          <p className="text-sm text-muted-foreground">We do not use third-party tracking cookies, advertising cookies, or analytics cookies. We do not share cookie data with third parties.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">4. Managing Cookies</h2>
          <p className="text-sm text-muted-foreground">Essential cookies (authentication) cannot be disabled as they are required for the platform to function. You can clear all cookies through your browser settings at any time. Note that clearing the authentication cookie will sign you out.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">5. Browser Geolocation</h2>
          <p className="text-sm text-muted-foreground">We use the browser's Geolocation API (not cookies) to determine your approximate location for nearby post filtering. This requires your explicit permission and can be revoked at any time through your browser's site settings.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">6. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground">We may update this Cookie Policy as we add or modify features. We will update the "Last updated" date accordingly.</p>
        </section>
      </CardContent></Card>
    </div>
  );
}
