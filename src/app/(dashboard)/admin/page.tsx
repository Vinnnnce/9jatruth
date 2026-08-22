"use client";

/**
 * Admin Super Dashboard — Rebuild
 *
 * Email-gated platform administration for the super admin
 * (9jatruthofficial@gmail.com). Combines powerful analytics (stat cards,
 * recharts bar/pie charts), geo-hierarchical filters, IP tracking tables
 * for users and posts/truths, an organizations overview, a recent activity
 * feed, and a system health tab.
 *
 * Data sources:
 *   - GET /api/user/profile   → super admin gate
 *   - GET /api/admin/stats    → platform stats + chart breakdowns
 *   - GET /api/admin/users    → all users with IP tracking
 *   - GET /api/admin/truths?region=&state=&lga=&community=&village= → all truths
 *   - GET /api/geo/hierarchy  → region/state/lga/community/village dropdowns
 *   - GET /api/organizations   → organizations overview
 *   - GET /api/activity?limit= → recent activity feed
 *   - GET /api/health          → system health
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminProfile, getDashboardType } from "@/lib/admin-auth-client";
import { NIGERIA_LGAS } from "@/lib/nigeria-locations";
import { useToast } from "@/components/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { AdminAnalytics } from "@/components/admin-analytics";
import { VerifiedBadge } from "@/components/verified-badge";
import { AdminSecurity } from "@/components/admin-security";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  ShieldCheck,
  Users,
  Building2,
  Newspaper,
  Coins,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Search,
  ShieldAlert,
  MapPin,
  Globe,
  Server,
  Cpu,
  Network,
  Zap,
  Loader2,
  Sparkles,
  MessageSquare,
  X,
  Package,
  Trash2,
  Plus,
  ClipboardList,
  Save,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  isOrgAdmin?: boolean;
  is_org_admin?: boolean;
  organizationId?: number | null;
};

type PlatformStats = {
  totalUsers: number;
  totalOrganizations: number;
  totalTruths: number;
  totalRewards: number;
  pendingOrganizations: number;
  totalMembers: number;
  openVacancies: number;
  truthsByState: { name: string; count: number }[];
  truthsByCategory: { name: string; count: number }[];
  truthsByLga: { name: string; count: number }[];
  truthsByCommunity: { name: string; count: number }[];
  truthsByRegion: { name: string; count: number }[];
};

type PlatformUser = {
  id: string | number;
  email: string;
  displayName?: string;
  role: string;
  lastIpHash?: string | null;
  lastIpRegion?: string | null;
  lastIpCity?: string | null;
  state?: string | null;
  lga?: string | null;
  community?: string | null;
  village?: string | null;
  region?: string | null;
  createdAt: string;
};

type AdminTruth = {
  id: number;
  neighborhoodName?: string;
  category: string;
  content: string;
  trustScore: number;
  status: string;
  createdAt: string;
  ipHash?: string | null;
  ipRegion?: string | null;
  ipCity?: string | null;
  locationSource?: string | null;
  stateName?: string | null;
  lgaName?: string | null;
  communityName?: string | null;
  villageName?: string | null;
  regionName?: string | null;
  userHash: string;
};

type GeoHierarchy = {
  regions: string[];
  states: string[];
  lgas: string[];
  communities: string[];
  villages: string[];
};

type Organization = {
  id: number | string;
  name: string;
  type?: string;
  verified?: boolean | number;
  active?: boolean | number;
  region?: string;
  city?: string;
  contactEmail?: string;
  description?: string | null;
  createdAt?: string;
};

type ActivityEntry = {
  id: string | number;
  description: string;
  category?: string;
  type?: string;
  timestamp: string;
  userHash?: string;
  neighborhood?: string;
  region?: string;
};

type HealthService = {
  name: string;
  status: string;
  latency?: string;
  uptime?: string;
};

type SystemHealth = {
  status: string;
  services?: HealthService[];
  mesh?: { nodes: number; activeConnections: number; bundlesSynced: number; lastSync: string };
  anomalies?: { type: string; severity: string; description: string; detectedAt: string }[];
  stats?: { totalTruths: number; totalNeighborhoods: number; activeDevices: number };
};

type RewardRedemption = {
  id: number;
  userHash: string;
  rewardType: string;
  rewardCategory: string;
  amount: number;
  status: string;
  description?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  networkProvider?: string | null;
  giftCardCode?: string | null;
  voucherCode?: string | null;
  voucherStoreName?: string | null;
  adminNotes?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

type RewardRedemptionsResponse = {
  redemptions: RewardRedemption[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
    denied: number;
    totalFulfilledAmount: number;
  };
  limit: number;
  offset: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

const ROLE_OPTIONS = ["user", "admin", "org_admin"];

const REWARD_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "fulfilled", label: "Fulfilled" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" | "destructive" {
  if (role === "admin") return "destructive";
  if (role === "org_admin") return "default";
  return "secondary";
}

function statusBadgeClass(status: string): string {
  if (status === "active" || status === "healthy" || status === "operational")
    return "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20";
  if (status === "suspended" || status === "degraded" || status === "down")
    return "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/20";
  return "bg-muted text-muted-foreground";
}

function rewardStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "fulfilled") return "default";
  if (status === "approved") return "secondary";
  if (status === "denied") return "destructive";
  return "outline";
}

function shortHash(hash?: string | null): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 8)}…` : hash;
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function buildTruthsQuery(filters: GeoFilters): string {
  const params = new URLSearchParams();
  if (filters.region) params.set("region", filters.region);
  if (filters.state) params.set("state", filters.state);
  if (filters.lga) params.set("lga", filters.lga);
  if (filters.community) params.set("community", filters.community);
  if (filters.village) params.set("village", filters.village);
  const qs = params.toString();
  return qs ? `/api/admin/truths?${qs}` : "/api/admin/truths";
}

// ---------------------------------------------------------------------------
// Geo filter state
// ---------------------------------------------------------------------------

type GeoFilters = {
  region: string;
  state: string;
  lga: string;
  community: string;
  village: string;
};

const EMPTY_FILTERS: GeoFilters = {
  region: "",
  state: "",
  lga: "",
  community: "",
  village: "",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [truthSearch, setTruthSearch] = useState("");
  const [geoFilters, setGeoFilters] = useState<GeoFilters>(EMPTY_FILTERS);
  const [rewardStatusFilter, setRewardStatusFilter] = useState<string>("all");

  // Profile — super admin gate
  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    retry: 1,
  });

  const isSuperAdmin = isSuperAdminProfile(profile);
  const dashboardType = getDashboardType(profile);

  // Geo hierarchy for dropdowns
  const { data: geo, isLoading: geoLoading, isError: geoError } = useQuery<GeoHierarchy>({
    queryKey: ["/api/geo/hierarchy"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // Platform stats + chart breakdowns
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // All users with IP tracking
  const { data: users, isLoading: usersLoading, isError: usersError } = useQuery<PlatformUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // All truths with IP tracking + geo filters (cascading)
  const truthsQueryKey = buildTruthsQuery(geoFilters);
  const { data: truths, isLoading: truthsLoading, isError: truthsError } = useQuery<AdminTruth[]>({
    queryKey: [truthsQueryKey],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // Organizations overview
  const { data: organizations, isLoading: orgsLoading, isError: orgsError } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // Recent activity
  const { data: activity, isLoading: activityLoading, isError: activityError } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity?limit=20"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // System health
  const { data: health, isLoading: healthLoading, isError: healthError } = useQuery<SystemHealth>({
    queryKey: ["/api/health"],
    enabled: isSuperAdmin,
    retry: 1,
  });

  // User role/status mutation (preserved from prior dashboard)
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<PlatformUser> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated", description: "The user record was updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete truth/post from admin
  const deleteTruthMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/truths/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/truths"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Post deleted", description: "The truth post has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete news article from admin
  const deleteNewsMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/news/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({ title: "Article deleted", description: "The news article has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete poll from admin
  const deletePollMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/polls/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Poll deleted", description: "The poll has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete questionnaire from admin
  const deleteQuestionnaireMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/questionnaire/manage/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire/manage"] });
      toast({ title: "Questionnaire deleted", description: "The questionnaire has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Reward redemptions list (filtered by status)
  const rewardsQueryKey = useMemo(() => {
    const params = new URLSearchParams();
    if (rewardStatusFilter && rewardStatusFilter !== "all") {
      params.set("status", rewardStatusFilter);
    }
    const qs = params.toString();
    return qs ? `/api/admin/rewards?${qs}` : "/api/admin/rewards";
  }, [rewardStatusFilter]);

  const {
    data: rewardsData,
    isLoading: rewardsLoading,
    isError: rewardsError,
  } = useQuery<RewardRedemptionsResponse>({
    queryKey: [rewardsQueryKey],
    enabled: isSuperAdmin,
    retry: 1,
  });

  const redemptions = rewardsData?.redemptions ?? [];

  // Reward redemption status mutation (approve/deny/fulfill/revert to pending)
  const updateRedemptionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: "pending" | "approved" | "denied" | "fulfilled";
    }) => {
      const res = await apiRequest("PUT", `/api/admin/rewards/${id}`, { status });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rewards"] });
      toast({
        title: `Redemption ${vars.status}`,
        description: `Redemption #${vars.id} has been ${vars.status}.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // -----------------------------------------------------------------------
  // Derived / filtered data
  // -----------------------------------------------------------------------

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (!q) return true;
      return (
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.lastIpHash?.toLowerCase().includes(q) ||
        u.lastIpRegion?.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  const filteredTruths = useMemo(() => {
    const q = truthSearch.trim().toLowerCase();
    return (truths ?? []).filter((t) => {
      if (!q) return true;
      return (
        t.content?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.ipHash?.toLowerCase().includes(q) ||
        t.userHash?.toLowerCase().includes(q)
      );
    });
  }, [truths, truthSearch]);

  // Chart data (top-N for readability)
  const truthsByStateData = useMemo(
    () => (stats?.truthsByState ?? []).slice(0, 12),
    [stats],
  );
  const truthsByCategoryData = useMemo(
    () => (stats?.truthsByCategory ?? []).slice(0, 12),
    [stats],
  );
  const truthsByRegionData = useMemo(
    () => (stats?.truthsByRegion ?? []).slice(0, 8),
    [stats],
  );

  // -----------------------------------------------------------------------
  // Geo filter handlers (cascade: clearing a parent clears children)
  // -----------------------------------------------------------------------

  function setGeoField(field: keyof GeoFilters, value: string) {
    setGeoFilters((prev) => {
      const next = { ...prev, [field]: value };
      // Cascade clears — selecting a parent resets downstream children
      if (field === "region") {
        next.state = "";
        next.lga = "";
        next.community = "";
        next.village = "";
      } else if (field === "state") {
        next.lga = "";
        next.community = "";
        next.village = "";
      } else if (field === "lga") {
        next.community = "";
        next.village = "";
      } else if (field === "community") {
        next.village = "";
      }
      return next;
    });
  }

  function resetGeoFilters() {
    setGeoFilters(EMPTY_FILTERS);
  }

  const hasGeoFilters = Boolean(
    geoFilters.region || geoFilters.state || geoFilters.lga || geoFilters.community || geoFilters.village,
  );

  // -----------------------------------------------------------------------
  // Access control
  // -----------------------------------------------------------------------

  if (profileLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isSuperAdmin || dashboardType !== "admin") {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="border-destructive/30 w-full" data-testid="card-access-denied">
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-display font-700">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              This dashboard is restricted to the designated super admin
              (9jatruthofficial@gmail.com). If you believe this is a mistake, contact
              your platform administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (profileError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl p-6 space-y-3 bg-card border border-red-500/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium">Failed to load admin profile</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Could not verify admin access. Please refresh the page or try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" data-testid="page-admin-dashboard">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-700 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Admin Super Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform-wide analytics, IP tracking, geo insights, and system health
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1 w-fit">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Super Admin
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-admin" className="flex flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            Users
          </TabsTrigger>
          <TabsTrigger value="posts" data-testid="tab-posts">
            Posts
          </TabsTrigger>
          <TabsTrigger value="organizations" data-testid="tab-organizations">
            Organizations
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            System Health
          </TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">
            Rewards & Credits
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            Settings
          </TabsTrigger>
          <TabsTrigger value="weekly-review" data-testid="tab-weekly-review">
            Weekly Review
          </TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            Feedback & Questionnaires
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            Security
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------------------- */}
        {/* Overview — stat cards + charts + activity feed                  */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-6">
          {statsError ? (
            <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Failed to load platform stats</p>
                <p className="text-xs text-muted-foreground">The admin stats API may be unavailable. Other tabs may still work.</p>
              </div>
            </div>
          ) : null}
          {/* Stat cards */}
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="grid-stats-cards">
              <StatCard
                icon={Users}
                iconColor="text-blue-500"
                label="Total Users"
                value={stats?.totalUsers ?? 0}
                testId="stat-total-users"
              />
              <StatCard
                icon={Newspaper}
                iconColor="text-amber-500"
                label="Total Truths"
                value={stats?.totalTruths ?? 0}
                testId="stat-total-truths"
              />
              <StatCard
                icon={Building2}
                iconColor="text-purple-500"
                label="Organizations"
                value={stats?.totalOrganizations ?? 0}
                testId="stat-total-orgs"
              />
              <StatCard
                icon={Coins}
                iconColor="text-green-500"
                label="Rewards Distributed"
                value={stats?.totalRewards ?? 0}
                testId="stat-total-rewards"
              />
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Truths by State — Bar chart */}
            <Card data-testid="chart-truths-by-state">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Truths by State
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-64" />
                ) : truthsByStateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={truthsByStateData} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(99,102,241,0.08)" }}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={MapPin} message="No state breakdown data yet." />
                )}
              </CardContent>
            </Card>

            {/* Truths by Category — Bar chart */}
            <Card data-testid="chart-truths-by-category">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  Truths by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-64" />
                ) : truthsByCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={truthsByCategoryData}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        width={90}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(16,185,129,0.08)" }}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={Newspaper} message="No category breakdown data yet." />
                )}
              </CardContent>
            </Card>

            {/* Truths by Region — Pie chart */}
            <Card data-testid="chart-truths-by-region">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Truths by Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-64" />
                ) : truthsByRegionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={truthsByRegionData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={40}
                        paddingAngle={2}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        style={{ fontSize: 10 }}
                      >
                        {truthsByRegionData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={Globe} message="No region breakdown data yet." />
                )}
              </CardContent>
            </Card>

            {/* Secondary stats mini-cards */}
            <Card data-testid="card-secondary-stats">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Platform Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  [...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)
                ) : (
                  <>
                    <SecondaryStat label="Pending Organizations" value={stats?.pendingOrganizations ?? 0} />
                    <SecondaryStat label="Total Members" value={stats?.totalMembers ?? 0} />
                    <SecondaryStat label="Open Vacancies" value={stats?.openVacancies ?? 0} />
                    <SecondaryStat
                      label="Avg Truths / User"
                      value={
                        stats && stats.totalUsers > 0
                          ? (stats.totalTruths / stats.totalUsers).toFixed(1)
                          : "0"
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent activity feed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-2" data-testid="list-recent-activity">
                  {activity.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 rounded-md bg-muted/30 p-2"
                      data-testid={`row-activity-${entry.id}`}
                    >
                      <Newspaper className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed line-clamp-2">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {entry.category && (
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {entry.category}
                            </Badge>
                          )}
                          {entry.region && (
                            <Badge variant="outline" className="text-[9px] gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {entry.region}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Newspaper} message="No recent activity yet." />
              )}
            </CardContent>
          </Card>

          {/* Extended Analytics */}
          <AdminAnalytics />
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Users — IP tracking table                                       */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="users" className="space-y-4">
          {usersError ? (
            <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Failed to load users</p>
                <p className="text-xs text-muted-foreground">The admin users API may be unavailable.</p>
              </div>
            </div>
          ) : null}
          <Card>
            <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Platform Users — IP Tracking
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Search name, email, IP hash, region..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-users">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>IP Hash</TableHead>
                        <TableHead>IP Region</TableHead>
                        <TableHead>IP City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>LGA</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {(u.displayName || u.email || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate">{u.displayName || "—"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-[10px] text-muted-foreground font-mono">
                              {shortHash(u.lastIpHash)}
                            </code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.lastIpRegion || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.lastIpCity || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.state || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.lga || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.community || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(value) =>
                                updateUserMutation.mutate({ id: u.id, data: { role: value } })
                              }
                            >
                              <SelectTrigger
                                className="h-7 w-28 text-xs"
                                data-testid={`select-role-${u.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((role) => (
                                  <SelectItem key={role} value={role} className="text-xs">
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(u.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Users} message="No users found." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Posts / Truths — IP tracking + geo filters                     */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="posts" className="space-y-4">
          {truthsError ? (
            <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Failed to load truths</p>
                <p className="text-xs text-muted-foreground">The admin truths API may be unavailable.</p>
              </div>
            </div>
          ) : null}
          {/* Geo-hierarchical filters */}
          <Card data-testid="card-geo-filters">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Geo-Hierarchical Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              {geoLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <GeoFilter
                    label="Region"
                    value={geoFilters.region}
                    options={geo?.regions ?? []}
                    onChange={(v) => setGeoField("region", v)}
                    testId="select-region"
                  />
                  <GeoFilter
                    label="State"
                    value={geoFilters.state}
                    options={geo?.states ?? []}
                    onChange={(v) => setGeoField("state", v)}
                    testId="select-state"
                  />
                  <GeoFilter
                    label="LGA"
                    value={geoFilters.lga}
                    options={
                      geoFilters.state
                        ? NIGERIA_LGAS[geoFilters.state] ?? []
                        : geo?.lgas ?? []
                    }
                    onChange={(v) => setGeoField("lga", v)}
                    testId="select-lga"
                  />
                  <GeoFilter
                    label="Community"
                    value={geoFilters.community}
                    options={geo?.communities ?? []}
                    onChange={(v) => setGeoField("community", v)}
                    testId="select-community"
                  />
                  <GeoFilter
                    label="Village"
                    value={geoFilters.village}
                    options={geo?.villages ?? []}
                    onChange={(v) => setGeoField("village", v)}
                    testId="select-village"
                  />
                </div>
              )}
              {hasGeoFilters && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={resetGeoFilters}
                    data-testid="button-reset-filters"
                  >
                    Clear Filters
                  </Button>
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredTruths.length} truths match
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Truths IP tracking table */}
          <Card>
            <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                Posts / Truths — IP Tracking
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Search content, category, IP hash..."
                  value={truthSearch}
                  onChange={(e) => setTruthSearch(e.target.value)}
                  data-testid="input-search-truths"
                />
              </div>
            </CardHeader>
            <CardContent>
              {truthsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredTruths.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-truths">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Content</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>IP Hash</TableHead>
                        <TableHead>IP Region</TableHead>
                        <TableHead>IP City</TableHead>
                        <TableHead>Loc Source</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>LGA</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Trust</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTruths.map((t) => (
                        <TableRow key={t.id} data-testid={`row-truth-${t.id}`}>
                          <TableCell className="text-xs max-w-[220px]">
                            <p className="line-clamp-2">{t.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              user: {shortHash(t.userHash)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {t.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-[10px] text-muted-foreground font-mono">
                              {shortHash(t.ipHash)}
                            </code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.ipRegion || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.ipCity || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.locationSource || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.regionName || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.stateName || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.lgaName || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.communityName || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                t.trustScore >= 70
                                  ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                  : t.trustScore >= 40
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {t.trustScore}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[9px] ${statusBadgeClass(t.status)}`}>
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {timeAgo(t.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                              disabled={deleteTruthMutation.isPending && deleteTruthMutation.variables === t.id}
                              onClick={() => {
                                if (confirm(`Delete this truth post?\n\n"${t.content.slice(0, 80)}..."\n\nThis cannot be undone.`)) {
                                  deleteTruthMutation.mutate(t.id);
                                }
                              }}
                              data-testid={`button-delete-truth-${t.id}`}
                            >
                              {deleteTruthMutation.isPending && deleteTruthMutation.variables === t.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Newspaper}
                  message={hasGeoFilters ? "No truths match the selected filters." : "No truths found."}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Organizations                                                    */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="organizations" className="space-y-4">
          {orgsError ? (
            <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Failed to load organizations</p>
                <p className="text-xs text-muted-foreground">The organizations API may be unavailable.</p>
              </div>
            </div>
          ) : null}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Organizations Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : organizations && organizations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-organizations">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.map((org) => {
                        const verified = Boolean(org.verified);
                        const active = org.active === undefined ? true : Boolean(org.active);
                        return (
                          <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                            <TableCell className="font-medium">
                            <div className="flex items-center gap-1">
                              {org.name}
                              {verified && <VerifiedBadge />}
                            </div>
                          </TableCell>
                            <TableCell className="text-xs capitalize">{org.type ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {org.city ? `${org.city}${org.region ? `, ${org.region}` : ""}` : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {org.contactEmail || "—"}
                            </TableCell>
                            <TableCell>
                              {verified ? (
                                <Badge className="text-[9px] gap-0.5 bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-amber-500">
                                  <AlertCircle className="h-2.5 w-2.5" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={active ? "secondary" : "outline"} className="text-[9px]">
                                {active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Building2} message="No organizations registered yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* System Health                                                    */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="health" className="space-y-4">
          {healthError ? (
            <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Failed to load system health</p>
                <p className="text-xs text-muted-foreground">The health API may be unavailable.</p>
              </div>
            </div>
          ) : null}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                System Health Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <Skeleton className="h-32" />
              ) : health ? (
                <div className="space-y-4" data-testid="section-system-health">
                  <div className="flex items-center gap-2">
                    {health.status === "ok" ||
                    health.status === "healthy" ||
                    health.status === "operational" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-sm font-medium capitalize">{health.status}</span>
                  </div>

                  {/* Services */}
                  {health.services && health.services.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {health.services.map((svc) => (
                        <div
                          key={svc.name}
                          className="flex items-center justify-between rounded-md bg-muted/30 p-2.5"
                          data-testid={`row-service-${svc.name}`}
                        >
                          <div className="flex items-center gap-2">
                            <ServiceIcon name={svc.name} />
                            <div>
                              <span className="text-xs font-medium">{svc.name}</span>
                              {svc.latency && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  · {svc.latency}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className={`text-[9px] ${statusBadgeClass(svc.status)}`}>
                            {svc.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mesh + stats */}
                  {health.mesh && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MiniStat icon={Network} label="Mesh Nodes" value={health.mesh.nodes} />
                      <MiniStat
                        icon={Activity}
                        label="Active Connections"
                        value={health.mesh.activeConnections}
                      />
                      <MiniStat
                        icon={Zap}
                        label="Bundles Synced"
                        value={health.mesh.bundlesSynced}
                      />
                      <MiniStat icon={Server} label="Last Sync" value={health.mesh.lastSync} isText />
                    </div>
                  )}

                  {/* Anomalies */}
                  {health.anomalies && health.anomalies.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Anomalies</p>
                      {health.anomalies.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-md bg-muted/30 p-2"
                          data-testid={`row-anomaly-${i}`}
                        >
                          <AlertCircle
                            className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                              a.severity === "warning"
                                ? "text-amber-500"
                                : a.severity === "critical"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          />
                          <div>
                            <p className="text-xs">{a.description}</p>
                            <p className="text-[10px] text-muted-foreground">{timeAgo(a.detectedAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stat counts */}
                  {health.stats && (
                    <div className="grid grid-cols-3 gap-3">
                      <MiniStat icon={Newspaper} label="Truths" value={health.stats.totalTruths} />
                      <MiniStat
                        icon={MapPin}
                        label="Neighborhoods"
                        value={health.stats.totalNeighborhoods}
                      />
                      <MiniStat icon={Cpu} label="Active Devices" value={health.stats.activeDevices} />
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState icon={Activity} message="System health data is currently unavailable." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Rewards & Credits                                              */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="rewards" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-display">Reward & Credit Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Total Credits Issued</p>
                  <p className="text-lg font-bold tabular-nums">{stats?.totalRewards ?? 0}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Active Users</p>
                  <p className="text-lg font-bold tabular-nums">{stats?.totalUsers ?? 0}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Total Truths</p>
                  <p className="text-lg font-bold tabular-nums">{stats?.totalTruths ? Math.round(stats.totalTruths) : 0}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">Total Rewards</p>
                  <p className="text-lg font-bold tabular-nums">{stats?.totalRewards ? Math.round(stats.totalRewards) : 0}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Credit Rules</p>
                  <Badge variant="outline" className="text-[9px] gap-0.5">
                    <Sparkles className="h-2.5 w-2.5 text-purple-500" /> AI-Optimized
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Truth submission</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={20} className="h-6 w-16 text-xs" />
                      <Badge variant="secondary">credits</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Corroboration received</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={10} className="h-6 w-16 text-xs" />
                      <Badge variant="secondary">credits</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Verified by AI as authentic</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={15} className="h-6 w-16 text-xs" />
                      <Badge variant="secondary">credits</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Daily streak bonus</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={5} className="h-6 w-16 text-xs" />
                      <Badge variant="secondary">credits</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Disputed truth penalty</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={-10} className="h-6 w-16 text-xs" />
                      <Badge variant="destructive">credits</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Save className="h-3 w-3" /> Save Rules
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Sparkles className="h-3 w-3 text-purple-500" /> AI Optimize
                  </Button>
                </div>
              </div>

              {/* AI Rewards Insights */}
              <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-purple-500 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI Rewards Insights
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="text-[10px]">
                    <p className="font-medium text-foreground">Top Earners</p>
                    <p className="text-muted-foreground">AI identifies most active contributors for targeted bonus rewards.</p>
                  </div>
                  <div className="text-[10px]">
                    <p className="font-medium text-foreground">Fraud Detection</p>
                    <p className="text-muted-foreground">AI flags suspicious credit accumulation patterns for review.</p>
                  </div>
                  <div className="text-[10px]">
                    <p className="font-medium text-foreground">Reward Trends</p>
                    <p className="text-muted-foreground">AI analyzes redemption patterns to optimize reward offerings.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reward Redemption Management */}
          <Card className="border-border">
            <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Reward Redemptions
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {rewardsData?.stats.total ?? redemptions.length} total
                </Badge>
                <div className="w-40">
                  <Select
                    value={rewardStatusFilter}
                    onValueChange={(value) => setRewardStatusFilter(value)}
                  >
                    <SelectTrigger
                      className="h-8 text-xs"
                      data-testid="select-reward-status"
                    >
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      {REWARD_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rewardsError ? (
                <div className="rounded-xl p-4 bg-card border border-red-500/30 flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Failed to load redemptions</p>
                    <p className="text-xs text-muted-foreground">The admin rewards API may be unavailable.</p>
                  </div>
                </div>
              ) : rewardsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : redemptions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-redemptions">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redemptions.map((r) => {
                        const isPending = r.status === "pending";
                        const mutating =
                          updateRedemptionMutation.isPending &&
                          updateRedemptionMutation.variables?.id === r.id;
                        return (
                          <TableRow key={r.id} data-testid={`row-redemption-${r.id}`}>
                            <TableCell className="font-medium">
                              <code className="text-[10px] text-muted-foreground font-mono">
                                {shortHash(r.userHash)}
                              </code>
                            </TableCell>
                            <TableCell className="text-xs capitalize">
                              {r.rewardType || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.rewardCategory || "—"}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {r.amount ?? 0}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={rewardStatusBadgeVariant(r.status)}
                                className="text-[9px] capitalize"
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[16rem]">
                              <span className="line-clamp-2">{r.description || "—"}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {fmtDate(r.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={mutating}
                                    onClick={() =>
                                      updateRedemptionMutation.mutate({
                                        id: r.id,
                                        status: "approved",
                                      })
                                    }
                                    data-testid={`button-approve-${r.id}`}
                                  >
                                    {mutating &&
                                    updateRedemptionMutation.variables?.status ===
                                      "approved" ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={mutating}
                                    onClick={() =>
                                      updateRedemptionMutation.mutate({
                                        id: r.id,
                                        status: "denied",
                                      })
                                    }
                                    data-testid={`button-deny-${r.id}`}
                                  >
                                    {mutating &&
                                    updateRedemptionMutation.variables?.status ===
                                      "denied" ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3 w-3" />
                                    )}
                                    Deny
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={mutating}
                                    onClick={() =>
                                      updateRedemptionMutation.mutate({
                                        id: r.id,
                                        status: "fulfilled",
                                      })
                                    }
                                    data-testid={`button-fulfill-${r.id}`}
                                  >
                                    {mutating &&
                                    updateRedemptionMutation.variables?.status ===
                                      "fulfilled" ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Package className="h-3 w-3" />
                                    )}
                                    Fulfill
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <Select
                                    value={r.status}
                                    onValueChange={(value) =>
                                      updateRedemptionMutation.mutate({
                                        id: r.id,
                                        status: value as "pending" | "approved" | "denied" | "fulfilled",
                                      })
                                    }
                                  >
                                    <SelectTrigger
                                      className="h-7 w-28 text-xs"
                                      data-testid={`select-reward-status-${r.id}`}
                                      disabled={mutating}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                                      <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                                      <SelectItem value="denied" className="text-xs">Denied</SelectItem>
                                      <SelectItem value="fulfilled" className="text-xs">Fulfilled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {mutating && <Loader2 className="h-3 w-3 animate-spin" />}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Coins} message="No reward redemptions found." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Settings                                                       */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-display">System Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium">Platform Configuration</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Trust score decay rate</span>
                    <span className="font-mono">0.95 / day</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Min report length</span>
                    <span className="font-mono">15 chars</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Max report length</span>
                    <span className="font-mono">500 chars</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">Feed page size</span>
                    <span className="font-mono">50 items</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">AI verification</span>
                    <Badge variant="secondary" className="text-[9px]">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">PWA install</span>
                    <Badge variant="secondary" className="text-[9px]">Enabled</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Admin Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    Export User Data
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    Clear Cache
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    Run AI Verification Sweep
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Weekly Review — AI-powered user activity summaries             */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="weekly-review" className="space-y-4">
          <WeeklyReviewTab />
        </TabsContent>

        {/* --------------------------------------------------------------- */}
        {/* Feedback & Questionnaires                                       */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="feedback" className="space-y-4">
          <FeedbackTab />
        </TabsContent>
        <TabsContent value="security" className="space-y-4">
          <AdminSecurity />
        </TabsContent>
      </Tabs>
    </div>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  testId,
}: {
  icon: typeof Users;
  iconColor: string;
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
        </div>
        <p className="text-xl font-display font-700 tabular-nums mt-1">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  );
}

function SecondaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-display font-700 tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  isText,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-primary" />
        <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      </div>
      <p className="text-sm font-display font-700 tabular-nums mt-0.5">
        {isText ? value : typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function GeoFilter({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground uppercase">{label}</label>
      <Select
        value={value || "__all__"}
        onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
      >
        <SelectTrigger className="h-9 text-xs" data-testid={testId}>
          <SelectValue placeholder={`All ${label.toLowerCase()}s`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__" className="text-xs">
            All {label.toLowerCase()}s
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ServiceIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("geo") || lower.includes("location")) return <Globe className="h-3.5 w-3.5 text-primary" />;
  if (lower.includes("reward")) return <Coins className="h-3.5 w-3.5 text-primary" />;
  if (lower.includes("notif")) return <Zap className="h-3.5 w-3.5 text-primary" />;
  if (lower.includes("ai") || lower.includes("ml") || lower.includes("pipeline")) return <Cpu className="h-3.5 w-3.5 text-primary" />;
  if (lower.includes("mesh") || lower.includes("network") || lower.includes("sync")) return <Network className="h-3.5 w-3.5 text-primary" />;
  if (lower.includes("gateway") || lower.includes("api")) return <Server className="h-3.5 w-3.5 text-primary" />;
  return <Activity className="h-3.5 w-3.5 text-primary" />;
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly Review Tab — AI-powered user activity summaries
// ---------------------------------------------------------------------------

type WeeklyReview = {
  id: number;
  weekStart: string;
  weekEnd: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  metrics: {
    browsingEvents: number;
    categoriesViewed: number;
    neighborhoodsViewed: number;
    truthsSubmitted: number;
    verifications: number;
    likes: number;
    topCategories: { category: string; count: number }[];
  };
  summary: string;
  recommendations: string[];
  riskFlags: string[];
  aiSummary: string | null;
  modelVersion: string;
  generatedAt: string;
};

function WeeklyReviewTab() {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/admin/weekly-review");
      const data = await res.json();
      setReviews(data.reviews || []);
      setWeekStart(data.weekStart);
      setWeekEnd(data.weekEnd);
    } catch {
      toast({ title: "Failed to load weekly reviews", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/admin/weekly-review/generate", {});
      const data = await res.json();
      toast({ title: `Generated ${data.generated} weekly reviews` });
      fetchReviews();
    } catch {
      toast({ title: "Failed to generate reviews", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Aggregate stats
  const totalBrowsing = reviews.reduce((s, r) => s + (r.metrics?.browsingEvents ?? 0), 0);
  const totalTruths = reviews.reduce((s, r) => s + (r.metrics?.truthsSubmitted ?? 0), 0);
  const totalVerifications = reviews.reduce((s, r) => s + (r.metrics?.verifications ?? 0), 0);
  const totalLikes = reviews.reduce((s, r) => s + (r.metrics?.likes ?? 0), 0);
  const inactiveUsers = reviews.filter(r => r.riskFlags?.includes("inactive")).length;
  const topContributors = reviews.filter(r => r.riskFlags?.includes("high_contributor")).length;

  return (
    <div className="space-y-6">
      {/* Header + Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-700">Weekly User Review</h3>
          {weekStart && weekEnd && (
            <p className="text-xs text-muted-foreground">
              {weekStart} to {weekEnd}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs gap-1.5"
          data-testid="btn-generate-reviews"
        >
          {generating ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="h-3 w-3" /> Generate Weekly Review</>
          )}
        </Button>
      </div>

      {/* Aggregate stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} iconColor="text-blue-500" label="Total Users" value={reviews.length} testId="stat-weekly-users" />
        <StatCard icon={Activity} iconColor="text-green-500" label="Browsing Events" value={totalBrowsing} testId="stat-weekly-browsing" />
        <StatCard icon={Newspaper} iconColor="text-amber-500" label="Truths Submitted" value={totalTruths} testId="stat-weekly-truths" />
        <StatCard icon={TrendingUp} iconColor="text-purple-500" label="Top Contributors" value={topContributors} testId="stat-weekly-contributors" />
      </div>

      {/* Secondary stats */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-2">
          <SecondaryStat label="Total Verifications" value={totalVerifications} />
          <SecondaryStat label="Total Likes" value={totalLikes} />
          <SecondaryStat label="Inactive Users" value={inactiveUsers} />
        </CardContent>
      </Card>

      {/* User reviews table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState icon={Users} message="No weekly reviews yet. Click 'Generate Weekly Review' to create AI-powered summaries." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review, idx) => (
            <Card key={review.id || idx} className="border-border">
              <CardContent className="p-4 space-y-3">
                {/* User header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {(review.displayName || review.email || "U")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-medium">{review.displayName || review.email}</p>
                      <p className="text-[10px] text-muted-foreground">{review.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {review.riskFlags?.map((flag) => (
                      <Badge
                        key={flag}
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          flag === "inactive" ? "border-red-500/30 text-red-500" :
                          flag === "high_contributor" ? "border-green-500/30 text-green-500" :
                          flag === "active_verifier" ? "border-blue-500/30 text-blue-500" :
                          "border-amber-500/30 text-amber-500"
                        }`}
                      >
                        {flag.replace(/_/g, " ")}
                      </Badge>
                    ))}
                    {review.modelVersion?.startsWith("kimi") && (
                      <Badge className="text-[8px] px-1 py-0 bg-indigo-500/10 text-indigo-500 border-none">
                        Kimi K3 AI
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                  <ReviewStat label="Events" value={review.metrics?.browsingEvents ?? 0} />
                  <ReviewStat label="Truths" value={review.metrics?.truthsSubmitted ?? 0} />
                  <ReviewStat label="Verifs" value={review.metrics?.verifications ?? 0} />
                  <ReviewStat label="Likes" value={review.metrics?.likes ?? 0} />
                  <ReviewStat label="Cats" value={review.metrics?.categoriesViewed ?? 0} />
                  <ReviewStat label="Areas" value={review.metrics?.neighborhoodsViewed ?? 0} />
                </div>

                {/* AI Summary or heuristic summary */}
                {review.aiSummary ? (
                  <div className="rounded-md bg-indigo-500/5 border border-indigo-500/20 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      <span className="text-[10px] font-medium text-indigo-500">AI Summary</span>
                    </div>
                    <p className="text-xs text-foreground">{review.aiSummary}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{review.summary}</p>
                )}

                {/* Recommendations */}
                {review.recommendations?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {review.recommendations.map((rec, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">
                        {rec}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Top categories */}
                {review.metrics?.topCategories?.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Top categories:</span>
                    {review.metrics.topCategories.map((c) => (
                      <span key={c.category} className="font-medium">{c.category} ({c.count})</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/30 p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-display font-700 tabular-nums mt-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback & Questionnaire Tab
// ---------------------------------------------------------------------------

type FeedbackEntry = {
  id: number;
  email: string | null;
  display_name: string | null;
  category: string;
  subject: string;
  message: string;
  rating: number;
  page_url: string | null;
  status: string;
  admin_response: string | null;
  created_at: string;
};

type QuestionnaireEntry = {
  id: number;
  email: string | null;
  display_name: string | null;
  questionnaire_type: string;
  responses: Record<string, any>;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

function FeedbackTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [qTitle, setQTitle] = useState("");
  const [qDescription, setQDescription] = useState("");
  const [qQuestions, setQQuestions] = useState<Array<{ id: string; text: string; type: string; required: boolean; options: string[] }>>([
    { id: "q1", text: "", type: "text", required: true, options: [] },
  ]);

  const { data: feedback, isLoading: fbLoading } = useQuery<FeedbackEntry[]>({
    queryKey: ["/api/feedback"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feedback");
      const data = await res.json();
      return data.feedback ?? data;
    },
  });
  const { data: questionnaires, isLoading: qLoading } = useQuery<QuestionnaireEntry[]>({
    queryKey: ["/api/questionnaire"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/questionnaire");
      const data = await res.json();
      return data.responses ?? data;
    },
  });
  const { data: managedQuestionnaires } = useQuery<any[]>({
    queryKey: ["/api/questionnaire/manage"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/questionnaire/manage");
      const data = await res.json();
      return data.questionnaires ?? [];
    },
  });

  const createQuestionnaireMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; questions: any[]; status: string }) => {
      const res = await apiRequest("POST", "/api/questionnaire/manage", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire created", description: "The questionnaire is now live for users." });
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire/manage"] });
      setShowBuilder(false);
      setQTitle("");
      setQDescription("");
      setQQuestions([{ id: "q1", text: "", type: "text", required: true, options: [] }]);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create questionnaire", description: err.message, variant: "destructive" });
    },
  });

  const deleteManagedQuestionnaireMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/questionnaire/manage/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire/manage"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const addQuestion = () => {
    setQQuestions((prev) => [...prev, { id: `q${prev.length + 1}-${Date.now()}`, text: "", type: "text", required: false, options: [] }]);
  };
  const removeQuestion = (id: string) => {
    setQQuestions((prev) => prev.filter((q) => q.id !== id));
  };
  const updateQuestion = (id: string, field: string, value: any) => {
    setQQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const handleCreateQuestionnaire = () => {
    if (!qTitle.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const validQuestions = qQuestions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      toast({ title: "At least one question required", variant: "destructive" });
      return;
    }
    createQuestionnaireMutation.mutate({
      title: qTitle.trim(),
      description: qDescription.trim() || undefined,
      questions: validQuestions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        type: q.type,
        required: q.required,
        options: q.type === "single-choice" || q.type === "multiple-choice" ? q.options.filter((o) => o.trim()) : undefined,
      })),
      status: "active",
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            User Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fbLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : feedback && feedback.length > 0 ? (
            <div className="space-y-3">
              {feedback.map((fb) => (
                <div key={fb.id} className="rounded-md bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] capitalize">{fb.category}</Badge>
                      {fb.rating > 0 && (
                        <span className="text-[10px] text-amber-500">{"★".repeat(fb.rating)}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(fb.created_at)}</span>
                  </div>
                  <p className="text-xs font-medium">{fb.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{fb.message}</p>
                  <p className="text-[10px] text-muted-foreground">
                    From: {fb.display_name || fb.email || "Anonymous"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquare} message="No feedback received yet." />
          )}
        </CardContent>
      </Card>

      {/* Questionnaire Builder */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Questionnaire Builder
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs ml-auto gap-1"
              onClick={() => setShowBuilder(!showBuilder)}
            >
              <Plus className="h-3 w-3" />
              {showBuilder ? "Cancel" : "Create Questionnaire"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showBuilder && (
            <div className="space-y-3 rounded-md border border-border p-3 bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                  placeholder="e.g. Community Satisfaction Survey"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={qDescription}
                  onChange={(e) => setQDescription(e.target.value)}
                  placeholder="Brief description of this questionnaire"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Questions</Label>
                {qQuestions.map((q, idx) => (
                  <div key={q.id} className="space-y-1.5 rounded-md border border-border/50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground shrink-0">Q{idx + 1}</span>
                      <Input
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                        placeholder="Question text"
                        className="h-8 text-xs flex-1"
                      />
                      <Select
                        value={q.type}
                        onValueChange={(v) => updateQuestion(q.id, "type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text" className="text-xs">Short Text</SelectItem>
                          <SelectItem value="textarea" className="text-xs">Long Text</SelectItem>
                          <SelectItem value="single-choice" className="text-xs">Single Choice</SelectItem>
                          <SelectItem value="multiple-choice" className="text-xs">Multiple Choice</SelectItem>
                          <SelectItem value="rating" className="text-xs">Rating (1-5)</SelectItem>
                          <SelectItem value="boolean" className="text-xs">Yes/No</SelectItem>
                        </SelectContent>
                      </Select>
                      <Checkbox
                        checked={q.required}
                        onCheckedChange={(c) => updateQuestion(q.id, "required", c === true)}
                      />
                      <span className="text-[9px] text-muted-foreground">Req</span>
                      {qQuestions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeQuestion(q.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {(q.type === "single-choice" || q.type === "multiple-choice") && (
                      <Input
                        value={q.options.join(", ")}
                        onChange={(e) => updateQuestion(q.id, "options", e.target.value.split(",").map((s) => s.trim()))}
                        placeholder="Enter options separated by commas"
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addQuestion}>
                  <Plus className="h-3 w-3" />
                  Add Question
                </Button>
              </div>
              <Button
                size="sm"
                className="w-full h-9 text-xs gap-1"
                disabled={createQuestionnaireMutation.isPending}
                onClick={handleCreateQuestionnaire}
              >
                {createQuestionnaireMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ClipboardList className="h-3.5 w-3.5" />
                )}
                Publish Questionnaire
              </Button>
            </div>
          )}

          {/* Managed questionnaires list */}
          {managedQuestionnaires && managedQuestionnaires.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Active Questionnaires</p>
              {managedQuestionnaires.map((mq: any) => (
                <div key={mq.id} className="flex items-center justify-between rounded-md bg-muted/30 p-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{mq.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {mq.questions?.length ?? 0} questions · {mq.status}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    disabled={deleteManagedQuestionnaireMutation.isPending && deleteManagedQuestionnaireMutation.variables === mq.id}
                    onClick={() => {
                      if (confirm(`Delete questionnaire "${mq.title}"? This cannot be undone.`)) {
                        deleteManagedQuestionnaireMutation.mutate(mq.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questionnaires */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Questionnaire Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : questionnaires && questionnaires.length > 0 ? (
            <div className="space-y-3">
              {questionnaires.map((qr) => (
                <div key={qr.id} className="rounded-md bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px]">{qr.questionnaire_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(qr.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    From: {qr.display_name || qr.email || "Anonymous"}
                  </p>
                  <div className="mt-1 space-y-1">
                    {Object.entries(qr.responses || {}).slice(0, 3).map(([key, val]) => (
                      <div key={key} className="text-[10px]">
                        <span className="text-muted-foreground">{key.replace(/_/g, " ")}: </span>
                        <span>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Newspaper} message="No questionnaire responses yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
