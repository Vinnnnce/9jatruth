"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";

const cookieItems = [
  { name: "soke_agency_token", badge: "Essential", badgeColor: "bg-green-500/15 text-green-600", desc: "An httpOnly cookie containing a JWT authentication token for agency accounts. Expires after 7 days. Required for login functionality." },
  { name: "soke_cookie_consent", badge: "Functional", badgeColor: "bg-blue-500/15 text-blue-600", desc: "A localStorage flag storing your cookie consent preference (accepted/declined). No personal data is stored." },
  { name: "soke_seen_quick_tips", badge: "Functional", badgeColor: "bg-blue-500/15 text-blue-600", desc: "A localStorage flag indicating whether the user has seen the quick navigation tips. Used to show onboarding only to new users." },
];

const sections = [
  { title: "1. What Are Cookies", content: "Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently and provide a better user experience." },
  { title: "2. Cookies We Use", cookies: true },
  { title: "3. Third-Party Cookies", content: "We do not use third-party tracking cookies, advertising cookies, or analytics cookies. We do not share cookie data with third parties." },
  { title: "4. Managing Cookies", content: "Essential cookies (authentication) cannot be disabled as they are required for the platform to function. You can clear all cookies through your browser settings at any time. Note that clearing the authentication cookie will sign you out." },
  { title: "5. Browser Geolocation", content: "We use the browser's Geolocation API (not cookies) to determine your approximate location for nearby post filtering. This requires your explicit permission and can be revoked at any time through your browser's site settings." },
  { title: "6. Changes to This Policy", content: "We may update this Cookie Policy as we add or modify features. We will update the \"Last updated\" date accordingly." },
];

export default function CookiePolicy() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div
        className="flex items-center gap-3 animate-fade-in-up"
        style={{ opacity: 0 }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 animate-scale-in" style={{ opacity: 0 }}>
          <Cookie className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-700 gradient-text">Cookie Policy</h1>
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
              {section.cookies && (
                <div className="space-y-3 mt-2">
                  {cookieItems.map((item, j) => (
                    <div
                      key={j}
                      className="rounded-md border p-3 animate-fade-in-up hover:border-primary/30 transition-colors"
                      style={{ opacity: 0, animationDelay: `${250 + j * 80}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium font-mono">{item.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${item.badgeColor}`}>{item.badge}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
