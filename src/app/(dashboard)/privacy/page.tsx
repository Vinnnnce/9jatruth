"use client";

/**
 * Privacy Policy Page
 */

import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-700">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: August 7, 2026</p>
        </div>
      </div>

      <Card><CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none space-y-4">
        <section>
          <h2 className="text-base font-semibold">1. Introduction</h2>
          <p className="text-sm text-muted-foreground">Soke ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform for community-driven truth reporting.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">2. Information We Collect</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li><strong>Location Data:</strong> We use your browser's geolocation API to show posts near you. Your exact GPS coordinates are used only for distance calculation and are never stored in raw form on our servers.</li>
            <li><strong>IP Address:</strong> We hash your IP address using SHA-256 before storage. Raw IP addresses are never stored. Hashed IPs are used for approximate geolocation and abuse prevention.</li>
            <li><strong>Account Information:</strong> For agency accounts, we collect email, organization name, contact details, and a bcrypt-hashed password.</li>
            <li><strong>Report Content:</strong> The content of truth reports you submit, including category and neighborhood selection.</li>
            <li><strong>Usage Data:</strong> Device identifiers (hashed) for gamification and reward tracking.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold">3. How We Use Your Information</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>To display relevant posts and feeds near your location</li>
            <li>To verify and score the trustworthiness of community reports</li>
            <li>To prevent spam and abuse through IP-based tracking</li>
            <li>To manage agency/organization accounts and authentication</li>
            <li>To provide gamification features (XP, achievements, leaderboards)</li>
            <li>To send push notifications for alerts you've subscribed to</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold">4. Data Retention</h2>
          <p className="text-sm text-muted-foreground">Truth reports are retained indefinitely as part of the community record. Agency account data is retained while the account is active and may be deleted upon request. IP hashes are retained for the lifetime of associated reports.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">5. Your Rights</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li><strong>Access:</strong> You may request a copy of your personal data</li>
            <li><strong>Rectification:</strong> You may correct inaccurate information through account settings</li>
            <li><strong>Erasure:</strong> You may request deletion of your account and associated data</li>
            <li><strong>Restriction:</strong> You may request we limit processing of your data</li>
            <li><strong>Portability:</strong> You may export your data in CSV format</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold">6. Cookies</h2>
          <p className="text-sm text-muted-foreground">We use essential cookies for authentication (httpOnly JWT tokens). We do not use third-party tracking cookies. See our <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a> for details.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">7. Data Security</h2>
          <p className="text-sm text-muted-foreground">Passwords are hashed with bcrypt (12 rounds). JWT tokens are stored in httpOnly cookies. All communication uses HTTPS in production. IP addresses are SHA-256 hashed before storage.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">8. Contact</h2>
          <p className="text-sm text-muted-foreground">For privacy inquiries, contact us through the platform's support channels.</p>
        </section>
      </CardContent></Card>
    </div>
  );
}
