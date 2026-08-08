"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { Send, CheckCircle2, Info, MapPin, LocateFixed, Building2, UserPlus, LogIn } from "lucide-react";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAgencyAuth } from "@/hooks/use-agency-auth";
import { CATEGORY_LIST } from "@/lib/categories";
import { useUser } from "@/lib/use-user-safe";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";

type Neighborhood = {
  id: number;
  name: string;
  region: string;
};

const categories = CATEGORY_LIST;

export default function SubmitTruth() {
  const [neighborhoodId, setNeighborhoodId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [postAsOrg, setPostAsOrg] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lat, lng, requestLocation, loading: locLoading } = useLiveLocation();
  const { auth, loading: authLoading } = useAgencyAuth();
  const isAgencyAuth = !!auth.account;
  const { isSignedIn, isLoaded } = useUser();

  const { data: neighborhoods, isLoading } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  const mutation = useMutation({
    mutationFn: (data: { neighborhoodId: number; category: string; content: string; reportLat?: number; reportLng?: number; locationSource?: string }) => {
      const endpoint = postAsOrg && isAgencyAuth ? "/api/organizations/me/truths" : "/api/truths";
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Truth submitted",
        description: "Your micro-truth has been received and is being verified.",
      });
      setCategory("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
    },
    onError: (error: any) => {
      if (error?.status === 401) {
        toast({
          title: "Sign in required",
          description: "You need to sign in to submit a report.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission failed",
          description: "Please check your inputs and try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = () => {
    if (!neighborhoodId || !category || !content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please select a neighborhood, category, and write your report.",
        variant: "destructive",
      });
      return;
    }
    if (content.trim().length < 15) {
      toast({
        title: "Report too short",
        description: "Please provide at least 15 characters of detail.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      neighborhoodId: parseInt(neighborhoodId),
      category,
      content: content.trim(),
      ...(lat !== null && lng !== null ? { reportLat: lat, reportLng: lng, locationSource: "gps" as const } : {}),
    });
  };

  // Show sign-up/sign-in CTA for unauthenticated users
  if (isLoaded && !isSignedIn) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-display font-700">Submit a Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Report real-time conditions in your neighborhood.
          </p>
        </div>
        <Card className="border-border">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-display font-700 mb-2">Sign up to post a report</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              You can browse community feeds without an account, but you need to sign up to submit reports, verify truths, and earn rewards.
            </p>
            <div className="flex items-center justify-center gap-3">
              <SignUpButton mode="modal">
                <button className="text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors px-6 py-2 rounded-md">
                  Sign Up
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-6 py-2 rounded-md border border-border hover:bg-muted">
                  Log In
                </button>
              </SignInButton>
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <a href="/feeds" className="text-xs text-primary hover:underline">
                Browse community feeds →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Submit a Micro-Truth</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Report real-time conditions in your neighborhood. Verified reports earn 20 credits.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-display">New Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Live Location Capture */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
              <MapPin className={`h-4 w-4 ${lat !== null ? "text-green-500" : "text-primary"}`} />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">Live Location</div>
              <div className="text-[10px] text-muted-foreground">
                {lat !== null && lng !== null
                  ? `Captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                  : "Attach your GPS location for better accuracy"}
              </div>
            </div>
            <Button
              type="button"
              variant={lat !== null ? "secondary" : "outline"}
              size="sm"
              onClick={requestLocation}
              disabled={locLoading}
              className="h-7 gap-1 text-[10px]"
            >
              <LocateFixed className={`h-3 w-3 ${locLoading ? "animate-spin" : ""}`} />
              {lat !== null ? "Captured" : locLoading ? "Locating..." : "Capture"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood" className="text-xs">Neighborhood</Label>
              <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
                <SelectTrigger id="neighborhood" data-testid="select-neighborhood">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    neighborhoods?.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {n.name} — {n.region}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content" className="text-xs">Report Details</Label>
            <Textarea
              id="content"
              data-testid="input-content"
              placeholder="e.g. Power has been off for 2 hours on Admiralty Way. Transformer near Shoprite is sparking."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{content.length} characters</p>
              <p className="text-[11px] text-muted-foreground">Min 15 characters</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Your reports are pseudonymous and processed through the verification pipeline before reaching the community feed.
            </p>
          </div>

          {/* Post as organization (only for authenticated agencies) */}
          {!authLoading && isAgencyAuth && (
            <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Checkbox
                id="post-as-org"
                checked={postAsOrg}
                onCheckedChange={(checked) => setPostAsOrg(checked === true)}
              />
              <label htmlFor="post-as-org" className="flex items-center gap-2 text-xs cursor-pointer flex-1">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Post as <strong>{auth.organization?.name}</strong></span>
                {auth.organization?.verified === 1 && (
                  <Badge className="text-[9px] gap-0.5 bg-green-500/15 text-green-600">Verified Org</Badge>
                )}
              </label>
            </div>
          )}
          {!authLoading && !isAgencyAuth && (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Are you an agency? <a href="#/agency-auth" className="text-primary hover:underline">Sign in</a> to post as your organization.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+20 credits on submission</Badge>
              <Badge variant="outline" className="text-[10px]">Trust-scored</Badge>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              data-testid="button-submit-truth"
              className="gap-2"
            >
              {mutation.isPending ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Submit Truth
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mutation.isSuccess && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Truth submitted successfully</p>
              <p className="text-xs text-muted-foreground">
                Your report has entered the verification pipeline. It will be trust-scored, checked for duplicates, and corroborated against nearby reports.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-display">How Verification Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { step: "1", title: "Intake", desc: "Report received from mesh sync bundle" },
            { step: "2", title: "Format Check", desc: "Schema validated, category recognized (+5 trust)" },
            { step: "3", title: "Dedup Check", desc: "No duplicates within 500m radius (+10 trust)" },
            { step: "4", title: "Corroboration", desc: "Nearby reports cross-referenced (+15 trust)" },
            { step: "5", title: "Trust Evaluation", desc: "Final trust score assigned (0-100)" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-mono text-primary shrink-0">
                {s.step}
              </div>
              <div>
                <span className="text-xs font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground"> — {s.desc}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
