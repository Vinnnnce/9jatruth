"use client";

/**
 * Agency Auth Page
 *
 * Combined login and registration for agency/organization accounts.
 */

import { useState } from "react";
import { useAgencyAuth } from "@/hooks/use-agency-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

const ORG_TYPES: Record<string, string> = {
  government: "Government",
  utility: "Utility Company",
  media: "Media",
  ngo: "NGO",
  community: "Community Group",
  corporate: "Corporate",
};

export default function AgencyAuth() {
  const { login, register } = useAgencyAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [reg, setReg] = useState({
    orgName: "", orgType: "", description: "", contactEmail: "", contactPhone: "",
    website: "", region: "", city: "", email: "", password: "", displayName: "",
  });
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginEmail, loginPassword);
      toast({ title: "Welcome back", description: "Successfully logged in." });
      router.push("/account");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({
        orgName: reg.orgName,
        orgType: reg.orgType,
        description: reg.description || undefined,
        contactEmail: reg.contactEmail,
        contactPhone: reg.contactPhone || undefined,
        website: reg.website || undefined,
        region: reg.region || undefined,
        city: reg.city || undefined,
        email: reg.email,
        password: reg.password,
        displayName: reg.displayName,
      });
      toast({ title: "Organization registered", description: "Your agency account has been created." });
      router.push("/account");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-display font-700">Agency Account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sign in or register your organization</p>
      </div>

      <Tabs defaultValue="login">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" className="gap-1"><LogIn className="h-3.5 w-3.5" /> Sign In</TabsTrigger>
          <TabsTrigger value="register" className="gap-1"><UserPlus className="h-3.5 w-3.5" /> Register</TabsTrigger>
        </TabsList>

        {/* Login */}
        <TabsContent value="login">
          <Card>
            <CardHeader><CardTitle className="text-base">Sign In to Your Agency Account</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="loginEmail">Email</Label>
                  <Input id="loginEmail" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@agency.gov" />
                </div>
                <div>
                  <Label htmlFor="loginPassword">Password</Label>
                  <div className="relative">
                    <Input id="loginPassword" type={showPassword ? "text" : "password"} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-1">
                  <LogIn className="h-4 w-4" /> Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register */}
        <TabsContent value="register">
          <Card>
            <CardHeader><CardTitle className="text-base">Register Your Organization</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organization Details</p>
                  <div>
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input id="orgName" required value={reg.orgName} onChange={(e) => setReg({ ...reg, orgName: e.target.value })} placeholder="e.g. Eko Electricity Distribution" />
                  </div>
                  <div>
                    <Label htmlFor="orgType">Organization Type</Label>
                    <Select value={reg.orgType} onValueChange={(v) => setReg({ ...reg, orgType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORG_TYPES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="orgDesc">Description</Label>
                    <Textarea id="orgDesc" value={reg.description} onChange={(e) => setReg({ ...reg, description: e.target.value })} rows={2} placeholder="Brief description..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input id="contactEmail" type="email" required value={reg.contactEmail} onChange={(e) => setReg({ ...reg, contactEmail: e.target.value })} placeholder="info@org.gov.ng" />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input id="contactPhone" value={reg.contactPhone} onChange={(e) => setReg({ ...reg, contactPhone: e.target.value })} placeholder="+234..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="region">Region/State</Label>
                      <Input id="region" value={reg.region} onChange={(e) => setReg({ ...reg, region: e.target.value })} placeholder="Lagos" />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={reg.city} onChange={(e) => setReg({ ...reg, city: e.target.value })} placeholder="Ikeja" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" value={reg.website} onChange={(e) => setReg({ ...reg, website: e.target.value })} placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Credentials</p>
                  <div>
                    <Label htmlFor="displayName">Your Name</Label>
                    <Input id="displayName" required value={reg.displayName} onChange={(e) => setReg({ ...reg, displayName: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label htmlFor="accountEmail">Account Email (for login)</Label>
                    <Input id="accountEmail" type="email" required value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="admin@org.gov.ng" />
                  </div>
                  <div>
                    <Label htmlFor="accountPassword">Password</Label>
                    <div className="relative">
                      <Input id="accountPassword" type={showRegPassword ? "text" : "password"} required value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="Min 8 characters" />
                      <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full gap-1">
                  <UserPlus className="h-4 w-4" /> Create Agency Account
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
