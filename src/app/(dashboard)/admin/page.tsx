"use client";

/**
 * Admin Super Dashboard
 *
 * Platform-wide administration: stats, user management, organizations
 * overview, recent activity, and system health. Restricted to users
 * with is_admin=true (checked via /api/user/profile).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
};

type PlatformStats = {
  totalUsers: number;
  totalOrganizations: number;
  totalTruths: number;
  totalRewardsDistributed: number;
  activeVacancies: number;
};

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "org_admin" | string;
  status: "active" | "suspended" | "inactive" | string;
  createdAt: string;
};

type Organization = {
  id: number | string;
  name: string;
  type?: string;
  verified?: boolean | number;
  active?: boolean | number;
  region?: string;
  city?: string;
  createdAt?: string;
};

type ActivityEntry = {
  id: string | number;
  description: string;
  category?: string;
  type?: string;
  timestamp: string;
  userHash?: string;
};

type SystemHealth = {
  status: string;
  uptime?: number;
  services?: Record<string, string>;
  database?: string;
  timestamp?: string;
};

const ROLE_OPTIONS = ["user", "admin", "org_admin"];

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

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" | "destructive" {
  if (role === "admin") return "destructive";
  if (role === "org_admin") return "default";
  return "secondary";
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20";
  if (status === "suspended") return "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/20";
  return "bg-muted text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const isAdminUser = Boolean(profile?.isAdmin ?? profile?.is_admin);

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdminUser,
  });

  const { data: users, isLoading: usersLoading } = useQuery<PlatformUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdminUser,
  });

  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    enabled: isAdminUser,
  });

  const { data: activity, isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity?limit=20"],
    enabled: isAdminUser,
  });

  const { data: health, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ["/api/health"],
    enabled: isAdminUser,
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlatformUser> }) => {
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

  const filteredUsers = (users ?? []).filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  if (profileLoading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl space-y-6">
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

  if (!isAdminUser) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="border-destructive/30 w-full" data-testid="card-access-denied">
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-display font-700">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              You need administrator privileges to view this dashboard. Contact your
              platform administrator if you believe this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="page-admin-dashboard">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Admin Super Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Platform-wide statistics, user management, and system health
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-admin">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="organizations" data-testid="tab-organizations">Organizations</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">System Health</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* Overview */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4">
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="grid-stats-cards">
              <StatCard
                icon={Users}
                iconColor="text-blue-500"
                label="Total Users"
                value={stats?.totalUsers ?? 0}
                testId="stat-total-users"
              />
              <StatCard
                icon={Building2}
                iconColor="text-purple-500"
                label="Organizations"
                value={stats?.totalOrganizations ?? 0}
                testId="stat-total-orgs"
              />
              <StatCard
                icon={Newspaper}
                iconColor="text-amber-500"
                label="Total Truths"
                value={stats?.totalTruths ?? 0}
                testId="stat-total-truths"
              />
              <StatCard
                icon={Coins}
                iconColor="text-green-500"
                label="Rewards Distributed"
                value={stats?.totalRewardsDistributed ?? 0}
                testId="stat-total-rewards"
              />
              <StatCard
                icon={TrendingUp}
                iconColor="text-cyan-500"
                label="Active Vacancies"
                value={stats?.activeVacancies ?? 0}
                testId="stat-active-vacancies"
              />
            </div>
          )}

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
                          <span className="text-[10px] text-muted-foreground">{timeAgo(entry.timestamp)}</span>
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
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Users */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Platform Users
              </CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Search name or email..."
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
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {u.name?.slice(0, 2).toUpperCase() ?? "??"}
                                </AvatarFallback>
                              </Avatar>
                              {u.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(value) =>
                                updateUserMutation.mutate({ id: u.id, data: { role: value } })
                              }
                            >
                              <SelectTrigger
                                className="h-7 w-32 text-xs"
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
                          <TableCell>
                            <Badge className={`text-[10px] ${statusBadgeClass(u.status)}`}>
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={u.status === "active" ? "outline" : "default"}
                              className="h-7 text-xs"
                              disabled={updateUserMutation.isPending}
                              data-testid={`button-toggle-status-${u.id}`}
                              onClick={() =>
                                updateUserMutation.mutate({
                                  id: u.id,
                                  data: { status: u.status === "active" ? "suspended" : "active" },
                                })
                              }
                            >
                              {u.status === "active" ? "Suspend" : "Activate"}
                            </Button>
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

        {/* ------------------------------------------------------------- */}
        {/* Organizations */}
        {/* ------------------------------------------------------------- */}
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
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell className="text-xs capitalize">{org.type ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {org.city ? `${org.city}, ${org.region ?? ""}` : "—"}
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

        {/* ------------------------------------------------------------- */}
        {/* System Health */}
        {/* ------------------------------------------------------------- */}
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
                    {health.status === "ok" || health.status === "healthy" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-sm font-medium capitalize">{health.status}</span>
                  </div>
                  {health.services && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(health.services).map(([name, status]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between rounded-md bg-muted/30 p-2.5"
                          data-testid={`row-service-${name}`}
                        >
                          <span className="text-xs capitalize">{name.replace(/_/g, " ")}</span>
                          <Badge
                            className={`text-[9px] ${
                              status === "ok" || status === "up"
                                ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                : "bg-red-500/15 text-red-600 dark:text-red-400"
                            }`}
                          >
                            {status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {typeof health.uptime === "number" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Uptime</span>
                        <span className="text-xs font-mono">{health.uptime}%</span>
                      </div>
                      <Progress value={health.uptime} className="h-1.5" />
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState icon={Activity} message="System health data is currently unavailable." />
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
        <p className="text-xl font-display font-700 tabular-nums mt-1">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
