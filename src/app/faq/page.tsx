"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { MapPin } from "lucide-react";

const FAQS = [
  {
    q: "What is 9jatruth?",
    a: "9jatruth is a community-driven truth reporting platform for Nigeria. It enables citizens to report, verify, and share local truths about their neighborhoods — from power status and fuel availability to traffic, safety, and prices. The platform uses AI to provide summaries, predictions, and location intelligence.",
  },
  {
    q: "When does 9jatruth launch?",
    a: "9jatruth officially launches on Friday, 21 August 2026. Until then, the platform is gated behind a countdown page. You can join the waitlist to get notified and receive early access.",
  },
  {
    q: "How do I join the waitlist?",
    a: "Simply enter your email address in the waitlist form on the countdown page. You'll be added to both our database and Clerk authentication system, so when the platform launches, you'll be among the first to access it.",
  },
  {
    q: "Is 9jatruth free to use?",
    a: "Yes, 9jatruth is free for all users. The platform offers community reporting, news, feeds, dashboards, and location intelligence at no cost. Premium features for organizations may be available in the future.",
  },
  {
    q: "What features does 9jatruth offer?",
    a: "9jatruth includes: Community Feeds with location-based sorting, News with AI-generated articles and summaries, an interactive Geo Map with nearby businesses and services, a Portfolio dashboard with trust scores and rewards, AI-powered Search and Compare tools, Predictive Notifications, and a Leaderboard. The platform also supports media uploads, polls, and questionnaires.",
  },
  {
    q: "How does the trust score work?",
    a: "Your trust score is based on the quality and accuracy of your reports. Other users can verify or dispute your truths. Consistently accurate reports increase your trust score, which unlocks badges and rewards. The scoring system is transparent and community-driven.",
  },
  {
    q: "Can I post anonymously?",
    a: "9jatruth displays usernames (not user IDs) on posts, news, and leaderboards. While your identity is protected behind a username, all posts are attributable to your account. This ensures accountability while maintaining privacy.",
  },
  {
    q: "What areas does 9jatruth cover?",
    a: "9jatruth covers all 36 states of Nigeria plus the Federal Capital Territory (FCT). The platform is organized by regions, states, LGAs, and neighborhoods. We also support international regions in search for broader context.",
  },
  {
    q: "How does the AI work?",
    a: "9jatruth uses Kimi AI (Moonshot) for content generation, summaries, predictions, and location intelligence. AI features include multi-level summaries, trend analysis, risk assessment, fact-checking, auto-tagging, and predictive notifications. All AI-generated content is clearly labeled.",
  },
  {
    q: "Can organizations use 9jatruth?",
    a: "Yes, organizations can register on the platform to verify and publish official truths. Org accounts get verification badges and can manage members. Contact us for organization registration after launch.",
  },
  {
    q: "Is my data safe?",
    a: "9jatruth takes privacy seriously. User IPs are hashed before storage, authentication is handled by Clerk (a SOC 2 compliant service), and the database is hosted on Neon (a secure serverless PostgreSQL platform). We never share your personal data with third parties.",
  },
  {
    q: "How can I report a problem or give feedback?",
    a: "You can use the feedback popup available on every page after launch, or contact us directly. We actively monitor and fix issues through our self-healing UI system, which detects and reports broken components automatically.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-muted/30 transition-colors px-2 -mx-2 rounded-md"
      >
        <span className="text-sm font-medium pr-4">{q}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-muted-foreground leading-relaxed px-2 -mx-2">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-emerald-500" />
            <Link href="/countdown" className="text-base font-bold tracking-tight hover:underline">
              9jatruth
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything you need to know about 9jatruth
          </p>
        </div>

        {/* FAQ items */}
        <Card className="border-border">
          <CardContent className="p-4 sm:p-6">
            {FAQS.map((faq, idx) => (
              <FAQItem key={idx} {...faq} />
            ))}
          </CardContent>
        </Card>

        {/* Back to countdown */}
        <div className="mt-8 text-center">
          <Link
            href="/countdown"
            className="inline-flex items-center gap-2 text-sm text-emerald-500 hover:underline"
          >
            <MapPin className="h-4 w-4" />
            Back to Countdown
          </Link>
        </div>
      </div>
    </div>
  );
}
