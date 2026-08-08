"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

const sections = [
  {
    title: "1. Introduction",
    content: "Soke (\"we\", \"us\", \"our\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform for community-driven truth reporting.",
  },
  {
    title: "2. Information We Collect",
    list: [
      "Location Data: We use your browser's geolocation API to show posts near you. Your exact GPS coordinates are used only for distance calculation and are never stored in raw form on our servers.",
      "IP Address: We hash your IP address using SHA-256 before storage. Raw IP addresses are never stored. Hashed IPs are used for approximate geolocation and abuse prevention.",
      "Account Information: For agency accounts, we collect email, organization name, contact details, and a bcrypt-hashed password.",
      "Report Content: The content of truth reports you submit, including category and neighborhood selection.",
      "Usage Data: Device identifiers (hashed) for gamification and reward tracking.",
    ],
  },
  {
    title: "3. How We Use Your Information",
    list: [
      "To display relevant posts and feeds near your location",
      "To verify and score the trustworthiness of community reports",
      "To prevent spam and abuse through IP-based tracking",
      "To manage agency/organization accounts and authentication",
      "To provide gamification features (XP, achievements, leaderboards)",
      "To send push notifications for alerts you've subscribed to",
    ],
  },
  {
    title: "4. Data Retention",
    content: "Truth reports are retained indefinitely as part of the community record. Agency account data is retained while the account is active and may be deleted upon request. IP hashes are retained for the lifetime of associated reports.",
  },
  {
    title: "5. Your Rights",
    list: [
      "Access: You may request a copy of your personal data",
      "Rectification: You may correct inaccurate information through account settings",
      "Erasure: You may request deletion of your account and associated data",
      "Restriction: You may request we limit processing of your data",
      "Portability: You may export your data in CSV format",
    ],
  },
  {
    title: "6. Cookies",
    content: "We use essential cookies for authentication (httpOnly JWT tokens). We do not use third-party tracking cookies. See our Cookie Policy for details.",
    link: { href: "/cookies", label: "Cookie Policy" },
  },
  {
    title: "7. Data Security",
    content: "Passwords are hashed with bcrypt (12 rounds). JWT tokens are stored in httpOnly cookies. All communication uses HTTPS in production. IP addresses are SHA-256 hashed before storage.",
  },
  {
    title: "8. Contact",
    content: "For privacy inquiries, contact us through the platform's support channels.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div
        className="flex items-center gap-3 animate-fade-in-up"
        style={{ opacity: 0 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 animate-scale-in" style={{ opacity: 0 }}>
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-700 gradient-text">Privacy Policy</h1>
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
              style={{ opacity: 0, animationDelay: `${150 + i * 80}ms` }}
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
              {section.link && (
                <p className="text-sm text-muted-foreground mt-1">
                  See our{" "}
                  <a href={section.link.href} className="text-primary hover:underline">
                    {section.link.label}
                  </a>{" "}
                  for details.
                </p>
              )}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
