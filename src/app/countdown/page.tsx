"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  Clock,
  Mail,
  CheckCircle2,
  Loader2,
  Sparkles,
  Bell,
  Images,
  HelpCircle,
} from "lucide-react";
import Image from "next/image";

// Launch date: Friday, 21 August 2026, 00:00 Africa/Lagos (WAT, UTC+1)
// 9jatruth is a Nigeria-focused platform, so we use Lagos time.
const LAUNCH_DATE = new Date("2026-08-21T00:00:00+01:00");

function getTimeRemaining() {
  const now = new Date().getTime();
  const distance = LAUNCH_DATE.getTime() - now;
  if (distance <= 0) {
    return { distance: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isLaunched: true };
  }
  return {
    distance,
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
    isLaunched: false,
  };
}

/** Analogue clock SVG with moving hour, minute, and second hands. */
function AnalogueClock({ time }: { time: ReturnType<typeof getTimeRemaining> }) {
  const { hours, minutes, seconds } = time;
  // Clock hand angles (360 degrees = full rotation)
  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = ((minutes + seconds / 60) / 60) * 360;
  const hourAngle = (((hours % 24) + minutes / 60) / 24) * 360 * 2; // 24h clock face

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full h-full max-w-[280px] max-h-[280px]"
      style={{ filter: "drop-shadow(0 4px 20px rgba(16,185,129,0.15))" }}
    >
      {/* Outer ring */}
      <circle
        cx="150"
        cy="150"
        r="145"
        fill="none"
        stroke="url(#clockRing)"
        strokeWidth="2"
      />
      {/* Clock face */}
      <circle cx="150" cy="150" r="135" fill="rgba(10,10,15,0.95)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      <defs>
        <linearGradient id="clockRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="hourHand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="minuteHand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>

      {/* Hour markers (24-hour clock) */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * 360;
        const rad = (angle - 90) * (Math.PI / 180);
        const isMajor = i % 6 === 0;
        const r1 = isMajor ? 115 : 122;
        const r2 = 130;
        const x1 = 150 + r1 * Math.cos(rad);
        const y1 = 150 + r1 * Math.sin(rad);
        const x2 = 150 + r2 * Math.cos(rad);
        const y2 = 150 + r2 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMajor ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}
            strokeWidth={isMajor ? 2 : 1}
          />
        );
      })}

      {/* Hour numbers at key positions */}
      {[
        { label: "0", angle: 0 },
        { label: "6", angle: 90 },
        { label: "12", angle: 180 },
        { label: "18", angle: 270 },
      ].map(({ label, angle }) => {
        const rad = (angle - 90) * (Math.PI / 180);
        const r = 100;
        return (
          <text
            key={label}
            x={150 + r * Math.cos(rad)}
            y={150 + r * Math.sin(rad)}
            fill="rgba(255,255,255,0.4)"
            fontSize="11"
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}

      {/* Hour hand */}
      <line
        x1="150"
        y1="150"
        x2="150"
        y2="60"
        stroke="url(#hourHand)"
        strokeWidth="4"
        strokeLinecap="round"
        transform={`rotate(${hourAngle} 150 150)`}
        style={{ transition: "transform 0.3s ease-out" }}
      />
      {/* Minute hand */}
      <line
        x1="150"
        y1="150"
        x2="150"
        y2="40"
        stroke="url(#minuteHand)"
        strokeWidth="3"
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} 150 150)`}
        style={{ transition: "transform 0.3s ease-out" }}
      />
      {/* Second hand */}
      <line
        x1="150"
        y1="150"
        x2="150"
        y2="30"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${secondAngle} 150 150)`}
      />
      {/* Center cap */}
      <circle cx="150" cy="150" r="6" fill="#10b981" />
      <circle cx="150" cy="150" r="3" fill="#0a0a0f" />
    </svg>
  );
}

export default function CountdownPage() {
  const [time, setTime] = useState(getTimeRemaining());
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTime(getTimeRemaining()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleWaitlist = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to join waitlist");
      }
      setStatus("success");
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong");
    }
  }, [email]);

  if (time.isLaunched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-bold">9jatruth is Live</h1>
            <p className="text-sm text-muted-foreground">
              The countdown is complete. Redirecting you to the platform...
            </p>
            <Button onClick={() => (window.location.href = "/feeds")} className="w-full">
              Enter 9jatruth
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-emerald-950/20 p-4 sm:p-6">
      {/* Background grid pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <MapPin className="h-6 w-6 text-emerald-500" />
            <span className="text-lg font-bold tracking-tight">9jatruth</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Launching Soon
          </h1>
          <p className="text-sm text-muted-foreground">
            Friday, 21 August 2026 — Nigeria&apos;s community truth platform goes live
          </p>
        </div>

        {/* Analogue clock */}
        <div className="flex justify-center">
          <AnalogueClock time={time} />
        </div>

        {/* Digital countdown */}
        <div className="flex justify-center gap-3 sm:gap-6">
          {[
            { label: "Days", value: time.days },
            { label: "Hours", value: time.hours },
            { label: "Minutes", value: time.minutes },
            { label: "Seconds", value: time.seconds },
          ].map((unit) => (
            <div key={unit.label} className="text-center">
              <div className="text-2xl sm:text-4xl font-bold font-mono tabular-nums text-emerald-400">
                {String(unit.value).padStart(2, "0")}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                {unit.label}
              </div>
            </div>
          ))}
        </div>

        {/* Waitlist form */}
        <Card className="border-emerald-500/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-medium">Join the Waitlist</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Be the first to know when we launch. Get early access and exclusive updates.
            </p>
            {status === "success" ? (
              <div className="flex items-center gap-2 text-emerald-500 py-3">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">
                  You&apos;re on the list. We&apos;ll notify you at launch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10"
                    required
                    disabled={status === "loading"}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={status === "loading" || !email.trim()}
                  className="h-10 gap-1.5"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Notify Me
                </Button>
              </form>
            )}
            {status === "error" && (
              <p className="text-xs text-destructive">{errorMsg}</p>
            )}
          </CardContent>
        </Card>

        {/* Screenshot gallery */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-medium">Platform Preview</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            A glimpse of what&apos;s coming when 9jatruth launches.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: "/countdown/screenshots/feeds.png", label: "Community Feeds", span: "col-span-2" },
              { src: "/countdown/screenshots/news.png", label: "News & Articles", span: "" },
              { src: "/countdown/screenshots/dashboard.png", label: "Dashboard", span: "" },
              { src: "/countdown/screenshots/sidebar.png", label: "Sidebar Navigation", span: "col-span-2" },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 group ${item.span}`}
              >
                <div className="aspect-video relative">
                  <Image
                    src={item.src}
                    alt={item.label}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 to-transparent p-2">
                  <p className="text-[10px] font-medium text-foreground/80">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs text-muted-foreground/60">
            <Clock className="h-3 w-3 inline mr-1" />
            Countdown to Friday, August 21, 2026 — 12:00 AM WAT
          </p>
          <a
            href="/faq"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:underline"
          >
            <HelpCircle className="h-3 w-3" />
            Frequently Asked Questions
          </a>
        </div>
      </div>
    </div>
  );
}
