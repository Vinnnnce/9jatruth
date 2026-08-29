"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Shield, Users, Trash2, Mail, ShieldCheck } from "lucide-react";

export function SubAdminManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  const { data: adminsData, isLoading } = useQuery({
    queryKey: ["/api/admin/sub-admins"],
    queryFn: () => apiRequest("GET", "/api/admin/sub-admins").then((r) => r.json()),
  });

  const { data: rolesData } = useQuery({
    queryKey: ["/api/admin/roles/list"],
    queryFn: () => apiRequest("GET", "/api/admin/roles/list").then((r) => r.json()),
  });

  const admins = adminsData?.admins || [];
  const roles = rolesData?.roles || [];

  const createMutation = useMutation({
    mutationFn: (data: { email: string; displayName?: string; roleId?: number }) =>
      apiRequest("POST", "/api/admin/sub-admins", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Sub-admin created", description: "The sub-admin has been created successfully" });
      setCreateOpen(false);
      setNewEmail("");
      setNewName("");
      setNewRoleId("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create sub-admin", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; roleId?: number } }) =>
      apiRequest("PATCH", `/api/admin/sub-admins/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Updated", description: "Sub-admin updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/sub-admins/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Deactivated", description: "Sub-admin has been deactivated" });
    },
  });

  const handleCreate = () => {
    if (!newEmail) {
      toast({ title: "Email required", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      email: newEmail,
      displayName: newName || undefined,
      roleId: newRoleId ? parseInt(newRoleId) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sub-Admin Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage sub-administrators and their roles
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Sub-Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Sub-Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name (optional)</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRoleId} onValueChange={setNewRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{admins.length}</p>
                <p className="text-xs text-muted-foreground">Total Sub-Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{admins.filter((a: any) => a.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{roles.length}</p>
                <p className="text-xs text-muted-foreground">Roles Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Admins Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sub-Administrators</CardTitle>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                No sub-admins yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {admins.map((admin: any) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {(admin.display_name || admin.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{admin.display_name || admin.email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {admin.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {admin.role_name && (
                        <Badge variant="secondary">{admin.role_name}</Badge>
                      )}
                      <Badge variant={admin.status === "active" ? "default" : "destructive"}>
                        {admin.status}
                      </Badge>
                      <Select
                        value={admin.role_id?.toString() || ""}
                        onValueChange={(v) =>
                          updateMutation.mutate({ id: admin.id, data: { roleId: parseInt(v) } })
                        }
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Change role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role: any) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(admin.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
