"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  XCircle,
  Archive,
  Award,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";

// ─── Types ───

type AdminArticle = {
  id: number;
  title: string;
  authorName: string;
  category: string;
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  createdAt: string;
  trustScore?: number;
};

type AdminResponse = {
  articles: AdminArticle[];
};

const STATUS_FILTERS = ["all", "draft", "pending_review", "published", "rejected", "archived"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return { className: "bg-muted text-muted-foreground", label: "Draft", Icon: FileText };
    case "pending_review":
      return { className: "bg-amber-500/15 text-amber-600", label: "Pending", Icon: Clock };
    case "published":
      return { className: "bg-green-500/15 text-green-600", label: "Published", Icon: CheckCircle2 };
    case "rejected":
      return { className: "bg-red-500/15 text-red-600", label: "Rejected", Icon: XCircle };
    case "archived":
      return { className: "bg-muted text-muted-foreground", label: "Archived", Icon: Archive };
    default:
      return { className: "", label: status, Icon: FileText };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ───

export function NewsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending_review");
  const [pendingAction, setPendingAction] = useState<{
    articleId: number;
    action: "verify" | "reject" | "archive" | "award";
    title: string;
  } | null>(null);

  const { data, isLoading } = useQuery<AdminResponse>({
    queryKey: ["/api/news/admin", statusFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/news/admin?status=${statusFilter}`);
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: (data: { articleId: number; action: string }) =>
      apiRequest("POST", `/api/news/admin/${data.articleId}/action`, { action: data.action }),
    onSuccess: (_d, variables) => {
      const labels: Record<string, string> = {
        verify: "Article verified and published",
        reject: "Article rejected",
        archive: "Article archived",
        award: "Accuracy incentive awarded",
      };
      toast({ title: labels[variables.action] || "Action completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/news/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news/feed"] });
      setPendingAction(null);
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const articles = data?.articles ?? [];

  const handleAction = (article: AdminArticle, action: "verify" | "reject" | "archive" | "award") => {
    setPendingAction({ articleId: article.id, action, title: article.title });
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    actionMutation.mutate({ articleId: pendingAction.articleId, action: pendingAction.action });
  };

  const actionDescriptions: Record<string, string> = {
    verify: "This will verify and publish the article, making it visible to all users.",
    reject: "This will reject the article. The author will be notified.",
    archive: "This will archive the article. It will no longer be visible in the feed.",
    award: "This will award the author an accuracy incentive (credits, badge, and trust score boost).",
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            News Administration
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">
                  {s === "all" ? "All" : s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No articles with this status.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {articles.map((article, i) => {
                const sb = statusBadge(article.status);
                const StatusIcon = sb.Icon;
                return (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{article.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{article.authorName}</span>
                          <Badge variant="outline" className="text-[9px]">{article.category}</Badge>
                          <span className="text-[9px] text-muted-foreground/70">{timeAgo(article.createdAt)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[9px] gap-0.5 shrink-0 ${sb.className}`}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {sb.label}
                      </Badge>
                    </div>

                    {/* Trust score */}
                    {typeof article.trustScore === "number" && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`h-3 w-3 ${article.trustScore >= 70 ? "text-green-500" : "text-amber-500"}`} />
                        <span className="text-[10px] text-muted-foreground">
                          Trust score: <span className="font-medium text-foreground">{article.trustScore}%</span>
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => handleAction(article, "verify")}
                        disabled={actionMutation.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => handleAction(article, "reject")}
                        disabled={actionMutation.isPending}
                      >
                        <XCircle className="h-3 w-3 text-red-500" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => handleAction(article, "archive")}
                        disabled={actionMutation.isPending}
                      >
                        <Archive className="h-3 w-3" />
                        Archive
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 ml-auto"
                        onClick={() => handleAction(article, "award")}
                        disabled={actionMutation.isPending}
                      >
                        <Award className="h-3 w-3 text-amber-500" />
                        Award
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      {/* ─── Confirmation dialog ─── */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">
              {pendingAction?.action === "award" ? "Award Accuracy Incentive" : `${pendingAction?.action} Article`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction && actionDescriptions[pendingAction.action]}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md bg-muted/30 p-2.5">
            <p className="text-xs font-medium">{pendingAction?.title}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={actionMutation.isPending}
              className={pendingAction?.action === "reject" ? "bg-red-500 hover:bg-red-500/90" : ""}
            >
              {actionMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default NewsAdmin;
