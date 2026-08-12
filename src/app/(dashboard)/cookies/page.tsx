"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";

type CookieItem = {
  name: string;
  badge: string;
  badgeColor: string;
  desc: string;
};

type Section = {
  title: string;
  content?: string;
  list?: string[];
  cookies?: boolean;
};

const cookieItems: CookieItem[] = [
  {
    name: "soke_agency_token",
    badge: "Essential",
    badgeColor: "bg-green-500/15 text-green-600",
    desc: "An httpOnly, Secure cookie containing a JWT authentication token for agency and user accounts. Expires after 7 days. Strictly necessary for login and session management; cannot be disabled without breaking core functionality.",
  },
  {
    name: "soke_cookie_consent",
    badge: "Functional",
    badgeColor: "bg-blue-500/15 text-blue-600",
    desc: "A localStorage flag storing your cookie consent preference (accepted or declined). No personal data is stored. Retained until you clear browser storage or withdraw consent.",
  },
  {
    name: "soke_seen_quick_tips",
    badge: "Functional",
    badgeColor: "bg-blue-500/15 text-blue-600",
    desc: "A localStorage flag indicating whether you have viewed the quick navigation tips. Used to display onboarding content only to new users. No personal data is stored.",
  },
  {
    name: "soke_ios_banner_dismissed",
    badge: "Functional",
    badgeColor: "bg-blue-500/15 text-blue-600",
    desc: "A localStorage flag recording dismissal of the iOS download banner. Prevents repeated display. No personal data is stored.",
  },
  {
    name: "__clerk_db_jwt / __clerk_db_jwt_2",
    badge: "Essential",
    badgeColor: "bg-green-500/15 text-green-600",
    desc: "Where Clerk authentication is enabled, these httpOnly cookies manage secure authentication sessions. Required for sign-in functionality. Expire per Clerk's configured session policy.",
  },
];

const sections: Section[] = [
  {
    title: "1. Introduction and Legal Framework",
    content:
      "This Cookie Policy forms part of, and is incorporated by reference into, our Terms of Use and Privacy Policy. It explains how Soke (\"we\", \"us\", \"our\") uses cookies and similar tracking technologies, in compliance with the Nigeria Data Protection Act, 2023 (\"NDPA\"), the General Data Protection Regulation (EU) 2016/679 (\"GDPR\"), and the Privacy and Electronic Communications Directive (Directive 2002/58/EC, as amended by the ePrivacy Directive). We are committed to transparency regarding the technologies deployed on our Platform and to providing you with meaningful control over your data.",
  },
  {
    title: "2. What Are Cookies and Similar Technologies",
    content:
      "Cookies are small text files placed on your device by the websites you visit. They are widely used to enable websites to function efficiently and to provide reporting and personalisation. \"Similar technologies\" includes web beacons, pixel tags, local storage, and session storage, which allow data to be stored on your device. This Policy applies to all such technologies collectively referred to herein as \"cookies\". Cookies do not, in themselves, identify you personally; rather, they associate an identifier with your browser or device.",
  },
  {
    title: "3. Categories of Cookies",
    content:
      "We classify the cookies we use into the following categories:",
    list: [
      "Essential Cookies: Strictly necessary for the Platform to function and to provide the services you request. These cannot be disabled in our systems; doing so would impair core functionality such as authentication and security.",
      "Functional Cookies: Enable enhanced functionality and personalisation, such as remembering your preferences and onboarding state. These may be disabled without affecting core functionality.",
      "Analytics Cookies (where consented): Allow us to measure and analyse how visitors interact with the Platform, in aggregated and anonymised form, to improve performance and user experience. We do not deploy these without your consent.",
      "Advertising/Marketing Cookies: We do not deploy third-party advertising or marketing cookies.",
    ],
  },
  {
    title: "4. Cookies We Deploy",
    cookies: true,
  },
  {
    title: "5. Third-Party Cookies",
    content:
      "We do not use third-party tracking, advertising, or analytics cookies. Where third-party services (such as authentication providers like Clerk) are integrated, they may set their own essential cookies strictly necessary for their function. These third parties are bound by their own privacy and cookie policies. We do not share cookie data with third parties for marketing or commercial profiling purposes. Telecommunications providers and payment processors involved in rewards redemption do not set cookies on the Platform; any data exchange occurs server-side via secure APIs.",
  },
  {
    title: "6. Consent and Consent Management",
    content:
      "Pursuant to Article 5(3) of the ePrivacy Directive and the NDPA, we seek your consent prior to placing non-essential cookies on your device. On your first visit, we present a cookie consent banner allowing you to accept or decline non-essential cookies. Your choice is stored in local storage and persists until withdrawn. Essential cookies are placed without consent as they are strictly necessary for the provision of the service you have requested. You may withdraw or modify your consent at any time by clearing your browser storage or contacting us, and the relevant non-essential technologies will cease to be deployed.",
  },
  {
    title: "7. Managing and Deleting Cookies",
    content:
      "You have full control over cookies through your browser settings. You may configure your browser to accept, block, or delete cookies, and to alert you when cookies are being set. Note that disabling essential cookies (such as the authentication token) will sign you out and prevent access to authenticated features. The methods for managing cookies vary by browser; consult your browser's help documentation for instructions. Clearing local storage will reset onboarding and consent preferences. We are not responsible for the functionality of browser-level cookie controls.",
  },
  {
    title: "8. Browser Geolocation",
    content:
      "We use the browser Geolocation API, rather than cookies, to determine your approximate location for the purpose of displaying nearby posts and feeds. This requires your explicit, granular permission, which may be granted or revoked at any time through your browser's site settings. Geolocation is not stored in cookies; precise coordinates are processed transiently and never persisted in raw form. For further information, see our Privacy Policy.",
  },
  {
    title: "9. Cookie Retention",
    content:
      "Essential authentication cookies expire after seven (7) days or upon sign-out, whichever is earlier. Functional local-storage items persist until you clear browser storage or withdraw consent. No cookies are retained beyond the period necessary to fulfil the purpose for which they were set, save where retention is required for security, integrity, or legal compliance.",
  },
  {
    title: "10. Updates to This Cookie Policy",
    content:
      "We may update this Cookie Policy from time to time to reflect changes in technology, legal requirements, or our practices. Material changes will be notified via the Platform. The \"Last updated\" date below indicates the most recent revision. Where new categories of non-essential cookies are introduced, we will seek fresh consent in accordance with applicable law.",
  },
  {
    title: "11. Contact",
    content:
      "For any inquiries regarding this Cookie Policy or your cookie preferences, please contact us through the Platform's support channels. We will respond in accordance with our obligations under the NDPA and GDPR.",
  },
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
          <p className="text-xs text-muted-foreground mt-0.5">Last updated: August 12, 2026</p>
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
