"use client";

/**
 * Gamification Card
 * 
 * Displays user's gamification profile: XP, level, streak,
 * achievements, and progress to next level.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Flame, Star, Zap, Award } from "lucide-react";

interface GamificationData {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalReports: number;
  totalVerifications: number;
  tier: string;
  levelProgress: { current: number; needed: number; percent: number };
  achievements: Array<{ id: number; achievement: string; tier: string; xpAwarded: number; createdAt: string }>;
  achievementDefs: ReadonlyArray<{ id: string; name: string; description: string; xp: number; tier: string }>;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-700 bg-amber-100 dark:bg-amber-900/30",
  silver: "text-gray-600 bg-gray-200 dark:bg-gray-800 dark:text-gray-300",
  gold: "text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30",
  platinum: "text-purple-700 bg-purple-100 dark:bg-purple-900/30",
};

export function GamificationCard() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gamification/profile")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const unlockedAchievements = new Set(data.achievements.map(a => a.achievement));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Your Progress</CardTitle>
        <Badge variant="outline" className="text-xs">{data.tier}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level + XP */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">Level {data.level}</div>
              <div className="text-xs text-muted-foreground">{data.xp.toLocaleString()} XP</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Next Level</div>
            <div className="text-sm font-medium">{data.levelProgress.current} / {data.levelProgress.needed}</div>
          </div>
        </div>
        <Progress value={data.levelProgress.percent} className="h-2" />

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <div className="text-lg font-bold">{data.totalReports}</div>
            <div className="text-xs text-muted-foreground">Reports</div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <div className="text-lg font-bold">{data.currentStreak}</div>
            <div className="text-xs text-muted-foreground">Day Streak</div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <Award className="h-4 w-4 text-blue-500" />
            <div className="text-lg font-bold">{data.totalVerifications}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
        </div>

        {/* Achievements */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-primary" />
            Achievements ({data.achievements.length}/{data.achievementDefs.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {data.achievementDefs.map(ach => {
              const unlocked = unlockedAchievements.has(ach.id);
              return (
                <Badge
                  key={ach.id}
                  variant={unlocked ? "default" : "outline"}
                  className={`text-xs ${unlocked ? TIER_COLORS[ach.tier] || "" : "opacity-40"}`}
                  title={ach.description}
                >
                  {ach.name}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
