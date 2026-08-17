"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, MapPin, Sparkles, Brain, Clock, Sun, Moon, Monitor,
  Zap, FileText, BarChart3, Layout, Type, Palette,
} from "lucide-react";
import { motion } from "framer-motion";

type DashboardModule = "trending" | "local" | "ai-picks" | "deep-dives" | "briefing";
type ThemeMode = "cool" | "warm" | "neutral" | "dark";
type DensityMode = "minimal" | "comfortable" | "information-rich";

const themeConfig: Record<ThemeMode, { bg: string; accent: string; card: string }> = {
  cool: { bg: "bg-blue-50/50 dark:bg-blue-950/20", accent: "text-blue-500", card: "border-blue-200/30 dark:border-blue-800/30" },
  warm: { bg: "bg-orange-50/50 dark:bg-orange-950/20", accent: "text-orange-500", card: "border-orange-200/30 dark:border-orange-800/30" },
  neutral: { bg: "bg-muted/30", accent: "text-primary", card: "border-border" },
  dark: { bg: "bg-slate-950/50", accent: "text-slate-300", card: "border-slate-700/30" },
};

const densityConfig: Record<DensityMode, { padding: string; gap: string; fontSize: string }> = {
  minimal: { padding: "p-3", gap: "gap-3", fontSize: "text-xs" },
  comfortable: { padding: "p-4", gap: "gap-4", fontSize: "text-sm" },
  "information-rich": { padding: "p-5", gap: "gap-5", fontSize: "text-sm" },
};

