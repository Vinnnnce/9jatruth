"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { Users, Copy, Check, Gift, Sparkles, Share2 } from "lucide-react";

type ReferralStats = {
  code: string;
  link: string;
  invited: number;
  pending: number;
  completed: number;
  pointsEarned: number;
};

export function RewardsReferralCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const { data, isLoading } = useQuery<ReferralStats>({
    queryKey: ["/api/rewards/referrals"],
    queryFn: async () => {
      const res = await fetch("/api/rewards/referrals");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const copy = async (text: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast({ title: kind === "link" ? "Referral link copied" : "Referral code copied" });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const link = data?.link || "";
  const share = async () => {
    if (navigator.share && data?.link) {
      try {
        await navigator.share({
          title: "Join me on 9jatruth",
          text: "Report and verify local truths in your neighborhood on 9jatruth. Sign up with my link:",
          url: data.link,
        });
      } catch {
        // user cancelled
      }
    } else if (data?.link) {
      copy(data.link, "link");
    }
  };

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-violet-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-emerald-500" />
          Affiliate & Referrals
          <span className="ml-1 text-[9px] font-normal text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            Earn 50 + 100 pts
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Invite friends to 9jatruth. You earn <strong className="text-foreground">50 points</strong> when
          they sign up with your link, and a <strong className="text-foreground">100-point bonus</strong> when
          they make their first verified contribution. Build a network of trusted reporters and earn
          ongoing rewards.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Invited" value={isLoading ? null : data?.invited ?? 0} icon={Users} />
          <Stat label="Completed" value={isLoading ? null : data?.completed ?? 0} icon={Check} />
          <Stat label="Points earned" value={isLoading ? null : data?.pointsEarned ?? 0} icon={Gift} />
        </div>

        {/* Referral link */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Your referral link
          </label>
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 h-9 rounded-md border border-border bg-background px-2 text-xs truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => copy(link, "link")}>
                {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
              <Button size="sm" className="h-9 gap-1" onClick={share}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          )}
          {data?.code && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Code: <code className="font-mono text-foreground">{data.code}</code></span>
              <button className="text-emerald-600 hover:underline" onClick={() => copy(data.code, "code")}>
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Sparkles className="h-3 w-3 text-violet-500" /> How it works
          </div>
          <ol className="text-[11px] text-muted-foreground space-y-1">
            <li>1. Share your referral link with friends and family.</li>
            <li>2. They sign up on 9jatruth using your link.</li>
            <li>3. You get 50 points instantly, +100 when they verify their first truth.</li>
            <li>4. Redeem your points for airtime, data, gift cards & vouchers below.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | null; icon: typeof Users }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-2 text-center">
      <Icon className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
      <div className="text-sm font-bold tabular-nums">
        {value === null ? "…" : value.toLocaleString()}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
