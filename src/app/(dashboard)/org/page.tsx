"use client";

/**
 * Organization / Agency Dashboard
 *
 * Lets an org admin manage members, roles & permissions, vacancies, and
 * applications, plus view an overview of the org's profile and truths.
 */

import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Building2,
  Users,
  Briefcase,
  Shield,
  Plus,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Key,
  FileText,
  Mail,
  Phone,
  Globe,
  Newspaper,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgProfile = {
  id: number | string;
  name: string;
  type: string;
  description?: string | null;
  contactEmail?: string;
  contactPhone?: string | null;
  website?: string | null;
  verified?: boolean | number;
};

const MEMBER_ROLES = ["admin", "editor", "viewer", "member"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

const ALL_PERMISSIONS = [
  "manage_members",
  "create_vacancies",
  "edit_org_profile",
  "post_truths",
  "verify_truths",
  "view_analytics",
] as const;
type Permission = (typeof ALL_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  editor: ["create_vacancies", "post_truths", "edit_org_profile"],
  viewer: ["view_analytics"],
  member: ["post_truths"],
};

type OrgMember = {
  id: string | number;
  name: string;
  email: string;
  role: MemberRole | string;
  permissions?: string[];
  status?: "active" | "pending" | "suspended" | string;
  createdAt?: string;
};

type Vacancy = {
  id: string | number;
  title: string;
  description: string;
  category?: string;
  location?: string;
  employmentType?: string;
  salaryRange?: string;
  requirements?: string[];
  responsibilities?: string[];
  applicationDeadline?: string;
  status?: string;
  createdAt?: string;
};

type Application = {
  id: string | number;
  vacancyId: string | number;
  applicantName?: string;
  applicantEmail?: string;
  status: "pending" | "reviewed" | "accepted" | "rejected" | string;
  createdAt?: string;
};

type OrgTruth = {
  id: string | number;
  title?: string;
  content?: string;
  category?: string;
  createdAt: string;
};

const EMPTY_MEMBER_FORM = {
  email: "",
  displayName: "",
  role: "member" as MemberRole,
  permissions: [] as string[],
};

const EMPTY_VACANCY_FORM = {
  title: "",
  description: "",
  category: "",
  location: "",
  employmentType: "",
  salaryRange: "",
  requirements: "",
  responsibilities: "",
  applicationDeadline: "",
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

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" | "destructive" {
  if (role === "admin") return "destructive";
  if (role === "editor") return "default";
  return "secondary";
}

function applicationStatusClass(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20";
    case "rejected":
      return "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/20";
    case "reviewed":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20";
    default:
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrgDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [editMember, setEditMember] = useState<OrgMember | null>(null);

  const [vacancyDialogOpen, setVacancyDialogOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [vacancyForm, setVacancyForm] = useState(EMPTY_VACANCY_FORM);

  const [applicationsVacancyId, setApplicationsVacancyId] = useState<string | number | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: orgProfile, isLoading: profileLoading } = useQuery<OrgProfile>({
    queryKey: ["/api/user/profile"],
  });

  const { data: members, isLoading: membersLoading } = useQuery<OrgMember[]>({
    queryKey: ["/api/org/members"],
  });

  const { data: vacancies, isLoading: vacanciesLoading } = useQuery<Vacancy[]>({
    queryKey: ["/api/org/vacancies"],
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: [`/api/org/vacancies/${applicationsVacancyId}/applications`],
    enabled: applicationsVacancyId !== null,
  });

  const { data: orgTruths, isLoading: orgTruthsLoading } = useQuery<OrgTruth[]>({
    queryKey: ["/api/truths?org=true"],
  });

  // -------------------------------------------------------------------------
  // Mutations — members
  // -------------------------------------------------------------------------

  const addMemberMutation = useMutation({
    mutationFn: async (data: typeof memberForm) => {
      const res = await apiRequest("POST", "/api/org/members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "Member added", description: "An invitation has been sent." });
      setAddMemberOpen(false);
      setMemberForm(EMPTY_MEMBER_FORM);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add member", description: err.message, variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<OrgMember> }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "Member updated" });
      setEditMember(null);
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `/api/org/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove member", description: err.message, variant: "destructive" });
    },
  });

  // -------------------------------------------------------------------------
  // Mutations — vacancies
  // -------------------------------------------------------------------------

  const saveVacancyMutation = useMutation({
    mutationFn: async (data: typeof vacancyForm) => {
      const payload = {
        ...data,
        requirements: data.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
        responsibilities: data.responsibilities.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      if (editingVacancy) {
        const res = await apiRequest("PATCH", `/api/org/vacancies/${editingVacancy.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/org/vacancies", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/vacancies"] });
      toast({
        title: editingVacancy ? "Vacancy updated" : "Vacancy created",
        description: editingVacancy ? "Changes saved." : "The vacancy is now live.",
      });
      setVacancyDialogOpen(false);
      setEditingVacancy(null);
      setVacancyForm(EMPTY_VACANCY_FORM);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save vacancy", description: err.message, variant: "destructive" });
    },
  });

  const deleteVacancyMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `/api/org/vacancies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/vacancies"] });
      toast({ title: "Vacancy deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete vacancy", description: err.message, variant: "destructive" });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string | number; status: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/org/vacancies/${applicationsVacancyId}/applications/${id}`,
        { status },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/org/vacancies/${applicationsVacancyId}/applications`],
      });
      toast({ title: "Application updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const openEditVacancy = (v: Vacancy) => {
    setEditingVacancy(v);
    setVacancyForm({
      title: v.title,
      description: v.description,
      category: v.category ?? "",
      location: v.location ?? "",
      employmentType: v.employmentType ?? "",
      salaryRange: v.salaryRange ?? "",
      requirements: (v.requirements ?? []).join("\n"),
      responsibilities: (v.responsibilities ?? []).join("\n"),
      applicationDeadline: v.applicationDeadline ?? "",
    });
    setVacancyDialogOpen(true);
  };

  const openNewVacancy = () => {
    setEditingVacancy(null);
    setVacancyForm(EMPTY_VACANCY_FORM);
    setVacancyDialogOpen(true);
  };

  const togglePermission = (perm: string, checked: boolean, target: "add" | "edit") => {
    if (target === "add") {
      setMemberForm((f) => ({
        ...f,
        permissions: checked ? [...f.permissions, perm] : f.permissions.filter((p) => p !== perm),
      }));
    } else if (editMember) {
      const current = editMember.permissions ?? [];
      setEditMember({
        ...editMember,
        permissions: checked ? [...current, perm] : current.filter((p) => p !== perm),
      });
    }
  };

  const activeVacancyCount = useMemo(
    () => (vacancies ?? []).filter((v) => v.status !== "closed").length,
    [vacancies],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="page-org-dashboard">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your organization&apos;s members, roles, and recruitment
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto" data-testid="tabs-org">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">Roles &amp; Permissions</TabsTrigger>
          <TabsTrigger value="vacancies" data-testid="tab-vacancies">Vacancies</TabsTrigger>
          <TabsTrigger value="applications" data-testid="tab-applications">Applications</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* Overview */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4">
          {profileLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <Card data-testid="card-org-profile">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-display font-700">{orgProfile?.name ?? "Your Organization"}</h2>
                      {orgProfile?.verified ? (
                        <Badge className="text-[9px] gap-0.5 bg-green-500/15 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-amber-500">Pending Verification</Badge>
                      )}
                      {orgProfile?.type && (
                        <Badge variant="secondary" className="text-[9px] capitalize">{orgProfile.type}</Badge>
                      )}
                    </div>
                    {orgProfile?.description && (
                      <p className="text-xs text-muted-foreground">{orgProfile.description}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground pt-1">
                      {orgProfile?.contactEmail && (
                        <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{orgProfile.contactEmail}</span>
                      )}
                      {orgProfile?.contactPhone && (
                        <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{orgProfile.contactPhone}</span>
                      )}
                      {orgProfile?.website && (
                        <a href={orgProfile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline text-primary">
                          <Globe className="h-2.5 w-2.5" />Website
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card data-testid="stat-member-count">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground uppercase">Members</span>
                </div>
                <p className="text-xl font-display font-700 tabular-nums mt-1">{members?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-active-vacancies">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-[10px] text-muted-foreground uppercase">Active Vacancies</span>
                </div>
                <p className="text-xl font-display font-700 tabular-nums mt-1">{activeVacancyCount}</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-org-truths">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5">
                  <Newspaper className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground uppercase">Org Truths</span>
                </div>
                <p className="text-xl font-display font-700 tabular-nums mt-1">{orgTruths?.length ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                Org Truths
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orgTruthsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : orgTruths && orgTruths.length > 0 ? (
                <div className="space-y-2" data-testid="list-org-truths">
                  {orgTruths.slice(0, 8).map((t) => (
                    <div key={t.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2.5">
                      <Newspaper className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed line-clamp-2">{t.title || t.content}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.category && <Badge variant="outline" className="text-[9px] capitalize">{t.category}</Badge>}
                          <span className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Newspaper} message="Your organization hasn't posted any truths yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Members */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Organization Members
              </CardTitle>
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1" data-testid="button-add-member">
                    <UserPlus className="h-3.5 w-3.5" /> Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" /> Add Organization Member
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addMemberMutation.mutate(memberForm);
                    }}
                  >
                    <div>
                      <Label htmlFor="member-email">Email</Label>
                      <Input
                        id="member-email"
                        type="email"
                        required
                        value={memberForm.email}
                        onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                        placeholder="member@org.com"
                        data-testid="input-member-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-name">Display Name</Label>
                      <Input
                        id="member-name"
                        required
                        value={memberForm.displayName}
                        onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                        placeholder="Jane Doe"
                        data-testid="input-member-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-role">Role</Label>
                      <Select
                        value={memberForm.role}
                        onValueChange={(v) =>
                          setMemberForm({
                            ...memberForm,
                            role: v as MemberRole,
                            permissions: ROLE_PERMISSIONS[v as MemberRole],
                          })
                        }
                      >
                        <SelectTrigger id="member-role" data-testid="select-member-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBER_ROLES.map((role) => (
                            <SelectItem key={role} value={role} className="capitalize">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Permissions</Label>
                      <div className="grid grid-cols-1 gap-2 mt-1.5">
                        {ALL_PERMISSIONS.map((perm) => (
                          <div key={perm} className="flex items-center gap-2">
                            <Checkbox
                              id={`add-perm-${perm}`}
                              checked={memberForm.permissions.includes(perm)}
                              onCheckedChange={(checked) => togglePermission(perm, Boolean(checked), "add")}
                              data-testid={`checkbox-add-perm-${perm}`}
                            />
                            <Label htmlFor={`add-perm-${perm}`} className="text-xs font-normal capitalize cursor-pointer">
                              {perm.replace(/_/g, " ")}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={addMemberMutation.isPending}
                      data-testid="button-submit-add-member"
                    >
                      {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : members && members.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table data-testid="table-members">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.email}</TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant(m.role)} className="text-[10px] capitalize">
                              {m.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {(m.permissions ?? []).slice(0, 3).map((p) => (
                                <Badge key={p} variant="outline" className="text-[9px] capitalize">
                                  {p.replace(/_/g, " ")}
                                </Badge>
                              ))}
                              {(m.permissions?.length ?? 0) > 3 && (
                                <Badge variant="outline" className="text-[9px]">
                                  +{(m.permissions?.length ?? 0) - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[9px] ${
                                m.status === "active"
                                  ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {m.status ?? "active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setEditMember(m)}
                                data-testid={`button-edit-member-${m.id}`}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeMemberMutation.mutate(m.id)}
                                disabled={removeMemberMutation.isPending}
                                data-testid={`button-remove-member-${m.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState icon={Users} message="No members yet. Add your first team member." />
              )}
            </CardContent>
          </Card>

          {/* Edit member dialog */}
          <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" /> Edit Member
                </DialogTitle>
              </DialogHeader>
              {editMember && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateMemberMutation.mutate({
                      id: editMember.id,
                      data: { role: editMember.role, permissions: editMember.permissions },
                    });
                  }}
                >
                  <div>
                    <Label>Name</Label>
                    <p className="text-sm font-medium">{editMember.name}</p>
                  </div>
                  <div>
                    <Label htmlFor="edit-role">Role</Label>
                    <Select
                      value={editMember.role}
                      onValueChange={(v) =>
                        setEditMember({ ...editMember, role: v, permissions: ROLE_PERMISSIONS[v as MemberRole] })
                      }
                    >
                      <SelectTrigger id="edit-role" data-testid="select-edit-member-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-1 gap-2 mt-1.5">
                      {ALL_PERMISSIONS.map((perm) => (
                        <div key={perm} className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-perm-${perm}`}
                            checked={(editMember.permissions ?? []).includes(perm)}
                            onCheckedChange={(checked) => togglePermission(perm, Boolean(checked), "edit")}
                            data-testid={`checkbox-edit-perm-${perm}`}
                          />
                          <Label htmlFor={`edit-perm-${perm}`} className="text-xs font-normal capitalize cursor-pointer">
                            {perm.replace(/_/g, " ")}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={updateMemberMutation.isPending} data-testid="button-save-member">
                    {updateMemberMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Roles & Permissions */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Available Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="table-role-permissions">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      {MEMBER_ROLES.map((role) => (
                        <TableHead key={role} className="text-center capitalize">{role}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_PERMISSIONS.map((perm) => (
                      <TableRow key={perm}>
                        <TableCell className="font-medium text-xs capitalize flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          {perm.replace(/_/g, " ")}
                        </TableCell>
                        {MEMBER_ROLES.map((role) => (
                          <TableCell key={role} className="text-center">
                            {ROLE_PERMISSIONS[role].includes(perm) ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                To customize an individual member&apos;s permissions beyond their role defaults, use the
                edit action in the Members tab.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Vacancies */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="vacancies" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Vacancies &amp; Recruitment Notices
              </CardTitle>
              <Dialog
                open={vacancyDialogOpen}
                onOpenChange={(open) => {
                  setVacancyDialogOpen(open);
                  if (!open) {
                    setEditingVacancy(null);
                    setVacancyForm(EMPTY_VACANCY_FORM);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1" onClick={openNewVacancy} data-testid="button-add-vacancy">
                    <Plus className="h-3.5 w-3.5" /> New Vacancy
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" /> {editingVacancy ? "Edit Vacancy" : "Create Vacancy"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveVacancyMutation.mutate(vacancyForm);
                    }}
                  >
                    <div>
                      <Label htmlFor="v-title">Title</Label>
                      <Input
                        id="v-title"
                        required
                        value={vacancyForm.title}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                        placeholder="Field Verification Officer"
                        data-testid="input-vacancy-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="v-description">Description</Label>
                      <Textarea
                        id="v-description"
                        required
                        rows={3}
                        value={vacancyForm.description}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })}
                        placeholder="Role summary..."
                        data-testid="input-vacancy-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="v-category">Category</Label>
                        <Input
                          id="v-category"
                          value={vacancyForm.category}
                          onChange={(e) => setVacancyForm({ ...vacancyForm, category: e.target.value })}
                          placeholder="Operations"
                          data-testid="input-vacancy-category"
                        />
                      </div>
                      <div>
                        <Label htmlFor="v-location">Location</Label>
                        <Input
                          id="v-location"
                          value={vacancyForm.location}
                          onChange={(e) => setVacancyForm({ ...vacancyForm, location: e.target.value })}
                          placeholder="Lagos, Nigeria"
                          data-testid="input-vacancy-location"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="v-employment-type">Employment Type</Label>
                        <Select
                          value={vacancyForm.employmentType}
                          onValueChange={(v) => setVacancyForm({ ...vacancyForm, employmentType: v })}
                        >
                          <SelectTrigger id="v-employment-type" data-testid="select-employment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full-time</SelectItem>
                            <SelectItem value="part_time">Part-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="volunteer">Volunteer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="v-salary">Salary Range</Label>
                        <Input
                          id="v-salary"
                          value={vacancyForm.salaryRange}
                          onChange={(e) => setVacancyForm({ ...vacancyForm, salaryRange: e.target.value })}
                          placeholder="₦150,000 - ₦250,000"
                          data-testid="input-vacancy-salary"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="v-requirements">Requirements (one per line)</Label>
                      <Textarea
                        id="v-requirements"
                        rows={3}
                        value={vacancyForm.requirements}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, requirements: e.target.value })}
                        placeholder={"2+ years experience\nStrong communication skills"}
                        data-testid="input-vacancy-requirements"
                      />
                    </div>
                    <div>
                      <Label htmlFor="v-responsibilities">Responsibilities (one per line)</Label>
                      <Textarea
                        id="v-responsibilities"
                        rows={3}
                        value={vacancyForm.responsibilities}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, responsibilities: e.target.value })}
                        placeholder={"Verify field reports\nCoordinate with local teams"}
                        data-testid="input-vacancy-responsibilities"
                      />
                    </div>
                    <div>
                      <Label htmlFor="v-deadline">Application Deadline</Label>
                      <Input
                        id="v-deadline"
                        type="date"
                        value={vacancyForm.applicationDeadline}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, applicationDeadline: e.target.value })}
                        data-testid="input-vacancy-deadline"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={saveVacancyMutation.isPending}
                      data-testid="button-submit-vacancy"
                    >
                      {saveVacancyMutation.isPending
                        ? "Saving..."
                        : editingVacancy
                        ? "Save Changes"
                        : "Create Vacancy"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {vacanciesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : vacancies && vacancies.length > 0 ? (
                <div className="space-y-3" data-testid="list-vacancies">
                  {vacancies.map((v) => (
                    <Card key={v.id} className="border-border" data-testid={`row-vacancy-${v.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{v.title}</span>
                              {v.category && <Badge variant="outline" className="text-[9px]">{v.category}</Badge>}
                              {v.employmentType && (
                                <Badge variant="secondary" className="text-[9px] capitalize">
                                  {v.employmentType.replace(/_/g, " ")}
                                </Badge>
                              )}
                              <Badge
                                className={`text-[9px] ${
                                  v.status === "closed"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-green-500/15 text-green-600 dark:text-green-400"
                                }`}
                              >
                                {v.status ?? "open"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
                            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                              {v.location && <span>{v.location}</span>}
                              {v.salaryRange && <span>{v.salaryRange}</span>}
                              {v.applicationDeadline && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  Deadline {new Date(v.applicationDeadline).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setApplicationsVacancyId(v.id)}
                              data-testid={`button-view-applications-${v.id}`}
                              title="View Applications"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditVacancy(v)}
                              data-testid={`button-edit-vacancy-${v.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteVacancyMutation.mutate(v.id)}
                              disabled={deleteVacancyMutation.isPending}
                              data-testid={`button-delete-vacancy-${v.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Briefcase} message="No vacancies posted yet. Create your first recruitment notice." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Applications */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Applications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <Label htmlFor="applications-vacancy-select" className="text-xs">Select Vacancy</Label>
                <Select
                  value={applicationsVacancyId ? String(applicationsVacancyId) : undefined}
                  onValueChange={(v) => setApplicationsVacancyId(v)}
                >
                  <SelectTrigger id="applications-vacancy-select" data-testid="select-applications-vacancy">
                    <SelectValue placeholder="Choose a vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(vacancies ?? []).map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {applicationsVacancyId === null ? (
                <EmptyState icon={FileText} message="Select a vacancy above to view its applications." />
              ) : applicationsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : applications && applications.length > 0 ? (
                <ScrollArea className="max-h-[420px]">
                  <div className="overflow-x-auto">
                    <Table data-testid="table-applications">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app) => (
                          <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                            <TableCell className="font-medium text-xs">{app.applicantName ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{app.applicantEmail ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeAgo(app.createdAt)}</TableCell>
                            <TableCell>
                              <Badge className={`text-[9px] capitalize ${applicationStatusClass(app.status)}`}>
                                {app.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Select
                                value={app.status}
                                onValueChange={(status) => updateApplicationMutation.mutate({ id: app.id, status })}
                              >
                                <SelectTrigger className="h-7 w-32 text-xs ml-auto" data-testid={`select-application-status-${app.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="reviewed">Reviewed</SelectItem>
                                  <SelectItem value="accepted">Accepted</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState icon={FileText} message="No applications received for this vacancy yet." />
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

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
