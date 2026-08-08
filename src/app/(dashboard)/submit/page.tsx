"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import {
  Send, CheckCircle2, Info, MapPin, LocateFixed, Building2, Navigation, Coins, ShieldCheck, User,
} from "lucide-react";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAgencyAuth } from "@/hooks/use-agency-auth";
import { CATEGORY_LIST } from "@/lib/categories";
import { useUser } from "@/lib/use-user-safe";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { VerifiedBadge } from "@/components/verified-badge";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

const categories = CATEGORY_LIST;

/** Parse the HTTP status code from an apiRequest error */
function getErrorStatus(error: any): number | null {
  if (error?.status) return error.status;
  const msg = error?.message || String(error);
  const match = msg.match(/^(\d{3}):/);
  return match ? parseInt(match[1], 10) : null;
}

/** Extract the server message from an apiRequest error */
function getErrorMessage(error: any): string {
  const msg = error?.message || String(error);
  // Format is "STATUS: message text"
  const idx = msg.indexOf(":");
  if (idx > 0) return msg.substring(idx + 1).trim();
  return msg;
}

export default function SubmitTruth() {
  const [neighborhoodInput, setNeighborhoodInput] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [postAsOrg, setPostAsOrg] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number | null; lng: number | null; region: string | null; city: string | null } | null>(null);
  const [detectingLoc, setDetectingLoc] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lat, lng, requestLocation, loading: locLoading } = useLiveLocation();
  const { auth, loading: authLoading } = useAgencyAuth();
  const isAgencyAuth = !!auth?.account;
  const hasOrganization = !!auth?.organization;
  const { isSignedIn, isLoaded } = useUser();

  // Auto-detect user's real location via IP on mount
  useEffect(() => {
    if (detectedLocation) return;
    setDetectingLoc(true);
    fetch("/api/geo/nearby")
      .then((res) => res.json())
      .then((data) => {
        if (data.userLocation) {
          const loc = {
            lat: data.userLocation.lat ?? null,
            lng: data.userLocation.lng ?? null,
            region: data.userLocation.region ?? null,
            city: data.userLocation.city ?? null,
          };
          setDetectedLocation(loc);
          // Pre-fill neighborhood input with detected city
          if (loc.city && !neighborhoodInput) {
            setNeighborhoodInput(loc.city);
          }
        }
      })
      .catch(() => {})
      .finally(() => setDetectingLoc(false));
  }, [detectedLocation, neighborhoodInput]);

  const mutation = useMutation({
    mutationFn: (data: { neighborhoodName: string; category: string; content: string; reportLat?: number; reportLng?: number; locationSource?: string }) => {
      const endpoint = postAsOrg && isAgencyAuth ? "/api/organizations/me/truths" : "/api/truths";
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Truth submitted",
        description: "Your micro-truth has been received and is being verified. +20 credits earned!",
      });
      setCategory("");
      setContent("");
      setNeighborhoodInput("");
      setPostAsOrg(false);
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
    },
    onError: (error: any) => {
      const status = getErrorStatus(error);
      const serverMsg = getErrorMessage(error);

      if (status === 401) {
        toast({
          title: "Sign in required",
          description: "You need to sign in to submit a report. Click Sign In at the top right.",
          variant: "destructive",
        });
      } else if (status === 400) {
        toast({
          title: "Validation error",
          description: serverMsg || "Please check your inputs and try again.",
          variant: "destructive",
        });
      } else if (status === 403) {
        toast({
          title: "Not allowed",
          description: serverMsg || "You do not have permission to perform this action.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission failed",
          description: serverMsg || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = () => {
    if (!neighborhoodInput.trim() || !category || !content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter your area, select a category, and write your report.",
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
      neighborhoodName: neighborhoodInput.trim(),
      category,
      content: content.trim(),
      reportLat: lat ?? undefined,
      reportLng: lng ?? undefined,
      locationSource: lat ? "gps" : "ip",
    });
  };

  if (!isLoaded) {
    return (
      <div className="p-4 md:p-6 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const formContent = (
    <>
      <div>
        <h1 className="text-xl font-display font-700">Submit Truth</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Report what's happening in your neighborhood
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">New Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location Detection */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <Navigation className={`h-3.5 w-3.5 ${detectingLoc ? "animate-spin text-primary" : detectedLocation?.lat ? "text-green-500" : "text-primary"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">Your Location</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {detectingLoc
                    ? "Detecting..."
                    : detectedLocation?.city && detectedLocation?.region
                    ? `${detectedLocation.city}, ${detectedLocation.region}`
                    : detectedLocation?.region || "Not detected"}
                </div>
              </div>
              <Button
                type="button"
                variant={lat !== null ? "secondary" : "outline"}
                size="sm"
                onClick={requestLocation}
                disabled={locLoading}
                className="h-6 gap-1 text-[10px] px-2"
              >
                <LocateFixed className={`h-2.5 w-2.5 ${locLoading ? "animate-spin" : ""}`} />
                {lat !== null ? "GPS" : locLoading ? "..." : "GPS"}
              </Button>
            </div>

            {/* Neighborhood — manual text input */}
            <div className="space-y-1">
              <Label htmlFor="neighborhood" className="text-xs">Neighborhood / Area</Label>
              <Input
                id="neighborhood"
                data-testid="input-neighborhood"
                value={neighborhoodInput}
                onChange={(e) => setNeighborhoodInput(e.target.value)}
                placeholder="e.g. Yaba, Lekki, Ikeja"
                className="h-9 text-sm"
              />
              {detectedLocation?.city && neighborhoodInput === detectedLocation.city && (
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  Auto-detected from your location
                </p>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="category" className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" data-testid="select-category" className="h-9 text-sm">
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

          {/* Report Details */}
          <div className="space-y-1">
            <Label htmlFor="content" className="text-xs">Report Details</Label>
            <Textarea
              id="content"
              data-testid="input-content"
              placeholder="e.g. Power has been off for 2 hours on Admiralty Way. Transformer near Shoprite is sparking."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">{content.length} characters</p>
              <p className="text-[10px] text-muted-foreground">Min 15 characters</p>
            </div>
          </div>

          {/* Post as — always visible */}
          <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              {postAsOrg && hasOrganization ? (
                <Building2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">
                {postAsOrg && hasOrganization
                  ? `Posting as ${auth!.organization!.name}`
                  : "Posting as individual"}
              </span>
              {postAsOrg && hasOrganization && auth!.organization!.verified === 1 && (
                <VerifiedBadge showLabel />
              )}
            </div>

            {hasOrganization ? (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="post-as-org"
                  checked={postAsOrg}
                  onCheckedChange={(checked) => setPostAsOrg(checked === true)}
                />
                <label htmlFor="post-as-org" className="flex items-center gap-2 text-xs cursor-pointer flex-1">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>Post as <strong>{auth!.organization!.name}</strong></span>
                  {auth!.organization!.verified === 1 && <VerifiedBadge showLabel />}
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-1">
                <Info className="h-3 w-3" />
                <span>
                  {authLoading
                    ? "Checking for organization account..."
                    : "No organization linked. Register an agency account to post as an organization."}
                </span>
              </div>
            )}
          </div>

          {/* Submit row — credits and trust-scored badges inline */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Coins className="h-2.5 w-2.5" />
                +20 credits
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                Trust-scored
              </Badge>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              data-testid="button-submit-truth"
              className="gap-2"
              size="sm"
            >
              {mutation.isPending ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Submit
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
    </>
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      {isClerkConfigured && (
        <SignedOut>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <h2 className="text-lg font-display font-700">Sign in to Submit Reports</h2>
              <p className="text-sm text-muted-foreground">
                Share neighborhood truths and earn credits for verified reports.
              </p>
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <Button size="sm">Sign In</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" variant="outline">Sign Up</Button>
                </SignUpButton>
              </div>
            </CardContent>
          </Card>
        </SignedOut>
      )}

      {isClerkConfigured ? (
        <SignedIn>{formContent}</SignedIn>
      ) : (
        formContent
      )}
    </div>
  );
}
