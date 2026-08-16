"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

type Section = {
  title: string;
  content?: string;
  list?: string[];
  link?: { href: string; label: string };
};

const sections: Section[] = [
  {
    title: "1. Introduction and Scope",
    content:
      "9jatruth (\"we\", \"us\", \"our\", or \"the Platform\") is a community-driven truth-reporting and information-sharing platform operated under the laws of the Federal Republic of Nigeria. This Privacy Policy, drafted in accordance with the Nigeria Data Protection Act, 2023 (\"NDPA\") and the General Data Protection Regulation (EU) 2016/679 (\"GDPR\"), governs the collection, processing, storage, transfer, and disclosure of personal data of users (\"Data Subjects\", \"you\", \"your\") who access or utilise the Platform. By registering an account, submitting content, or otherwise interacting with the Platform, you acknowledge that you have read, understood, and consented to the data practices described herein. This Policy is incorporated by reference into, and forms an integral part of, our Terms of Use.",
  },
  {
    title: "2. Legal Basis for Processing",
    content:
      "Pursuant to Article 6 of the GDPR and Section 34 of the NDPA, we process your personal data on one or more of the following lawful bases: (a) your express, freely given, specific, informed, and unambiguous consent; (b) the performance of a contract to which you are a party; (c) compliance with a legal obligation to which we are subject; (d) protection of your vital interests; (e) the legitimate interests of the Platform in delivering, securing, and improving its services, balanced against your fundamental rights and freedoms; and (f) the public interest. Where processing is based on consent, you retain the right to withdraw consent at any time without affecting the lawfulness of processing carried out prior to such withdrawal.",
  },
  {
    title: "3. Categories of Personal Data Collected",
    list: [
      "Identity Data: Full name, username, display name, and organisation name (for agency accounts).",
      "Contact Data: Email address, phone number, and contact details provided for agency registration.",
      "Authentication Data: Bcrypt-hashed passwords (12 rounds); JWT authentication tokens stored in httpOnly cookies; OAuth identifiers where third-party sign-in is utilised.",
      "Location Data: Approximate geolocation derived from the browser Geolocation API for the sole purpose of displaying nearby posts and feeds. Precise GPS coordinates are used transiently for distance calculation and are never persisted in raw form.",
      "Network Data: IP addresses hashed using the SHA-256 algorithm prior to storage. Raw IP addresses are processed in memory only and are not retained in any database or log.",
      "Content Data: Truth reports, comments, articles, images, videos, and other user-generated content submitted to the Platform.",
      "Usage Data: Device identifiers (hashed), browsing events, interaction metadata, and telemetry collected for analytics, gamification, and reward tracking.",
      "Transaction Data: Rewards ledger entries, redemption requests, and credit balances associated with your account.",
    ],
  },
  {
    title: "4. Purposes of Processing",
    list: [
      "To provide, operate, and maintain the core truth-reporting, news, and feed functionality of the Platform;",
      "To verify, score, and ascertain the trustworthiness of community-submitted reports through automated models including AI authenticity checks and pattern detection;",
      "To prevent, detect, and investigate spam, fraud, abuse, manipulation, and unauthorised access;",
      "To administer agency and organisation accounts, including authentication, verification, and access control;",
      "To operate gamification features, including XP, achievements, leaderboards, and the rewards redemption system (airtime, data, gift cards, and vouchers);",
      "To deliver push notifications, alerts, and communications to which you have subscribed;",
      "To aggregate and anonymise data for statistical analysis, product improvement, and service development;",
      "To comply with applicable legal, regulatory, and law-enforcement obligations.",
    ],
  },
  {
    title: "5. Data Retention and Storage",
    content:
      "Personal data is retained only for as long as necessary to fulfil the purposes for which it was collected, or as required by applicable law. Truth reports and associated content are retained as part of the permanent community record unless removed pursuant to a valid erasure request or content-moderation action. Agency account data is retained for the duration of the account's active status and may be deleted upon verified request. IP hashes are retained for the lifetime of their associated reports to support integrity and anti-abuse functions. Authentication tokens expire after seven (7) days. Rewards ledger data is retained for a minimum of six (6) years to satisfy financial record-keeping requirements. Upon account deletion, we will erase or anonymise your personal data within thirty (30) days, except where retention is mandated by law.",
  },
  {
    title: "6. Data Subject Rights",
    content:
      "In accordance with Sections 34–39 of the NDPA and Articles 15–22 of the GDPR, you enjoy the following rights with respect to your personal data:",
    list: [
      "Right of Access: The right to obtain confirmation of whether we process your data and a copy thereof.",
      "Right to Rectification: The right to have inaccurate or incomplete data corrected without undue delay.",
      "Right to Erasure (Right to be Forgotten): The right to request deletion of your personal data, subject to lawful retention obligations.",
      "Right to Restriction of Processing: The right to request that we limit processing of your data under specified circumstances.",
      "Right to Data Portability: The right to receive your data in a structured, commonly used, and machine-readable format, and to transmit it to another controller.",
      "Right to Object: The right to object to processing based on legitimate interests or carried out for direct marketing.",
      "Right to Withdraw Consent: The right to withdraw consent at any time where processing relies on consent.",
      "Right to Lodge a Complaint: The right to lodge a complaint with the Nigeria Data Protection Commission (\"NDPC\") or a supervisory authority in your jurisdiction.",
    ],
  },
  {
    title: "7. Data Security and Technical Safeguards",
    content:
      "We implement appropriate technical and organisational measures commensurate with the risk to the rights and freedoms of Data Subjects, in accordance with Article 32 of the GDPR and Section 14 of the NDPA. These measures include: bcrypt password hashing with twelve (12) rounds; httpOnly and Secure cookie attributes for authentication tokens; transport-layer encryption via HTTPS/TLS 1.2 or higher in production environments; SHA-256 hashing of IP addresses prior to persistence; CSRF protection on all state-changing requests; role-based access control and least-privilege principles; regular security reviews and vulnerability assessments. Notwithstanding these safeguards, no method of transmission over the Internet or electronic storage is fully secure, and we cannot guarantee absolute security.",
  },
  {
    title: "8. Third-Party Processors and Sub-processors",
    content:
      "We engage trusted third-party service providers (\"Processors\") who act on our behalf under written agreements imposing equivalent data-protection obligations. Categories of Processors include:",
    list: [
      "Telecommunications Providers: For the delivery of airtime and data-bundle rewards to your phone number upon redemption.",
      "Payment Processors: For the facilitation of any paid transactions, reward fulfilment, and voucher issuance. We do not store full card numbers or banking credentials; such data is handled exclusively by PCI-DSS-compliant processors.",
      "Cloud Infrastructure and Database Providers: For hosting, storage, and computing services.",
      "Authentication Providers: For identity verification and single sign-on services (e.g., Clerk).",
      "Analytics and Telemetry Providers: For aggregated, anonymised usage analytics.",
    ],
  },
  {
    title: "9. Cross-Border Data Transfers",
    content:
      "Your personal data may be processed and stored in data centres located outside Nigeria, including within the European Economic Area and the United States. Where data is transferred to a third country, we ensure that such transfers are carried out in compliance with Chapter V of the GDPR and the NDPA, utilising appropriate safeguards such as Standard Contractual Clauses, adequacy decisions, or binding corporate rules, and only to recipients providing a level of data protection substantially equivalent to that required under Nigerian and EU law.",
  },
  {
    title: "10. Children's Privacy",
    content:
      "The Platform is not directed at, nor intended for use by, individuals under the age of thirteen (13) years, or the minimum age of digital consent applicable in your jurisdiction. We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal data, please contact us so that we may promptly delete such data. Where verification of age is required for rewards redemption (e.g., telecommunications services), we rely on the identity verification of the telecommunications provider.",
  },
  {
    title: "11. Cookies and Tracking Technologies",
    content:
      "We use essential cookies (httpOnly JWT tokens) strictly necessary for authentication and platform functionality. We do not deploy third-party tracking, advertising, or analytics cookies without your consent. Full details of cookie usage and consent management are set out in our Cookie Policy.",
    link: { href: "/cookies", label: "Cookie Policy" },
  },
  {
    title: "12. Automated Decision-Making and Profiling",
    content:
      "Trust scores, AI authenticity verdicts, and AI-generated predictions are produced by automated processing models. These outputs are advisory in nature and do not produce legal or similarly significant effects concerning you. You have the right not to be subject to a decision based solely on automated processing that produces such effects, pursuant to Article 22 of the GDPR. Where automated outputs inform moderation actions, human review is available upon request.",
  },
  {
    title: "13. Changes to This Privacy Policy",
    content:
      "We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or Platform features. Material changes will be notified via the Platform or by email where feasible. The \"Last updated\" date below indicates the date of the most recent revision. Continued use of the Platform following the effective date of any change constitutes acceptance of the revised Policy.",
  },
  {
    title: "14. Contact and Data Protection Officer",
    content:
      "For any privacy inquiries, data subject rights requests, or communications with our Data Protection Officer, please contact us through the Platform's support channels or at the designated privacy contact. We will acknowledge receipt of your request within seventy-two (72) hours and respond substantively within thirty (30) days, in accordance with the NDPA and GDPR.",
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
          <p className="text-xs text-muted-foreground mt-0.5">Last updated: August 16, 2026</p>
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