export function HyperPersonalizedDashboard() {
  const [theme, setTheme] = useState<ThemeMode>("neutral");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [fontSize, setFontSize] = useState(14);
  const [modules, setModules] = useState<DashboardModule[]>(["briefing", "trending", "local", "ai-picks", "deep-dives"]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load user preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-preferences");
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        if (prefs.theme) setTheme(prefs.theme);
        if (prefs.density) setDensity(prefs.density);
        if (prefs.fontSize) setFontSize(prefs.fontSize);
        if (prefs.modules) setModules(prefs.modules);
      } catch {
        // ignore
      }
    }
    setPreferencesLoaded(true);
  }, []);

  // Save preferences
  useEffect(() => {
    if (!preferencesLoaded) return;
    localStorage.setItem("dashboard-preferences", JSON.stringify({ theme, density, fontSize, modules }));
  }, [theme, density, fontSize, modules, preferencesLoaded]);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Fetch AI feed predictions
  const { data: aiPicks } = useQuery({
    queryKey: ["/api/ai/feed-predictions"],
    queryFn: async () => {
      const res = await fetch("/api/ai/feed-predictions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Fetch trends
  const { data: trends } = useQuery({
    queryKey: ["/api/trends"],
    queryFn: async () => {
      const res = await fetch("/api/trends");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const themeStyle = themeConfig[theme];
  const densityStyle = densityConfig[density];

  // Generate daily briefing
  const dailyBriefing = useMemo(() => {
    if (!dashboardData || dashboardData.length === 0) return null;
    const neighborhood = dashboardData[0];
    const snapshot = neighborhood?.snapshot;
    const recentCount = neighborhood?.recentTruths?.length || 0;
    const activeTruths = snapshot?.activeTruths || 0;

    const briefingParts: string[] = [];
    if (snapshot) {
      briefingParts.push(`Power: ${snapshot.powerStatus}`);
      briefingParts.push(`Fuel: ${snapshot.fuelStatus}`);
      briefingParts.push(`Traffic: ${snapshot.trafficLevel}`);
      briefingParts.push(`Safety: ${snapshot.safetyIndex}%`);
    }
    briefingParts.push(`${activeTruths} active reports`);
    briefingParts.push(`${recentCount} recent submissions`);

    return {
      neighborhood: neighborhood.neighborhood.name,
      region: neighborhood.neighborhood.region,
      summary: briefingParts.join(" • "),
      snapshot,
      recentCount,
    };
  }, [dashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className={`space-y-${density === "minimal" ? "3" : "4"} ${themeStyle.bg} rounded-lg transition-colors duration-300`} style={{ fontSize: `${fontSize}px` }}>
      {/* Personalization Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-2">
        <div className="flex items-center gap-1.5">
          <Layout className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Dashboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Theme selector */}
          <div className="flex items-center gap-1">
            {(["cool", "warm", "neutral", "dark"] as ThemeMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`h-5 w-5 rounded-full border-2 transition-all ${theme === t ? "border-primary scale-110" : "border-transparent"}`}
                style={{
                  background: t === "cool" ? "#3b82f6" : t === "warm" ? "#f97316" : t === "neutral" ? "#6b7280" : "#1e293b",
                }}
                title={`${t} theme`}
              />
            ))}
          </div>
          {/* Density selector */}
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as DensityMode)}
            className="h-7 text-[10px] rounded-md border border-border bg-background px-1"
          >
            <option value="minimal">Minimal</option>
            <option value="comfortable">Comfortable</option>
            <option value="information-rich">Info-rich</option>
          </select>
          {/* Font size */}
          <div className="flex items-center gap-1">
            <Type className="h-3 w-3 text-muted-foreground" />
            <input
              type="range"
              min={12}
              max={18}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-16 h-1"
            />
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${densityStyle.gap}`}>
        {/* Daily Briefing */}
        {modules.includes("briefing") && dailyBriefing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2"
          >
            <Card className={`${themeStyle.card} ${densityStyle.padding}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className={`h-4 w-4 ${themeStyle.accent}`} />
                  AI Daily Briefing
                  <Badge variant="outline" className="text-[8px] ml-1">Personalized</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className={`h-3.5 w-3.5 ${themeStyle.accent}`} />
                  <span className="text-xs font-medium">{dailyBriefing.neighborhood}, {dailyBriefing.region}</span>
                </div>
                <p className={`text-xs text-muted-foreground ${densityStyle.fontSize}`}>{dailyBriefing.summary}</p>
                {dailyBriefing.snapshot && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[
                      { label: "Power", value: dailyBriefing.snapshot.powerStatus },
                      { label: "Fuel", value: dailyBriefing.snapshot.fuelStatus },
                      { label: "Traffic", value: dailyBriefing.snapshot.trafficLevel },
                      { label: "Safety", value: `${dailyBriefing.snapshot.safetyIndex}%` },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <p className="text-[9px] text-muted-foreground">{item.label}</p>
                        <p className={`text-[10px] font-medium capitalize ${densityStyle.fontSize}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Trending */}
        {modules.includes("trending") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className={`${themeStyle.card} ${densityStyle.padding} h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className={`h-4 w-4 ${themeStyle.accent}`} />
                  Trending
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(trends as any[])?.slice(0, 5).map((trend, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-[10px] text-muted-foreground">{i + 1}.</span>
                    <span className="text-xs truncate flex-1">{trend.category || trend.label || "Trending topic"}</span>
                    <Badge variant="outline" className="text-[8px]">{trend.count || trend.score || "—"}</Badge>
                  </div>
                )) || <p className="text-xs text-muted-foreground">No trends data available</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Local */}
        {modules.includes("local") && dashboardData && dashboardData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className={`${themeStyle.card} ${densityStyle.padding} h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className={`h-4 w-4 ${themeStyle.accent}`} />
                  Local Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData[0]?.recentTruths?.slice(0, 5).map((truth: any, i: number) => (
                  <div key={i} className="py-1.5 border-b border-border/30 last:border-0">
                    <p className="text-xs truncate">{truth.content?.slice(0, 60)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-[8px]">{truth.category}</Badge>
                      <span className="text-[9px] text-muted-foreground">Trust: {truth.trustScore}%</span>
                    </div>
                  </div>
                )) || <p className="text-xs text-muted-foreground">No local reports yet</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* AI Picks */}
        {modules.includes("ai-picks") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className={`${themeStyle.card} ${densityStyle.padding} h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className={`h-4 w-4 ${themeStyle.accent}`} />
                  AI Picks
                  <Badge variant="outline" className="text-[8px]">For You</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(aiPicks as any[])?.slice(0, 5).map((pick, i) => (
                  <div key={i} className="py-1.5 border-b border-border/30 last:border-0">
                    <p className="text-xs truncate">{pick.title || pick.content?.slice(0, 60) || "AI recommendation"}</p>
                    {pick.reason && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">{pick.reason}</p>
                    )}
                  </div>
                )) || <p className="text-xs text-muted-foreground">AI picks will appear as you browse</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Deep Dives */}
        {modules.includes("deep-dives") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className={`${themeStyle.card} ${densityStyle.padding} h-full`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className={`h-4 w-4 ${themeStyle.accent}`} />
                  Deep Dives
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.[0]?.predictions?.slice(0, 3).map((pred: any, i: number) => (
                  <div key={i} className="py-1.5 border-b border-border/30 last:border-0">
                    <p className="text-xs truncate">{pred.prediction?.slice(0, 70)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-[8px]">{pred.category}</Badge>
                      <span className="text-[9px] text-muted-foreground">Confidence: {pred.confidence}%</span>
                    </div>
                  </div>
                )) || <p className="text-xs text-muted-foreground">No deep dives available</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
