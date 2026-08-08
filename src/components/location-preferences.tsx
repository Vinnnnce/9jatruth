"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { MapPin, LocateFixed, Edit3, Check, X } from "lucide-react";
import { useUser } from "@/lib/use-user-safe";
import { SignInButton } from "@clerk/nextjs";

type LocationData = {
  detected: { region: string | null; city: string | null; lat: number | null; lng: number | null };
  preferred: {
    neighborhoodId: number; stateName: string; lgaName: string;
    communityName: string; regionName: string; lat: number; lng: number;
    source: string; updatedAt: string;
  } | null;
  neighborhoods: { id: number; name: string; region: string; lat: number; lng: number }[];
};

export function LocationPreferences() {
  const { isSignedIn, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");

  const { data, isLoading } = useQuery<LocationData>({
    queryKey: ["/api/user/location"],
    enabled: isLoaded && !!isSignedIn,
  });

  const saveMutation = useMutation({
    mutationFn: (neighborhoodId: number) =>
      apiRequest("PUT", "/api/user/location", { neighborhoodId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/location"] });
      toast({ title: "Location updated", description: "Your neighborhood preference has been saved." });
      setEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Please try again.", variant: "destructive" });
    },
  });

  if (!isLoaded) {
    return <Skeleton className="h-32" />;
  }

  if (!isSignedIn) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Your Location
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Sign in to set your neighborhood and get localized feeds.
          </p>
          <SignInButton mode="modal">
            <button className="text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors px-4 py-1.5 rounded-md">
              Sign In
            </button>
          </SignInButton>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  const preferred = data?.preferred;
  const detected = data?.detected;
  const neighborhoods = data?.neighborhoods || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Your Neighborhood
          </CardTitle>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setSelectedNeighborhood(preferred?.neighborhoodId?.toString() || "");
                setEditing(true);
              }}
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-3">
        {editing ? (
          <div className="space-y-3">
            <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select your neighborhood" />
              </SelectTrigger>
              <SelectContent>
                {neighborhoods.map((n) => (
                  <SelectItem key={n.id} value={n.id.toString()}>
                    {n.name} — {n.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!selectedNeighborhood || saveMutation.isPending}
                onClick={() => saveMutation.mutate(parseInt(selectedNeighborhood, 10))}
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setEditing(false)}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {preferred ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {neighborhoods.find((n) => n.id === preferred.neighborhoodId)?.name || "Custom"}
                  </Badge>
                  {preferred.stateName && (
                    <span className="text-[10px] text-muted-foreground">
                      {preferred.stateName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <LocateFixed className="h-3 w-3" />
                  Source: {preferred.source || "auto"}
                  {preferred.updatedAt && (
                    <span className="ml-1">
                      · Updated {new Date(preferred.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {detected?.region || detected?.city ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <LocateFixed className="h-3 w-3 text-primary" />
                      <span>Detected: {detected.city || detected.region}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Select your neighborhood for localized feeds.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Location not detected. Please select your neighborhood manually.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
