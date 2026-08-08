"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

const sections = [
  { title: "1. Acceptance of Terms", content: "By accessing or using Soke, you agree to be bound by these Terms of Use. If you do not agree, please do not use the platform." },
  { title: "2. Description of Service", content: "Soke is a community-driven platform for reporting and verifying real-time conditions (power, fuel, traffic, prices, safety) in your neighborhood. The platform includes trust scoring, gamification, and location-based feed filtering." },
  { title: "3. User Responsibilities", list: ["Submit only truthful and accurate reports", "Do not submit false, misleading, or malicious content", "Do not impersonate other users or organizations", "Respect the privacy of other users", "Do not attempt to manipulate trust scores or gamification", "Do not use the platform for any illegal activities"] },
  { title: "4. Agency Accounts", content: "Organizations may register for agency accounts. Agency accounts are subject to verification. Organizations are responsible for maintaining the security of their account credentials and for all activities under their account." },
  { title: "5. Content Ownership & Licensing", content: "You retain ownership of your submitted content. By submitting, you grant Soke a non-exclusive, royalty-free license to display, process, and analyze your content for the platform's purposes, including trust scoring and pattern detection." },
  { title: "6. Trust Scores & Verification", content: "Trust scores are computed using automated models (report verification, location consistency, time-decay, pattern detection). Scores may change over time. Soke does not guarantee the accuracy of any report and is not liable for actions taken based on report content." },
  { title: "7. Prohibited Conduct", list: ["Spamming or flooding the platform with low-quality reports", "Creating multiple accounts to manipulate scores", "Scraping or automated data collection without authorization", "Distributing malware or harmful code through the platform"] },
  { title: "8. Disclaimers", content: "The platform is provided \"as is\" without warranties of any kind. We do not guarantee uninterrupted access, data accuracy, or fitness for a particular purpose." },
  { title: "9. Limitation of Liability", content: "Soke shall not be liable for indirect, incidental, or consequential damages arising from use of the platform." },
  { title: "10. Modifications", content: "We may update these Terms at any time. Continued use after changes constitutes acceptance of the new Terms." },
  { title: "11. Contact", content: "For legal inquiries, contact us through the platform's support channels." },
];

export default function TermsOfUse() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div
        className="flex items-center gap-3 animate-fade-in-up"
        style={{ opacity: 0 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 animate-scale-in" style={{ opacity: 0 }}>
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-700 gradient-text">Terms of Use</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Last updated: August 7, 2026</p>
        </div>
      </div>

      <Card
        className="animate-fade-in-up"
        style={{ opacity: 0, animationDelay: "100ms" }}
      >
        <CardContent className="p-6 space-y-5">
          {sections.map((section, i) => (
            <section
              key={i}
              className="animate-fade-in-up"
              style={{ opacity: 0, animationDelay: `${150 + i * 70}ms` }}
            >
              <h2 className="text-base font-semibold mb-1.5">{section.title}</h2>
              {section.content && (
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              )}
              {section.list && (
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
                  {section.list.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
