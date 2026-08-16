"use client";

/**
 * Portfolio
 *
 * Personal portfolio for regular users: profile summary, optional details,
 * personal stats, recent truths, reward ledger, and gamification profile.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/use-user-safe";
import { apiRequest } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

import {
  User,
  Newspaper,
  Coins,
  Trophy,
  TrendingUp,
  Send,
  Award,
  Flame,
  Star,
  ShieldCheck,
  Clock,
  Briefcase,
  Globe,
  Phone,
  Twitter,
  Linkedin,
  Calendar,
  Save,
  Loader2,
} from "lucide-react";
import { UserAnalyticsCharts } from "@/components/user-analytics";
import { LocationPreferences } from "@/components/location-preferences";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string;
  truthsSubmitted?: number;
  verificationsMade?: number;
  rewardBalance?: number;
  trustScore?: number;
  currentStreak?: number;
  bio?: string | null;
  phone?: string | null;
  occupation?: string | null;
  website?: string | null;
  twitterHandle?: string | null;
  linkedinUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  profileCompleted?: boolean;
};

type Truth = {
  id: string | number;
  title?: string;
  content?: string;
  category?: string;
  status?: string;
  createdAt: string;
};

type RewardLedgerEntry = {
  id: string | number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

type GamificationProfile = {
  xp: number;
  level: number;
  nextLevelXp?: number;
  badges?: { id: string | number; name: string; description?: string; earned?: boolean }[];
  achievements?: { id: string | number; name: string; description?: string; progress?: number; completed?: boolean }[];
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const { data: truths, isLoading: truthsLoading } = useQuery<Truth[]>({
    queryKey: ["/api/truths?mine=true"],
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery<RewardLedgerEntry[]>({
    queryKey: ["/api/rewards/ledger"],
  });

  const { data: gamification, isLoading: gamificationLoading } = useQuery<GamificationProfile>({
    queryKey: ["/api/gamification/profile"],
  });

  const displayName =
    profile?.name || clerkUser?.fullName || clerkUser?.username || "Community Member";
  const email = profile?.email || clerkUser?.primaryEmailAddress?.emailAddress || "—";
  const memberSince = profile?.createdAt || clerkUser?.createdAt?.toString();
  const avatarUrl = clerkUser?.imageUrl;

  const isLoading = profileLoading || !clerkLoaded;

  const xpProgress =
    gamification && gamification.nextLevelXp
      ? Math.min(100, Math.round((gamification.xp / gamification.nextLevelXp) * 100))
      : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" data-testid="page-user-dashboard">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-700 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            My Portfolio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your contributions, rewards, and profile on 9jatruth
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" asChild data-testid="button-quick-submit">
            <Link href="/submit"><Send className="h-3.5 w-3.5" /> Submit Truth</Link>
          </Button>
          <Button size="sm" variant="outline" asChild data-testid="button-quick-feeds">
            <Link href="/feeds"><Newspaper className="h-3.5 w-3.5" /> View Feeds</Link>
          </Button>
          <Button size="sm" variant="outline" asChild data-testid="button-quick-rewards">
            <Link href="/rewards"><Coins className="h-3.5 w-3.5" /> Check Rewards</Link>
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <Card data-testid="card-profile">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-display font-700">{displayName}</h2>
                  {gamification?.level !== undefined && (
                    <Badge className="gap-0.5 bg-primary/15 text-primary hover:bg-primary/20">
                      <Star className="h-3 w-3" /> Level {gamification.level}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Member since {memberSince ? new Date(memberSince).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <LocationPreferences />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-user">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="truths" data-testid="tab-my-truths">My Truths</TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">Rewards</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* Overview */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4">
          {profileLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="grid-personal-stats">
              <StatBox icon={Send} color="text-blue-500" label="Truths Submitted" value={profile?.truthsSubmitted ?? 0} testId="stat-truths-submitted" />
              <StatBox icon={ShieldCheck} color="text-purple-500" label="Verifications" value={profile?.verificationsMade ?? 0} testId="stat-verifications" />
              <StatBox icon={Coins} color="text-amber-500" label="Reward Balance" value={profile?.rewardBalance ?? 0} testId="stat-reward-balance" />
              <StatBox icon={TrendingUp} color="text-green-500" label="Trust Score" value={profile?.trustScore ?? 0} testId="stat-trust-score" />
              <StatBox icon={Flame} color="text-orange-500" label="Current Streak" value={profile?.currentStreak ?? 0} suffix=" days" testId="stat-streak" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  Recent Truths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TruthList truths={truths?.slice(0, 5)} loading={truthsLoading} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  Reward Ledger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LedgerList ledger={ledger?.slice(0, 5)} loading={ledgerLoading} />
              </CardContent>
            </Card>
          </div>
          <UserAnalyticsCharts />
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Profile — optional user details */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="profile" className="space-y-4">
          <ProfileDetailsForm profile={profile} loading={profileLoading} />
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* My Truths */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="truths">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                All My Truths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TruthList truths={truths} loading={truthsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Rewards */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display font-700 tabular-nums" data-testid="text-reward-balance">
                {(profile?.rewardBalance ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">credits available</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <LedgerList ledger={ledger} loading={ledgerLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Achievements */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Gamification Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gamificationLoading ? (
                <Skeleton className="h-24" />
              ) : gamification ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Level {gamification.level} · {gamification.xp} XP
                      </span>
                      {gamification.nextLevelXp !== undefined && (
                        <span className="text-xs font-mono">{gamification.nextLevelXp} XP to next level</span>
                      )}
                    </div>
                    <Progress value={xpProgress} className="h-2" data-testid="progress-xp" />
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Badges</p>
                    {gamification.badges && gamification.badges.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="grid-badges">
                        {gamification.badges.map((badge) => (
                          <div
                            key={badge.id}
                            className={`rounded-md p-3 text-center ${
                              badge.earned ? "bg-primary/5 border border-primary/20" : "bg-muted/30 opacity-50"
                            }`}
                            data-testid={`badge-${badge.id}`}
                          >
                            <Award className={`h-5 w-5 mx-auto mb-1 ${badge.earned ? "text-amber-500" : "text-muted-foreground"}`} />
                            <p className="text-[10px] font-medium">{badge.name}</p>
                            {badge.description && (
                              <p className="text-[9px] text-muted-foreground mt-0.5">{badge.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No badges earned yet.</p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Achievements</p>
                    {Array.isArray(gamification.achievements) && gamification.achievements.length > 0 ? (
                      <div className="space-y-2" data-testid="list-achievements">
                        {gamification.achievements.map((ach) => (
                          <div key={ach.id} className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5">
                            <Trophy className={`h-4 w-4 shrink-0 ${ach.completed ? "text-amber-500" : "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{ach.name}</p>
                              {ach.description && (
                                <p className="text-[10px] text-muted-foreground">{ach.description}</p>
                              )}
                              {ach.progress !== undefined && !ach.completed && (
                                <Progress value={ach.progress} className="h-1 mt-1" />
                              )}
                            </div>
                            {ach.completed && (
                              <Badge className="text-[9px] bg-green-500/15 text-green-600 dark:text-green-400">
                                Done
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No achievements tracked yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Gamification data unavailable.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable subcomponents
// ---------------------------------------------------------------------------

function StatBox({
  icon: Icon,
  color,
  label,
  value,
  suffix = "",
  testId,
}: {
  icon: typeof Send;
  color: string;
  label: string;
  value: number;
  suffix?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
        </div>
        <p className="text-xl font-display font-700 tabular-nums mt-1">
          {value.toLocaleString()}
          {suffix}
        </p>
      </CardContent>
    </Card>
  );
}

function TruthList({ truths, loading }: { truths?: Truth[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (!truths || truths.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">You haven&apos;t submitted any truths yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="list-my-truths">
      {truths.map((t) => (
        <div key={t.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2.5" data-testid={`row-truth-${t.id}`}>
          <Newspaper className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed line-clamp-2">{t.title || t.content}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {t.category && <Badge variant="outline" className="text-[9px] capitalize">{t.category}</Badge>}
              {t.status && <Badge variant="secondary" className="text-[9px] capitalize">{t.status}</Badge>}
              <span className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerList({ ledger, loading }: { ledger?: RewardLedgerEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (!ledger || ledger.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No reward transactions yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="list-reward-ledger">
      {ledger.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2" data-testid={`row-ledger-${entry.id}`}>
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
              entry.amount > 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
            }`}
          >
            {entry.amount > 0 ? "+" : ""}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed">{entry.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[9px] capitalize">{entry.type}</Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          </div>
          <span className={`text-xs font-mono font-bold shrink-0 ${entry.amount > 0 ? "text-green-500" : "text-red-500"}`}>
            {entry.amount > 0 ? "+" : ""}
            {entry.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Details Form — optional user details
// ---------------------------------------------------------------------------

function ProfileDetailsForm({ profile, loading }: { profile?: UserProfile; loading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    phone: "",
    occupation: "",
    website: "",
    twitterHandle: "",
    linkedinUrl: "",
    dateOfBirth: "",
    gender: "",
    interests: "",
    skills: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.name || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        occupation: profile.occupation || "",
        website: profile.website || "",
        twitterHandle: profile.twitterHandle || "",
        linkedinUrl: profile.linkedinUrl || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split("T")[0] : "",
        gender: profile.gender || "",
        interests: Array.isArray(profile.interests) ? profile.interests.join(", ") : "",
        skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : "",
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PUT", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your details have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Could not save profile. Please try again.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const payload: Record<string, any> = {};
    if (formData.displayName) payload.displayName = formData.displayName;
    if (formData.bio) payload.bio = formData.bio;
    if (formData.phone) payload.phone = formData.phone;
    if (formData.occupation) payload.occupation = formData.occupation;
    if (formData.website) payload.website = formData.website;
    if (formData.twitterHandle) payload.twitterHandle = formData.twitterHandle;
    if (formData.linkedinUrl) payload.linkedinUrl = formData.linkedinUrl;
    if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
    if (formData.gender) payload.gender = formData.gender;
    if (formData.interests) payload.interests = formData.interests.split(",").map((s) => s.trim()).filter(Boolean);
    if (formData.skills) payload.skills = formData.skills.split(",").map((s) => s.trim()).filter(Boolean);
    updateMutation.mutate(payload);
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile Details
          </CardTitle>
          {profile?.profileCompleted && (
            <Badge className="text-[9px] gap-0.5 bg-green-500/15 text-green-600">
              <ShieldCheck className="h-2.5 w-2.5" /> Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          These fields are optional. Fill them in to help others in the community know you better.
        </p>

        {/* Display Name */}
        <div className="space-y-1.5">
          <Label htmlFor="displayName" className="text-xs flex items-center gap-1">
            <User className="h-3 w-3" /> Display Name
          </Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="Your name"
            className="h-9 text-sm"
          />
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <Label htmlFor="bio" className="text-xs">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Tell the community about yourself..."
            rows={3}
            className="resize-none text-sm"
          />
        </div>

        {/* Occupation */}
        <div className="space-y-1.5">
          <Label htmlFor="occupation" className="text-xs flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> Occupation
          </Label>
          <Input
            id="occupation"
            value={formData.occupation}
            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
            placeholder="e.g. Journalist, Engineer, Student"
            className="h-9 text-sm"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs flex items-center gap-1">
            <Phone className="h-3 w-3" /> Phone
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+234..."
            className="h-9 text-sm"
          />
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="website" className="text-xs flex items-center gap-1">
            <Globe className="h-3 w-3" /> Website
          </Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://..."
            className="h-9 text-sm"
          />
        </div>

        {/* Twitter & LinkedIn */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="twitterHandle" className="text-xs flex items-center gap-1">
              <Twitter className="h-3 w-3" /> Twitter Handle
            </Label>
            <Input
              id="twitterHandle"
              value={formData.twitterHandle}
              onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
              placeholder="@username"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl" className="text-xs flex items-center gap-1">
              <Linkedin className="h-3 w-3" /> LinkedIn URL
            </Label>
            <Input
              id="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Date of Birth & Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth" className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Date of Birth
            </Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-xs">Gender</Label>
            <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
              <SelectTrigger id="gender" className="h-9 text-sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Interests & Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="interests" className="text-xs">Interests (comma-separated)</Label>
            <Input
              id="interests"
              value={formData.interests}
              onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
              placeholder="e.g. Energy, Politics, Technology"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skills" className="text-xs">Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g. Photography, Data Analysis, Writing"
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2"
            data-testid="button-save-profile"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}