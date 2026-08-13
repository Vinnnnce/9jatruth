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
  Clock, BarChart3, Plus, X, Upload, Image as ImageIcon, Video, RotateCw, RotateCcw, Crop,
  Wand2, Trash2, Film, AlertTriangle, Loader2, Scissors,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useLiveLocation } from "@/hooks/use-live-location";
import { useAgencyAuth } from "@/hooks/use-agency-auth";
import { CATEGORY_LIST } from "@/lib/categories";
import { useUser } from "@/lib/use-user-safe";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { VerifiedBadge } from "@/components/verified-badge";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

const categories = CATEGORY_LIST;

const MAX_VIDEO_SECONDS = 60;
const ASPECT_RATIOS = [
  { value: "free", label: "Free", ratio: null },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
const FILTERS = [
  { value: "none", label: "None", css: "none" },
  { value: "grayscale", label: "Grayscale", css: "grayscale(1)" },
  { value: "sepia", label: "Sepia", css: "sepia(1)" },
  { value: "brighten", label: "Brighten", css: "brightness(1.4)" },
  { value: "contrast", label: "Contrast", css: "contrast(1.5)" },
] as const;

const ACCEPTED_MEDIA = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

type MediaItem = {
  id: string;
  kind: "image" | "video";
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  rotation: number;
  filter: string;
  aspectRatio: string;
  editedPreview: string | null;
  hasEdits: boolean;
  duration: number;
  trimStart: number;
  trimEnd: number;
  overLimit: boolean;
  thumbDataUrl: string | null;
};

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

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
  // Format is "STATUS: body" where body may be JSON like {"message":"..."}
  const idx = msg.indexOf(":");
  let body = idx > 0 ? msg.substring(idx + 1).trim() : msg;
  // Try to parse JSON response body
  try {
    const parsed = JSON.parse(body);
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON, return as-is
  }
  return body;
}

