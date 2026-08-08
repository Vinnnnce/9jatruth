"use client";

/**
 * Admin Super Dashboard — Rebuild
 *
 * Email-gated platform administration for the super admin
 * (insights793@gmail.com). Combines powerful analytics (stat cards,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminAnalytics } from "@/components/admin-analytics";
import { VerifiedBadge } from "@/components/verified-badge";

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

  // Profile — super admin gate
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const isSuperAdmin = isSuperAdminProfile(profile);
  const dashboardType = getDashboardType(profile);

  // Geo hierarchy for dropdowns
  const { data: geo, isLoading: geoLoading } = useQuery<GeoHierarchy>({
    queryKey: ["/api/geo/hierarchy"],
    enabled: isSuperAdmin,
  });

  // Platform stats + chart breakdowns
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isSuperAdmin,
  });

  // All users with IP tracking
  const { data: users, isLoading: usersLoading } = useQuery<PlatformUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isSuperAdmin,
  });

  // All truths with IP tracking + geo filters (cascading)
  const truthsQueryKey = buildTruthsQuery(geoFilters);
  const { data: truths, isLoading: truthsLoading } = useQuery<AdminTruth[]>({
    queryKey: [truthsQueryKey],
    enabled: isSuperAdmin,
  });

  // Organizations overview
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    enabled: isSuperAdmin,
  });

  // Recent activity
  const { data: activity, isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity?limit=20"],
    enabled: isSuperAdmin,
  });

  // System health
  const { data: health, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ["/api/health"],
    enabled: isSuperAdmin,
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
              (insights793@gmail.com). If you believe this is a mistake, contact
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

  return (
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
        </TabsList>

        {/* --------------------------------------------------------------- */}
        {/* Overview — stat cards + charts + activity feed                  */}
        {/* --------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-6">
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
                    options={geo?.lgas ?? []}
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
                <p className="text-xs font-medium">Credit Rules</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Truth submission</span>
                    <Badge variant="secondary">+20 credits</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Corroboration received</span>
                    <Badge variant="secondary">+10 credits</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Verified by AI as authentic</span>
                    <Badge variant="secondary">+15 credits</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Daily streak bonus</span>
                    <Badge variant="secondary">+5 credits</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>Disputed truth penalty</span>
                    <Badge variant="destructive">-10 credits</Badge>
                  </div>
                </div>
              </div>
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
      </Tabs>
    </div>
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
