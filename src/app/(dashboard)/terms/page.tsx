"use client";

/**
 * Terms of Use Page
 */

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function TermsOfUse() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-700">Terms of Use</h1>
          <p className="text-xs text-muted-foreground">Last updated: August 7, 2026</p>
        </div>
      </div>

      <Card><CardContent className="p-6 space-y-4">
        <section>
          <h2 className="text-base font-semibold">1. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground">By accessing or using Soke, you agree to be bound by these Terms of Use. If you do not agree, please do not use the platform.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">2. Description of Service</h2>
          <p className="text-sm text-muted-foreground">Soke is a community-driven platform for reporting and verifying real-time conditions (power, fuel, traffic, prices, safety) in your neighborhood. The platform includes trust scoring, gamification, and location-based feed filtering.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">3. User Responsibilities</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>Submit only truthful and accurate reports</li>
            <li>Do not submit false, misleading, or malicious content</li>
            <li>Do not impersonate other users or organizations</li>
            <li>Respect the privacy of other users</li>
            <li>Do not attempt to manipulate trust scores or gamification</li>
            <li>Do not use the platform for any illegal activities</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold">4. Agency Accounts</h2>
          <p className="text-sm text-muted-foreground">Organizations may register for agency accounts. Agency accounts are subject to verification. Organizations are responsible for maintaining the security of their account credentials and for all activities under their account.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">5. Content Ownership & Licensing</h2>
          <p className="text-sm text-muted-foreground">You retain ownership of your submitted content. By submitting, you grant Soke a non-exclusive, royalty-free license to display, process, and analyze your content for the platform's purposes, including trust scoring and pattern detection.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">6. Trust Scores & Verification</h2>
          <p className="text-sm text-muted-foreground">Trust scores are computed using automated models (report verification, location consistency, time-decay, pattern detection). Scores may change over time. Soke does not guarantee the accuracy of any report and is not liable for actions taken based on report content.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">7. Prohibited Conduct</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            <li>Spamming or flooding the platform with low-quality reports</li>
            <li>Creating multiple accounts to manipulate scores</li>
            <li>Scraping or automated data collection without authorization</li>
            <li>Distributing malware or harmful code through the platform</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold">8. Disclaimers</h2>
          <p className="text-sm text-muted-foreground">The platform is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access, data accuracy, or fitness for a particular purpose.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">9. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground">Soke shall not be liable for indirect, incidental, or consequential damages arising from use of the platform.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">10. Modifications</h2>
          <p className="text-sm text-muted-foreground">We may update these Terms at any time. Continued use after changes constitutes acceptance of the new Terms.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold">11. Contact</h2>
          <p className="text-sm text-muted-foreground">For legal inquiries, contact us through the platform's support channels.</p>
        </section>
      </CardContent></Card>
    </div>
  );
}
