"use client";

/**
 * Member Security Dashboard (/security)
 * ============================================================
 * A role-scoped dashboard for security team members. Unlike the super admin
 * dashboard, this view only renders the modules the signed-in member has
 * permissions for (resolved from /api/security/me). The super admin is
 * redirected to /admin (the full command center).
 *
 * Members can also set up two-factor authentication (TOTP) from here.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Loader2,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { AdminSecurity } from "@/components/admin-security";

export default function SecurityMemberPage() {
  const me = useQuery({
    queryKey: ["/api/security/me"],
    queryFn: async () => (await apiRequest("GET", "/api/security/me")).json(),
  });

  // 2FA setup flow state.
  const [setupData, setSetupData] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const start2fa = async () => {
    setTwoFactorBusy(true);
    setTwoFactorError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Setup failed");
      setSetupData(data);
    } catch (err: any) {
      setTwoFactorError(err.message || "Could not start 2FA setup");
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const confirm2fa = async () => {
    setTwoFactorBusy(true);
    setTwoFactorError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: setupData.secret,
          code: verifyCode,
          backupCodes: setupData.backupCodes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      setSetupData(null);
      setVerifyCode("");
      me.refetch();
    } catch (err: any) {
      setTwoFactorError(err.message || "Invalid code");
    } finally {
      setTwoFactorBusy(false);
    }
  };

  if (me.isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Super admin → redirect to the full command center.
  if (me.data?.isSuperAdmin) {
    if (typeof window !== "undefined") {
      window.location.href = "/admin";
    }
    return (
      <div className="p-6 text-sm text-muted-foreground">Redirecting to admin…</div>
    );
  }

  const permissions: string[] = me.data?.permissions ?? [];
  const has = (perm: string) =>
    permissions.includes("*") || permissions.includes(perm);

  // If the user has no security role at all, show an access-denied view.
  if (permissions.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="border-destructive/30 w-full">
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">No security access</h1>
            <p className="text-sm text-muted-foreground">
              Your account isn&apos;t assigned a security role. Contact the
              platform administrator to be added to the security team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {me.data?.member?.displayName ?? "Member"} ·{" "}
            {me.data?.member?.roleIds?.join(", ") || "team member"}
          </p>
        </div>
        <Badge variant={me.data?.twoFactorEnabled ? "default" : "outline"}>
          {me.data?.twoFactorEnabled ? "2FA On" : "2FA Off"}
        </Badge>
      </div>

      {/* 2FA enrollment card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" /> Two-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {me.data?.twoFactorEnabled ? (
            <p className="text-sm text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> 2FA is enabled for your account.
            </p>
          ) : setupData ? (
            <div className="space-y-3">
              <p className="text-sm">
                Scan this secret with your authenticator app (Google Authenticator,
                Authy, 1Password), then enter the 6-digit code.
              </p>
              <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                {setupData.otpAuthUri}
              </div>
              <p className="text-xs text-muted-foreground">
                Secret: <code>{setupData.secret}</code>
              </p>
              <p className="text-xs text-amber-600">
                Save these backup codes (shown once): {setupData.backupCodes?.join(", ")}
              </p>
              <div className="flex gap-2 max-w-xs">
                <Input
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  maxLength={6}
                />
                <Button onClick={confirm2fa} disabled={twoFactorBusy || verifyCode.length !== 6}>
                  {twoFactorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
                  Verify
                </Button>
              </div>
              {twoFactorError && (
                <p className="text-xs text-destructive">{twoFactorError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Protect your account with a time-based one-time password (TOTP).
              </p>
              <Button onClick={start2fa} disabled={twoFactorBusy}>
                {twoFactorBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Set up 2FA
              </Button>
              {twoFactorError && (
                <p className="text-xs text-destructive">{twoFactorError}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-scoped operational modules.
          Members only see the tabs they have permissions for. The actual
          data is fetched through permission-guarded API routes, so a member
          can't access data beyond their role even by direct API call. */}
      {has("security.dashboard.view") && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            {has("security.threats.view") && <TabsTrigger value="threats">Threats</TabsTrigger>}
            {has("security.devices.view") && <TabsTrigger value="devices">Devices</TabsTrigger>}
            {has("security.botnet.view") && <TabsTrigger value="botnet">Botnet</TabsTrigger>}
            {has("security.fraud.view") && <TabsTrigger value="fraud">Fraud</TabsTrigger>}
            {has("security.content.review") && <TabsTrigger value="content">Content</TabsTrigger>}
            {has("security.members.manage") && <TabsTrigger value="members">Members</TabsTrigger>}
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <AdminSecurity />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
