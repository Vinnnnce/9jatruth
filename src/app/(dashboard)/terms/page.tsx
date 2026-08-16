"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

type Section = {
  title: string;
  content?: string;
  list?: string[];
  link?: { href: string; label: string };
};

const sections: Section[] = [
  {
    title: "1. Acceptance and Formation of Agreement",
    content:
      "These Terms of Use (\"Terms\") constitute a legally binding agreement between you (\"User\", \"you\", \"your\") and 9jatruth (\"we\", \"us\", \"our\", or \"the Platform\") governing your access to and use of the 9jatruth platform, including all associated websites, mobile applications, application programming interfaces, and services (collectively, the \"Services\"). By accessing, browsing, registering an account, or otherwise using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms in their entirety. If you do not agree to these Terms, you must immediately cease all use of the Services. If you are entering into this agreement on behalf of an organisation, you represent and warrant that you possess the requisite authority to bind that organisation.",
  },
  {
    title: "2. Description and Nature of Services",
    content:
      "9jatruth is a community-driven platform for the real-time reporting, verification, and dissemination of hyperlocal conditions, including but not limited to power supply, fuel availability, traffic, commodity prices, and safety, within neighbourhoods and local government areas. The Services further encompass: a news publishing and editorial system; trust-scoring and AI-assisted authenticity verification; gamification and a rewards redemption programme (airtime, data bundles, gift cards, and shopping vouchers via VTPass and Africa's Talking); location-based feed filtering; interactive maps with 3D terrain visualisation and senseEDGE geo intelligence; media editing tools (image filters, adjustments, and video trimming); questionnaire and feedback collection; and agency and organisation dashboards. The Services are provided on an \"as is\" and \"as available\" basis. We reserve the right to modify, suspend, or discontinue any feature of the Services at any time without liability, upon reasonable notice where feasible.",
  },
  {
    title: "3. Eligibility and Account Registration",
    content:
      "You must be at least thirteen (13) years of age, or the minimum age of digital consent in your jurisdiction, to use the Services. Agency and organisation accounts require verification and the provision of accurate registration information, including email address, organisation name, and contact details. You are responsible for maintaining the confidentiality and security of your account credentials and for all activities occurring under your account. You agree to notify us immediately of any unauthorised access, use, or security breach. We reserve the right to refuse, suspend, or terminate accounts at our sole discretion where we reasonably suspect breach of these Terms, fraud, or abuse.",
  },
  {
    title: "4. User Obligations and Permitted Conduct",
    content: "You agree to use the Services lawfully and in good faith. In particular, you undertake to:",
    list: [
      "Submit only truthful, accurate, and verifiable reports, articles, and content;",
      "Refrain from submitting false, misleading, defamatory, or malicious content;",
      "Not impersonate any other person, organisation, or entity, or misrepresent your affiliation;",
      "Respect the privacy, intellectual property, and other rights of other users and third parties;",
      "Not attempt to manipulate, circumvent, or undermine trust scores, gamification, or the rewards system;",
      "Not deploy automated systems, bots, scrapers, or crawlers to collect data without our express written authorisation;",
      "Not introduce or distribute malware, viruses, or any harmful code through the Services;",
      "Not use the Services for any unlawful, fraudulent, or prohibited purpose under applicable Nigerian or international law.",
    ],
  },
  {
    title: "5. Intellectual Property and Licensing",
    content:
      "All right, title, and interest in and to the Services, including the Platform's source code, design, logos, trademarks, trade names, graphics, and underlying technology, are and remain the exclusive property of 9jatruth or its licensors, and are protected by the laws of the Federal Republic of Nigeria and international intellectual property conventions. You retain ownership of all content you submit (\"User Content\"). By submitting User Content, you grant 9jatruth a worldwide, non-exclusive, royalty-free, sub-licensable, and transferable licence to host, store, use, reproduce, modify, adapt, publish, translate, process, analyse, display, and distribute such User Content for the purposes of operating, improving, and securing the Services, including trust scoring, AI authenticity analysis, pattern detection, and aggregated analytics. You represent and warrant that you possess all rights necessary to grant this licence and that your User Content does not infringe the rights of any third party.",
  },
  {
    title: "6. User-Generated Content and Moderation",
    content:
      "You are solely responsible for the User Content you submit. We do not endorse, and accept no liability for, the accuracy, completeness, or legality of any User Content. We reserve the right, but undertake no obligation, to monitor, review, edit, remove, or restrict access to User Content that we determine, in our sole discretion, violates these Terms, applicable law, or community standards. AI-assisted authenticity checks and trust-scoring models produce advisory outputs and do not constitute a warranty as to the truth or falsity of any report. Reporting or flagging mechanisms are available to all users. Repeat or serious violations may result in account suspension or permanent termination.",
  },
  {
    title: "7. Trust Scores, Verification, and Automated Processing",
    content:
      "Trust scores are computed using automated models incorporating report verification, location consistency, temporal decay, and pattern detection. Scores are dynamic and subject to change without notice. AI authenticity checks and predictions are generated by machine-learning models and are probabilistic in nature. 9jatruth does not guarantee the accuracy, reliability, or completeness of any trust score, AI output, or report, and shall not be liable for any action taken or omitted in reliance thereon. You acknowledge that automated processing may inform moderation decisions, and that human review is available upon reasonable request.",
  },
  {
    title: "8. Rewards, Credits, and Redemption",
    content:
      "The rewards programme allows eligible users to earn credits for verified truth submissions and corroborations, and to redeem such credits for airtime, data bundles, gift cards, and shopping vouchers fulfilled through third-party telecommunications providers (VTPass and Africa's Talking). Credits have no monetary value, are non-transferable, and constitute a limited licence to participate in the rewards programme, not a property right or financial instrument. Redemption is subject to availability, eligibility verification by third-party telecommunications providers and payment processors, and applicable terms. We reserve the right to modify credit values, redemption options, and programme terms, or to suspend or terminate the rewards programme, at any time. Fraudulent or manipulative attempts to obtain credits or redemptions will result in forfeiture, account termination, and, where applicable, referral to law enforcement.",
  },
  {
    title: "9. Third-Party Services and Links",
    content:
      "The Services may integrate with or contain links to third-party websites, applications, and services, including telecommunications providers, payment processors, and content platforms, over which we exercise no control. We are not responsible for the content, privacy practices, or availability of any third-party service. Your interactions with third parties are solely between you and such third parties. Applicable terms and conditions of third parties govern those interactions.",
  },
  {
    title: "10. Disclaimers",
    content:
      "To the maximum extent permitted by applicable law, the Services are provided on an \"as is\" and \"as available\" basis, without any warranties of any kind, whether express, implied, statutory, or otherwise, including but not limited to implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Services will be uninterrupted, secure, error-free, or that defects will be corrected. We make no representation or warranty regarding the accuracy, reliability, or completeness of any content, trust score, or AI output displayed on the Services. No advice or information obtained from the Services shall create any warranty not expressly stated in these Terms.",
  },
  {
    title: "11. Limitation of Liability",
    content:
      "To the fullest extent permitted by law, in no event shall 9jatruth, its officers, directors, employees, agents, affiliates, or licensors be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, data, goodwill, or other intangible losses, arising out of or in connection with your use of, or inability to use, the Services, whether based on warranty, contract, tort (including negligence), statute, or any other legal theory, and whether or not we have been advised of the possibility of such damages. Our aggregate liability for all claims arising out of or relating to the Services shall not exceed the greater of (a) the amount you have paid to us in the preceding twelve (12) months, or (b) one hundred thousand Nigerian Naira (₦100,000). Nothing in these Terms shall exclude or limit liability that cannot be excluded or limited under applicable law.",
  },
  {
    title: "12. Indemnification",
    content:
      "You agree to indemnify, defend, and hold harmless 9jatruth, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of or in connection with: (a) your User Content; (b) your breach or alleged breach of these Terms; (c) your violation of any law or the rights of any third party; or (d) your misuse of the Services. We reserve the right, at our own expense, to assume the exclusive defence and control of any matter subject to indemnification, in which case you will cooperate with us in asserting any available defences.",
  },
  {
    title: "13. Dispute Resolution and Arbitration",
    content:
      "Any dispute, controversy, or claim arising out of or relating to these Terms or the Services (\"Dispute\") shall, in the first instance, be resolved through good-faith negotiation between the parties for a period of thirty (30) days. If the Dispute remains unresolved, it shall be finally and exclusively resolved by binding arbitration administered in accordance with the Arbitration and Conciliation Act, Cap A18, Laws of the Federation of Nigeria, 2004 (as amended). The seat of arbitration shall be Lagos, Nigeria; the language shall be English; and a single arbitrator shall be appointed. The arbitral award shall be final and binding, and judgment thereon may be entered in any court of competent jurisdiction. Nothing herein shall prevent either party from seeking injunctive or other equitable relief from a court of competent jurisdiction for the protection of intellectual property or confidential information. The United Nations Convention on Contracts for the International Sale of Goods shall not apply.",
  },
  {
    title: "14. Governing Law and Jurisdiction",
    content:
      "These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of laws principles. Subject to the arbitration provision above, the courts of Nigeria shall have exclusive jurisdiction over any matter not subject to arbitration.",
  },
  {
    title: "15. Platform Modifications and Updates",
    content:
      "We continuously develop and improve the Services. We may, at any time, modify, enhance, suspend, or discontinue features, functionality, or the Services in whole or in part, with or without notice. We shall not be liable to you or any third party for any such modification, suspension, or discontinuance. We will use reasonable efforts to notify users of material changes to the Services via the Platform. Your continued use of the Services following any change constitutes acceptance of the modified Services.",
  },
  {
    title: "16. Modifications to These Terms",
    content:
      "We may revise these Terms from time to time. The most current version will always be available on the Platform, with the \"Last updated\" date reflecting the most recent revision. We will notify users of material changes through the Platform or by email where feasible. Your continued use of the Services after the effective date of any revised Terms constitutes your acceptance of the changes. If you do not agree to the revised Terms, you must discontinue use of the Services.",
  },
  {
    title: "17. Termination",
    content:
      "You may terminate your account at any time through the account settings. We may suspend or terminate your access to the Services immediately, without notice or liability, if you breach these Terms, engage in fraudulent or abusive conduct, or where required by law. Upon termination, all licences granted to you under these Terms cease immediately. Provisions which by their nature should survive termination (including intellectual property, disclaimers, limitation of liability, indemnification, and dispute resolution) shall continue in full force and effect.",
  },
  {
    title: "18. General Provisions",
    list: [
      "Severability: If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.",
      "Waiver: No failure or delay by us in exercising any right shall constitute a waiver thereof.",
      "Entire Agreement: These Terms, together with the Privacy Policy and Cookie Policy, constitute the entire agreement between you and 9jatruth regarding the Services.",
      "Assignment: You may not assign or transfer these Terms without our prior written consent; we may assign them freely.",
      "Notices: We may provide notices via the Platform or to the email address associated with your account.",
      "Force Majeure: We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control.",
    ],
  },
  {
    title: "19. Contact",
    content:
      "For any legal inquiries, notices, or communications concerning these Terms, please contact us through the Platform's support channels. Notices to 9jatruth shall be deemed delivered when received at the designated contact point.",
    link: { href: "/privacy", label: "Privacy Policy" },
  },
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
