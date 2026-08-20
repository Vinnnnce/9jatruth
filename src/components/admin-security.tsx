"use client";

/**
 * Admin Security Dashboard Module
 * ============================================================
 * A self-contained module rendered inside the Super Admin dashboard's
 * "Security" tab. It surfaces the full AI cybersecurity system:
 *  - Threat overview (risk score, severity breakdown)
 *  - Live threat / security event log
 *  - Device fingerprints + botnet clusters
 *  - Reward & telecom fraud signals
 *  - Content verification (news authenticity + deepfake)
 *  - Team member management (invite, assign roles, enable 2FA)
 *  - Role & permission matrix
 *
 * The super admin oversees all activities here. Role-scoped members get a
 * reduced view at /security (see the member dashboard page).
 */

import { useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Users,
  Fingerprint,
  Bot,
  AlertTriangle,
  Newspaper,
  CheckCircle2,
  Loader2,
  UserPlus,
} from "lucide-react";

const severityColor: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-blue-500 text-white",
  info: "bg-slate-400 text-white",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-primary",
}: {
  icon: any;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 ${tone}`} />
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminSecurity() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("security_analyst");

  const stats = useQuery({
    queryKey: ["/api/admin/security"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security")).json(),
  });

  const events = useQuery({
    queryKey: ["/api/admin/security/events"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/events?limit=50")).json(),
  });

  const devices = useQuery({
    queryKey: ["/api/admin/security/devices"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/devices?limit=100")).json(),
  });

  const botnet = useQuery({
    queryKey: ["/api/admin/security/botnet"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/botnet")).json(),
  });

  const fraud = useQuery({
    queryKey: ["/api/admin/security/fraud"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/fraud?limit=50")).json(),
  });

  const content = useQuery({
    queryKey: ["/api/admin/security/content"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/content?limit=50")).json(),
  });

  const members = useQuery({
    queryKey: ["/api/admin/members"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/members")).json(),
  });

  const ackMutation = useMutation({
    mutationFn: (eventId: number) =>
      apiRequest("POST", "/api/admin/security/events", { eventId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/events"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/security"] });
    },
  });

  const mitigateFraudMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", "/api/admin/security/fraud", { id, status: "mitigated" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/fraud"] });
      toast({ title: "Fraud signal mitigated" });
    },
  });

  const reviewContentMutation = useMutation({
    mutationFn: ({ id, verdict }: { id: number; verdict: string }) =>
      apiRequest("POST", "/api/admin/security/content", { id, verdict }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/content"] });
      toast({ title: "Content reviewed" });
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/members", {
        email: newMemberEmail,
        displayName: newMemberName,
        roleIds: [newMemberRole],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setNewMemberEmail("");
      setNewMemberName("");
      toast({ title: "Member added", description: "Assign roles and they'll see their scoped dashboard." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not add member",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMemberMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest("PATCH", "/api/admin/members", { id, active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/members"] }),
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roleIds }: { id: number; roleIds: string[] }) =>
      apiRequest("PATCH", "/api/admin/members", { id, roleIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/members"] }),
  });

  const statsData: any = stats.data ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI Security Command Center</h2>
        <Badge variant="outline" className="ml-2">
          Zero-Trust
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Real-time threat detection, behavioral anomaly analysis, botnet graph
        detection, fraud signals, and content verification across the platform.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={Activity}
          label="Total events"
          value={statsData.totalEvents ?? 0}
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical"
          value={statsData.criticalCount ?? 0}
          tone="text-red-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="High severity"
          value={statsData.highCount ?? 0}
          tone="text-red-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="Open alerts"
          value={statsData.openAlerts ?? 0}
          tone="text-amber-500"
        />
        <StatCard
          icon={ShieldAlert}
          label="Blocked IPs"
          value={statsData.blockedIps ?? 0}
          tone="text-slate-600"
        />
      </div>

      <Tabs defaultValue="threats" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="threats">Threat Log</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="botnet">Botnet</TabsTrigger>
          <TabsTrigger value="fraud">Fraud</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="members">Members & Roles</TabsTrigger>
        </TabsList>

        {/* Threat log */}
        <TabsContent value="threats" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent security events</CardTitle>
            </CardHeader>
            <CardContent>
              {events.isLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(events.data ?? []).map((ev: any) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <Badge className={severityColor[ev.severity] ?? severityColor.info}>
                            {ev.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{ev.event_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-28">
                            <Progress value={Math.round((ev.risk_score ?? 0) * 100)} className="h-2" />
                            <span className="text-xs">{Math.round((ev.risk_score ?? 0) * 100)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{ev.action_taken}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {ev.ip_hash ? ev.ip_hash.slice(0, 12) + "…" : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(ev.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {!ev.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => ackMutation.mutate(ev.id)}
                              disabled={ackMutation.isPending}
                            >
                              Ack
                            </Button>
                          )}
                          {ev.acknowledged && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(events.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                          No security events recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices */}
        <TabsContent value="devices" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Fingerprint className="h-4 w-4" /> Tracked devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.isLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fingerprint</TableHead>
                      <TableHead>Bot</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Blocked</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(devices.data ?? []).map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-mono">
                          {d.fingerprint?.slice(0, 16)}…
                        </TableCell>
                        <TableCell>
                          {d.is_bot ? (
                            <Badge className="bg-red-500 text-white">Bot</Badge>
                          ) : (
                            <Badge variant="outline">Human</Badge>
                          )}
                        </TableCell>
                        <TableCell>{d.request_count}</TableCell>
                        <TableCell>
                          {d.blocked ? (
                            <Badge className="bg-red-600 text-white">Blocked</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Botnet */}
        <TabsContent value="botnet" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" /> Botnet cluster detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span>Devices analyzed: <strong>{botnet.data?.totalDevices ?? 0}</strong></span>
                <span>Edges: <strong>{botnet.data?.totalEdges ?? 0}</strong></span>
              </div>
              {(botnet.data?.clusters ?? []).map((c: any) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.id}</span>
                    <Badge className={c.riskScore >= 0.6 ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
                      Risk {Math.round(c.riskScore * 100)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.memberCount} devices · {c.sharedAttributes?.join(", ") || "shared attributes"}
                  </p>
                </div>
              ))}
              {(botnet.data?.clusters ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No botnet clusters detected. The graph engine correlates devices by
                  fingerprint, ASN, and user-agent.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fraud */}
        <TabsContent value="fraud" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reward & telecom fraud signals</CardTitle>
            </CardHeader>
            <CardContent>
              {(fraud.data ?? []).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{f.fraud_type}</p>
                    <p className="text-xs text-muted-foreground">
                      Risk {Math.round((f.risk_score ?? 0) * 100)}% · {f.signals?.join(", ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mitigateFraudMutation.mutate(f.id)}
                    disabled={f.status !== "open" || mitigateFraudMutation.isPending}
                  >
                    Mitigate
                  </Button>
                </div>
              ))}
              {(fraud.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-4">
                  No fraud signals — the engine monitors redemption velocity, earning
                  rates, referral farming, and telecom top-up patterns.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content verification */}
        <TabsContent value="content" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Newspaper className="h-4 w-4" /> News authenticity & deepfake review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(content.data ?? []).map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{c.content_type}</Badge>
                    <Badge
                      className={
                        c.authenticity_score >= 55
                          ? "bg-emerald-500 text-white"
                          : "bg-amber-500 text-white"
                      }
                    >
                      Authenticity {c.authenticity_score}/100
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {c.text_content || c.media_url || "No preview"}
                  </p>
                  {c.signals?.length > 0 && (
                    <p className="text-xs">Signals: {c.signals.join(", ")}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewContentMutation.mutate({ id: c.id, verdict: "approved" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewContentMutation.mutate({ id: c.id, verdict: "rejected" })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {(content.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-4">
                  Submitted news/media is scored for clickbait, sensationalism, authority
                  impersonation, and deepfake metadata signals.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members & roles */}
        <TabsContent value="members" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Add security team member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.data?.roles?.map((r: any) => (
                      <SelectItem key={r.id} value={r.id} disabled={r.id === "super_admin"}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createMemberMutation.mutate()}
                disabled={createMemberMutation.isPending || !newMemberEmail || !newMemberName}
              >
                {createMemberMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Add member
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team members & roles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>2FA</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(members.data?.members ?? []).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.displayName}</TableCell>
                      <TableCell className="text-xs">{m.email}</TableCell>
                      <TableCell>
                        <Select
                          value={m.roleIds?.[0] ?? "security_analyst"}
                          onValueChange={(v) =>
                            updateRolesMutation.mutate({ id: m.id, roleIds: [v] })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(members.data?.roles ?? [])
                              .filter((r: any) => r.id !== "super_admin")
                              .map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {m.twoFactorEnabled ? (
                          <Badge className="bg-emerald-500 text-white">On</Badge>
                        ) : (
                          <Badge variant="outline">Off</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleMemberMutation.mutate({ id: m.id, active: !m.active })
                          }
                        >
                          {m.active ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(members.data?.members ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        No security members yet. Add one above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