export default function SubmitTruth() {
  const [neighborhoodInput, setNeighborhoodInput] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [postAsOrg, setPostAsOrg] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number | null; lng: number | null; region: string | null; city: string | null } | null>(null);
  const [detectingLoc, setDetectingLoc] = useState(false);

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  // Poll
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Media upload
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lat, lng, requestLocation, loading: locLoading } = useLiveLocation();
  const { auth, loading: authLoading } = useAgencyAuth();
  const isAgencyAuth = !!auth?.account;
  const hasOrganization = !!auth?.organization;
  const { isSignedIn, isLoaded } = useUser();

  // Auto-detect user's real location via GPS first (works even with VPN), then IP fallback
  useEffect(() => {
    if (detectedLocation) return;

    // Try GPS first — browser geolocation uses GPS/WiFi/Cell triangulation, not IP,
    // so it gives the user's real location even when they're on a VPN
    if (navigator.geolocation) {
      setDetectingLoc(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
            // Reverse geocode using MapTiler or OpenStreetMap
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
              { headers: { "Accept-Language": "en" } }
            );
            const geoData = await geoRes.json();
            const address = geoData?.address || {};
            const city = address.city || address.town || address.village || address.suburb || address.county || "";
            const region = address.state || address.region || "";
            const loc = { lat: latitude, lng: longitude, region, city };
            setDetectedLocation(loc);
            if (city && !neighborhoodInput) {
              setNeighborhoodInput(city);
            }
          } catch {
            // Reverse geocoding failed — still use GPS coordinates
            const loc = { lat: latitude, lng: longitude, region: null, city: null };
            setDetectedLocation(loc);
          } finally {
            setDetectingLoc(false);
          }
        },
        () => {
          // GPS denied or failed — fall back to IP-based detection
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
                if (loc.city && !neighborhoodInput) {
                  setNeighborhoodInput(loc.city);
                }
              }
            })
            .catch(() => {})
            .finally(() => setDetectingLoc(false));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
      return;
    }

    // No geolocation API — use IP detection
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
          if (loc.city && !neighborhoodInput) {
            setNeighborhoodInput(loc.city);
          }
        }
      })
      .catch(() => {})
      .finally(() => setDetectingLoc(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutation = useMutation({
    mutationFn: (data: { neighborhoodName: string; category: string; content: string; reportLat?: number; reportLng?: number; locationSource?: string; mediaUrls?: string[] }) => {
      const endpoint = postAsOrg && isAgencyAuth ? "/api/organizations/me/truths" : "/api/truths";
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: async () => {
      toast({
        title: "Truth submitted",
        description: "Your micro-truth has been received and is being verified. +20 credits earned!",
      });

      // If poll is enabled, create the poll
      if (pollEnabled && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        createPollMutation.mutate({
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.trim()),
        });
      }

      setCategory("");
      setContent("");
      setNeighborhoodInput("");
      setPostAsOrg(false);
      setMediaItems([]);
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

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (data: { contentType: string; payload: any; scheduledAt: string }) =>
      apiRequest("POST", "/api/schedule", data),
    onSuccess: () => {
      toast({
        title: "Post scheduled",
        description: "Your post will be published at the scheduled time.",
      });
      setCategory("");
      setContent("");
      setNeighborhoodInput("");
      setScheduleEnabled(false);
      setScheduleAt("");
      setMediaItems([]);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to schedule", description: err.message, variant: "destructive" });
    },
  });

  // Poll creation mutation (called after truth submission if poll is enabled)
  const createPollMutation = useMutation({
    mutationFn: (data: { question: string; options: string[]; contentId?: number }) =>
      apiRequest("POST", "/api/polls", data),
    onSuccess: () => {
      toast({ title: "Poll created", description: "Your poll is now live." });
      setPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
    },
    onError: () => {
      toast({ title: "Poll creation failed", variant: "destructive" });
    },
  });

  // ── Media helpers ──

  const updateMedia = (id: string, patch: Partial<MediaItem>) => {
    setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const uploadMediaFile = async (id: string, file: File, duration?: number) => {
    updateMedia(id, { uploading: true });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (duration !== undefined) fd.append("duration", String(duration));
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.message || "Upload failed");
      }
      updateMedia(id, { uploadedUrl: data.url, uploading: false });
      return data.url as string;
    } catch (err: any) {
      updateMedia(id, { uploading: false });
      toast({
        title: "Media upload failed",
        description: err?.message || "Could not upload media.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast({ title: "Unsupported file", description: file.name, variant: "destructive" });
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const item: MediaItem = {
        id,
        kind: isImage ? "image" : "video",
        file,
        previewUrl,
        uploadedUrl: null,
        uploading: false,
        rotation: 0,
        filter: "none",
        aspectRatio: "free",
        editedPreview: null,
        hasEdits: false,
        duration: 0,
        trimStart: 0,
        trimEnd: 0,
        overLimit: false,
        thumbDataUrl: null,
      };
      setMediaItems((prev) => [...prev, item]);

      if (isVideo) {
        // Load video metadata to get duration and capture a thumbnail frame
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = previewUrl;
        video.addEventListener("loadedmetadata", async () => {
          const duration = video.duration || 0;
          const over = duration > MAX_VIDEO_SECONDS;
          const trimEnd = over ? MAX_VIDEO_SECONDS : duration;
          updateMedia(id, {
            duration,
            trimStart: 0,
            trimEnd,
            overLimit: over,
          });
          // Capture a frame at 0s for the thumbnail
          try {
            video.currentTime = Math.min(0.1, duration / 2);
            video.addEventListener("seeked", () => {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth || 160;
              canvas.height = video.videoHeight || 90;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                updateMedia(id, { thumbDataUrl: canvas.toDataURL("image/jpeg", 0.7) });
              }
            }, { once: true });
          } catch {
            // ignore thumbnail errors
          }
          // Upload original video, passing the trimmed segment length as duration
          await uploadMediaFile(id, file, Math.min(trimEnd, MAX_VIDEO_SECONDS));
        }, { once: true });
        video.addEventListener("error", () => {
          toast({ title: "Could not read video", description: file.name, variant: "destructive" });
        }, { once: true });
      } else {
        // Image — render to canvas with default edits and upload edited blob
        await applyImageEdits(id, file, 0, "none", "free");
      }
    }
  };

  /** Render image with rotation + filter + crop aspect to a canvas, return blob */
  const renderImageToCanvas = (
    img: HTMLImageElement,
    rotation: number,
    filterCss: string,
    aspectRatio: number | null
  ): HTMLCanvasElement => {
    const swap = rotation === 90 || rotation === 270;
    const naturalW = swap ? img.naturalHeight : img.naturalWidth;
    const naturalH = swap ? img.naturalWidth : img.naturalHeight;

    // Determine crop box for aspect ratio
    let cropW = naturalW;
    let cropH = naturalH;
    if (aspectRatio) {
      if (naturalW / naturalH > aspectRatio) {
        cropW = naturalH * aspectRatio;
      } else {
        cropH = naturalW / aspectRatio;
      }
    }
    const cropX = (naturalW - cropW) / 2;
    const cropY = (naturalH - cropH) / 2;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
    const outW = Math.round(cropW * scale);
    const outH = Math.round(cropH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    if (filterCss !== "none") ctx.filter = filterCss;
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // Draw centered; account for swap of dimensions and the crop offset
    ctx.drawImage(
      img,
      cropX, cropY, cropW, cropH,
      -outW / 2, -outH / 2, outW, outH
    );
    return canvas;
  };

  const applyImageEdits = async (
    id: string,
    file: File,
    rotation: number,
    filter: string,
    aspectRatio: string
  ) => {
    const ratio = ASPECT_RATIOS.find((a) => a.value === aspectRatio)?.ratio ?? null;
    const filterCss = FILTERS.find((f) => f.value === filter)?.css ?? "none";
    try {
      const img = await loadImage(file);
      const canvas = renderImageToCanvas(img, rotation, filterCss, ratio);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
      );
      const editedPreview = URL.createObjectURL(blob);
      setMediaItems((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (m.editedPreview) URL.revokeObjectURL(m.editedPreview);
          return {
            ...m,
            editedPreview,
            hasEdits: rotation !== 0 || filter !== "none" || aspectRatio !== "free",
          };
        })
      );
      // Upload the edited blob (as jpeg) and store returned URL
      const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      await uploadMediaFile(id, editedFile);
    } catch (err: any) {
      toast({ title: "Image edit failed", description: err?.message, variant: "destructive" });
    }
  };

  const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });

  const handleRotate = (id: string, dir: "left" | "right") => {
    const item = mediaItems.find((m) => m.id === id);
    if (!item) return;
    const rotation = (item.rotation + (dir === "right" ? 90 : 270)) % 360;
    updateMedia(id, { rotation });
    applyImageEdits(id, item.file, rotation, item.filter, item.aspectRatio);
  };

  const handleFilterChange = (id: string, filter: string) => {
    const item = mediaItems.find((m) => m.id === id);
    if (!item) return;
    updateMedia(id, { filter });
    applyImageEdits(id, item.file, item.rotation, filter, item.aspectRatio);
  };

  const handleAspectChange = (id: string, aspectRatio: string) => {
    const item = mediaItems.find((m) => m.id === id);
    if (!item) return;
    updateMedia(id, { aspectRatio });
    applyImageEdits(id, item.file, item.rotation, item.filter, aspectRatio);
  };

  const handleTrimChange = (id: string, start: number, end: number) => {
    const item = mediaItems.find((m) => m.id === id);
    if (!item) return;
    start = Math.max(0, Math.min(start, item.duration));
    end = Math.max(start, Math.min(end, item.duration));
    updateMedia(id, { trimStart: start, trimEnd: end });
  };

  const handleRemoveMedia = (id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.editedPreview) URL.revokeObjectURL(item.editedPreview);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

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

    // Build media URLs from uploaded items
    const mediaUrls = mediaItems
      .map((m) => m.uploadedUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    // If scheduling is enabled, create a scheduled post instead
    if (scheduleEnabled) {
      if (!scheduleAt) {
        toast({ title: "Select a date and time", variant: "destructive" });
        return;
      }
      const scheduledDate = new Date(scheduleAt);
      if (scheduledDate <= new Date()) {
        toast({ title: "Scheduled time must be in the future", variant: "destructive" });
        return;
      }
      scheduleMutation.mutate({
        contentType: "truth",
        payload: {
          neighborhoodName: neighborhoodInput.trim(),
          category,
          content: content.trim(),
          reportLat: lat ?? undefined,
          reportLng: lng ?? undefined,
          locationSource: lat ? "gps" : "ip",
          mediaUrls,
        },
        scheduledAt: scheduledDate.toISOString(),
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
      mediaUrls,
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
                    ? "Detecting via GPS..."
                    : detectedLocation?.city && detectedLocation?.region
                    ? `${detectedLocation.city}, ${detectedLocation.region}`
                    : detectedLocation?.lat !== null && detectedLocation?.lat !== undefined
                    ? `GPS: ${detectedLocation.lat.toFixed(4)}, ${detectedLocation.lng?.toFixed(4)}`
                    : detectedLocation?.region || "Not detected"}
                </div>
                {detectedLocation?.lat !== null && detectedLocation?.lat !== undefined && !detectingLoc && (
                  <div className="text-[9px] text-green-500 flex items-center gap-0.5 mt-0.5">
                    <MapPin className="h-2 w-2" />
                    GPS location (works even with VPN)
                  </div>
                )}
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

          {/* Media upload */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Media
              {mediaItems.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{mediaItems.length}</Badge>
              )}
            </Label>

            <input
              type="file"
              accept={ACCEPTED_MEDIA}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="media-upload"
              data-testid="input-media-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs gap-2 border-dashed"
              onClick={() => document.getElementById("media-upload")?.click()}
              data-testid="button-media-add"
            >
              <Upload className="h-3.5 w-3.5" />
              Add photo or video
              <span className="text-[9px] text-muted-foreground font-normal">
                (jpg, png, webp, gif · mp4, webm · max 60s video)
              </span>
            </Button>

            <AnimatePresence>
              {mediaItems.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-md border border-border bg-muted/20 p-2 space-y-2"
                  data-testid={`media-item-${m.id}`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2">
                    {m.kind === "video" ? (
                      <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span className="text-[10px] truncate flex-1">{m.file.name}</span>
                    {m.uploading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {m.uploadedUrl && !m.uploading && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveMedia(m.id)}
                      data-testid={`button-media-remove-${m.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Preview */}
                  <div className="relative rounded overflow-hidden bg-black/5 max-h-44 flex items-center justify-center">
                    {m.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.editedPreview || m.previewUrl}
                        alt={m.file.name}
                        className="max-h-44 w-auto object-contain"
                      />
                    ) : (
                      <video
                        src={`${m.previewUrl}#t=${m.trimStart},${m.trimEnd}`}
                        poster={m.thumbDataUrl || undefined}
                        controls
                        muted
                        className="max-h-44 w-auto"
                      />
                    )}
                  </div>

                  {/* Image editing tools */}
                  {m.kind === "image" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => handleRotate(m.id, "left")}
                          data-testid={`button-rotate-left-${m.id}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Left
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => handleRotate(m.id, "right")}
                          data-testid={`button-rotate-right-${m.id}`}
                        >
                          <RotateCw className="h-3 w-3" />
                          Right
                        </Button>
                        <Select
                          value={m.aspectRatio}
                          onValueChange={(v) => handleAspectChange(m.id, v)}
                        >
                          <SelectTrigger
                            className="h-7 text-[10px] w-auto min-w-[72px] gap-1"
                            data-testid={`select-aspect-${m.id}`}
                          >
                            <Crop className="h-3 w-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIOS.map((a) => (
                              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={m.filter}
                          onValueChange={(v) => handleFilterChange(m.id, v)}
                        >
                          <SelectTrigger
                            className="h-7 text-[10px] w-auto min-w-[88px] gap-1 ml-auto"
                            data-testid={`select-filter-${m.id}`}
                          >
                            <Wand2 className="h-3 w-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTERS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {m.hasEdits && (
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Wand2 className="h-2.5 w-2.5" />
                          Edits applied
                        </p>
                      )}
                    </div>
                  )}

                  {/* Video trimmer */}
                  {m.kind === "video" && m.duration > 0 && (
                    <div className="space-y-1.5">
                      {m.overLimit && (
                        <p className="text-[9px] text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Video is {fmtTime(m.duration)} — trimmed to first {MAX_VIDEO_SECONDS}s
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Film className="h-3 w-3" />
                        <span>Trim segment</span>
                        <span className="ml-auto font-medium text-foreground">
                          {fmtTime(m.trimStart)} – {fmtTime(m.trimEnd)}
                        </span>
                        <span className="text-muted-foreground">
                          / {fmtTime(m.duration)}
                        </span>
                      </div>
                      {/* Start slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-8">Start</span>
                        <Slider
                          value={[m.trimStart]}
                          min={0}
                          max={m.duration}
                          step={0.5}
                          onValueChange={(v) => handleTrimChange(m.id, v[0], m.trimEnd)}
                          className="flex-1"
                        />
                      </div>
                      {/* End slider */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-8">End</span>
                        <Slider
                          value={[m.trimEnd]}
                          min={m.trimStart}
                          max={m.duration}
                          step={0.5}
                          onValueChange={(v) => handleTrimChange(m.id, m.trimStart, v[0])}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <Scissors className="h-2.5 w-2.5" />
                        Selected: {fmtTime(Math.max(0, m.trimEnd - m.trimStart))}
                        {m.trimEnd - m.trimStart > MAX_VIDEO_SECONDS && (
                          <span className="text-amber-500">(max {MAX_VIDEO_SECONDS}s)</span>
                        )}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
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

          {/* Schedule + Poll toggles */}
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Schedule toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-toggle"
                checked={scheduleEnabled}
                onCheckedChange={(v) => setScheduleEnabled(v === true)}
              />
              <Label htmlFor="schedule-toggle" className="text-xs flex items-center gap-1 cursor-pointer">
                <Clock className="h-3.5 w-3.5" />
                Schedule for later
              </Label>
              {scheduleEnabled && (
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="ml-auto w-auto h-8 text-xs"
                />
              )}
            </div>

            {/* Poll toggle */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="poll-toggle"
                  checked={pollEnabled}
                  onCheckedChange={(v) => setPollEnabled(v === true)}
                />
                <Label htmlFor="poll-toggle" className="text-xs flex items-center gap-1 cursor-pointer">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Attach a poll
                </Label>
              </div>
              {pollEnabled && (
                <div className="space-y-2 pl-6">
                  <Input
                    placeholder="Poll question (e.g., Is the power out in your area?)"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="h-8 text-xs"
                  />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                        className="h-8 text-xs"
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                    >
                      <Plus className="h-3 w-3" />
                      Add option
                    </Button>
                  )}
                </div>
              )}
            </div>
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
              disabled={mutation.isPending || scheduleMutation.isPending}
              data-testid="button-submit-truth"
              className="gap-2"
              size="sm"
            >
              {mutation.isPending || scheduleMutation.isPending ? (
                scheduleEnabled ? "Scheduling..." : "Submitting..."
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {scheduleEnabled ? "Schedule" : "Submit"}
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
