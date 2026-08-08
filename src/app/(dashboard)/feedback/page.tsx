"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Lightbulb,
  Bug,
  ThumbsUp,
  CheckCircle2,
  Clock,
  ArrowUp,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";

type Feedback = {
  id: number;
  clerkUserId: string | null;
  userHash: string | null;
  type: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  upvotes: number;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
};

const typeConfig: Record<string, { icon: typeof Lightbulb; color: string; label: string; bg: string }> = {
  suggestion: { icon: Lightbulb, color: "text-blue-500", label: "Suggestion", bg: "bg-blue-500/10" },
  bug: { icon: Bug, color: "text-red-500", label: "Bug Report", bg: "bg-red-500/10" },
  feature: { icon: Plus, color: "text-green-500", label: "Feature Request", bg: "bg-green-500/10" },
};

const statusConfig: Record<string, { color: string; label: string; icon: typeof Clock }> = {
  open: { color: "text-amber-500", label: "Open", icon: Clock },
  in_progress: { color: "text-blue-500", label: "In Progress", icon: MessageSquare },
  resolved: { color: "text-green-500", label: "Resolved", icon: CheckCircle2 },
  closed: { color: "text-muted-foreground", label: "Closed", icon: CheckCircle2 },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FeedbackPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    type: "suggestion" as string,
    title: "",
    description: "",
    category: "general" as string,
  });

  const { data: feedback, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback", filterType],
    queryFn: async ({ queryKey }) => {
      const [, type] = queryKey as [string, string];
      const url = type !== "all" ? `/api/feedback?type=${type}` : "/api/feedback";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted", description: "Thank you for your input!" });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setCreateOpen(false);
      setForm({ type: "suggestion", title: "", description: "", category: "general" });
    },
    onError: () => {
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (feedbackId: number) => {
      const res = await apiRequest("POST", `/api/feedback/${feedbackId}/upvote`);
      return res.json();
    },
    onMutate: (feedbackId: number) => {
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        if (next.has(feedbackId)) {
          next.delete(feedbackId);
        } else {
          next.add(feedbackId);
        }
        return next;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast({ title: "Please sign in to submit feedback" });
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feedback & Suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share what you want to see next on Soke, or report any issues you encounter
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Feedback</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suggestion">Suggestion</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="ui">UI/UX</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm" htmlFor="feedback-title">Title</Label>
                <Input
                  id="feedback-title"
                  placeholder="Brief summary of your feedback"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm" htmlFor="feedback-desc">Description</Label>
                <Textarea
                  id="feedback-desc"
                  placeholder="Describe your suggestion or the issue in detail"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1.5 min-h-[120px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "suggestion", "bug", "feature"].map((type) => (
          <Button
            key={type}
            variant={filterType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(type)}
          >
            {type === "all" ? "All" : typeConfig[type]?.label || type}
          </Button>
        ))}
      </div>

      {/* Feedback List — Changelog Style */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-5 w-3/4 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : feedback && feedback.length > 0 ? (
        <div className="space-y-3">
          {feedback.map((item) => {
            const typeCfg = typeConfig[item.type] || typeConfig.suggestion;
            const statusCfg = statusConfig[item.status] || statusConfig.open;
            const TypeIcon = typeCfg.icon;
            const StatusIcon = statusCfg.icon;
            const hasUpvoted = upvotedIds.has(item.id);

            return (
              <Card key={item.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Upvote */}
                    <button
                      onClick={() => upvoteMutation.mutate(item.id)}
                      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors ${
                        hasUpvoted
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <ArrowUp className={`h-4 w-4 ${hasUpvoted ? "fill-primary text-primary" : ""}`} />
                      <span className="text-xs font-medium">{item.upvotes}</span>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${typeCfg.bg}`}>
                          <TypeIcon className={`h-3 w-3 ${typeCfg.color}`} />
                          <span className={`text-[10px] font-medium ${typeCfg.color}`}>
                            {typeCfg.label}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          <span className="text-[10px] font-medium">{statusCfg.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium mb-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {item.description}
                      </p>

                      {/* Admin Response */}
                      {item.adminResponse && (
                        <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                          <p className="text-[10px] font-medium text-primary mb-0.5">
                            Team Response
                          </p>
                          <p className="text-xs text-muted-foreground">{item.adminResponse}</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[9px] capitalize">
                          {item.category}
                        </Badge>
                        {item.priority !== "medium" && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] capitalize ${
                              item.priority === "high" ? "text-red-500" : "text-muted-foreground"
                            }`}
                          >
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No feedback yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to share a suggestion or report an issue
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
