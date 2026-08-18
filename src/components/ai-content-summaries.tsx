"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FileText,
  Zap,
  TrendingUp,
  Lightbulb,
  ListChecks,
  Loader2,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

// ─── Types ───

export type SummaryLevel = "short" | "medium" | "deep";

export type SummaryProps = {
  articleId: string | number;
  title: string;
  content: string;
};

export type BatchSummaryProps = {
  articles: Array<{ id: string | number; title: string; content: string }>;
};

type SummaryResult = {
  summary: string[];
  keyInsights: string[];
  whyItMatters: string;
  actionableTakeaways: string[];
  source: "kimi" | "heuristic";
  level: SummaryLevel;
};

type CacheEntry = SummaryResult & { cachedAt: number };

const CACHE_PREFIX = "9jatruth:ai-summary:";
const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

const LEVEL_LABELS: Record<SummaryLevel, string> = {
  short: "Short",
  medium: "Medium",
  deep: "Deep",
};

// ─── localStorage cache helpers ───

function cacheKey(articleId: string | number, level: SummaryLevel) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${articleId}:${level}`;
}

function readCache(articleId: string | number, level: SummaryLevel): SummaryResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(articleId, level));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(articleId, level));
      return null;
    }
    const { cachedAt: _cachedAt, ...result } = parsed;
    return result;
  } catch {
    return null;
  }
}

function writeCache(articleId: string | number, level: SummaryLevel, result: SummaryResult) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { ...result, cachedAt: Date.now() };
    window.localStorage.setItem(cacheKey(articleId, level), JSON.stringify(entry));
  } catch {
    // localStorage may be full or unavailable (private browsing) — ignore.
  }
}

function clearCache(articleId: string | number) {
  if (typeof window === "undefined") return;
  try {
    (["short", "medium", "deep"] as SummaryLevel[]).forEach((level) => {
      window.localStorage.removeItem(cacheKey(articleId, level));
    });
  } catch {
    // ignore
  }
}

// ─── Local heuristic fallback summarizer (client-side, used if API is unreachable) ───

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "to",
  "of", "in", "on", "at", "by", "with", "as", "is", "was", "are", "were",
  "be", "been", "being", "it", "its", "this", "that", "these", "those",
  "he", "she", "they", "them", "his", "her", "their", "our", "we", "you",
  "your", "i", "me", "my", "mine", "us", "will", "would", "could", "should",
  "can", "may", "might", "must", "shall", "not", "no", "nor", "so", "than",
  "too", "very", "just", "about", "into", "over", "after", "before",
  "between", "out", "up", "down", "off", "again", "further", "once",
  "there", "here", "when", "where", "why", "how", "all", "any", "both",
  "each", "few", "more", "most", "other", "some", "such", "only", "own",
  "same", "from", "also", "has", "have", "had", "do", "does", "did",
  "said", "says", "according", "one", "two", "three",
]);

const IMPACT_KEYWORDS = [
  "impact", "affect", "significant", "important", "matter", "concern",
  "risk", "threat", "benefit", "consequence", "result", "lead to",
  "cause", "crucial", "critical", "essential", "danger", "warn",
  "increase", "decrease", "rise", "fall", "growth", "decline", "crisis",
  "because", "therefore", "as a result", "effect",
];

const ACTION_KEYWORDS = [
  "should", "must", "need to", "recommend", "urge", "call for", "plan",
  "propose", "announce", "launch", "implement", "advise", "suggest",
  "will", "going to", "next step", "action", "measure", "policy",
  "initiative", "response", "aim to", "seek to", "in order to",
];

const LEVEL_SENTENCE_COUNT: Record<SummaryLevel, number> = {
  short: 3,
  medium: 5,
  deep: 8,
};

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const rough = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleaned];
  return rough.map((s) => s.trim()).filter((s) => s.length > 20);
}

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function containsAny(sentence: string, keywords: string[]): boolean {
  const lower = sentence.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function localHeuristicSummarize(text: string, title: string, level: SummaryLevel): SummaryResult {
  const sentences = splitSentences(text);
  const targetCount = LEVEL_SENTENCE_COUNT[level];

  if (sentences.length === 0) {
    return {
      summary: [title ? `No detailed content available for "${title}".` : "No content available to summarize."],
      keyInsights: [],
      whyItMatters: "Not enough content was provided to determine impact.",
      actionableTakeaways: [],
      source: "heuristic",
      level,
    };
  }

  const freq: Record<string, number> = {};
  const tokenizedSentences = sentences.map(tokenize);
  for (const tokens of tokenizedSentences) {
    for (const word of tokens) freq[word] = (freq[word] || 0) + 1;
  }

  const scored = sentences.map((sentence, index) => {
    const tokens = tokenizedSentences[index];
    let score = tokens.reduce((sum, w) => sum + (freq[w] || 0), 0);
    score = tokens.length > 0 ? score / Math.sqrt(tokens.length) : 0;
    const positionBoost = index === 0 ? 1.5 : index < 3 ? 1.2 : 1;
    return { sentence, score: score * positionBoost, index };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const selectedCount = level === "deep" ? sentences.length : Math.min(targetCount, sentences.length);
  const summary = ranked
    .slice(0, selectedCount)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence.trim());

  const insightCount = level === "short" ? 2 : level === "medium" ? 3 : 5;
  const keyInsights = ranked
    .slice(0, Math.min(insightCount, ranked.length))
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence.trim());

  const impactSentences = sentences.filter((s) => containsAny(s, IMPACT_KEYWORDS));
  const whyItMatters =
    impactSentences.length > 0
      ? impactSentences.slice(0, 2).join(" ")
      : `${ranked[0]?.sentence?.trim() ?? "This story"} is relevant because it reflects developments that could influence public discussion, policy, or daily life for those affected.`;

  const actionSentences = sentences.filter((s) => containsAny(s, ACTION_KEYWORDS));
  const actionCount = level === "short" ? 2 : level === "medium" ? 3 : 4;
  const actionableTakeaways =
    actionSentences.length > 0
      ? actionSentences.slice(0, actionCount).map((s) => s.trim())
      : [
          "Stay informed by following official updates related to this story.",
          "Consider how this development may affect your community or interests.",
        ].slice(0, actionCount);

  return { summary, keyInsights, whyItMatters, actionableTakeaways, source: "heuristic", level };
}

// ─── Streaming fetch helper ───

/**
 * Calls POST /api/ai/summarize and progressively reveals fields as NDJSON
 * chunks arrive. Falls back to the local heuristic summarizer if the
 * request fails outright (network error, non-OK response, or no body).
 */
async function streamSummary(
  { title, content, level }: { title: string; content: string; level: SummaryLevel },
  onChunk: (partial: Partial<SummaryResult>) => void
): Promise<SummaryResult> {
  try {
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: content, title, level }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Summarize API responded with ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: SummaryResult | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "summary") onChunk({ summary: event.summary });
          else if (event.type === "keyInsights") onChunk({ keyInsights: event.keyInsights });
          else if (event.type === "whyItMatters") onChunk({ whyItMatters: event.whyItMatters });
          else if (event.type === "actionableTakeaways")
            onChunk({ actionableTakeaways: event.actionableTakeaways });
          else if (event.type === "done" && event.result) finalResult = event.result;
          else if (event.type === "error") throw new Error(event.message || "Streaming error");
        } catch {
          // Ignore malformed line, keep reading.
        }
      }
    }

    if (finalResult) return finalResult;
    throw new Error("Stream ended without a final result");
  } catch (err) {
    // Fall back to the local heuristic summarizer.
    const fallback = localHeuristicSummarize(content, title, level);
    onChunk(fallback);
    return fallback;
  }
}

/**
 * Batch streaming helper: sends the whole article list to the summarize API
 * in `batch` mode and invokes `onItem` as each article's summary arrives.
 * Falls back to per-article heuristic summarization on any failure.
 */
async function streamBatchSummary(
  articles: Array<{ id: string | number; title: string; content: string }>,
  level: SummaryLevel,
  onItem: (id: string | number, result: SummaryResult) => void,
): Promise<void> {
  try {
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        batch: articles.map((a) => ({ id: a.id, title: a.title, text: a.content })),
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Summarize API responded with ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "item" && event.id && event.result) {
            onItem(event.id, event.result as SummaryResult);
          } else if (event.type === "error") {
            throw new Error(event.message || "Batch streaming error");
          }
        } catch {
          // Ignore malformed line, keep reading.
        }
      }
    }
  } catch {
    // Fallback: summarize each article locally with the heuristic summarizer.
    for (const article of articles) {
      onItem(article.id, localHeuristicSummarize(article.content, article.title, level));
    }
  }
}

// ─── Progressive text reveal (simulated streaming for already-fetched text) ───

function useProgressiveReveal(fullText: string, active: boolean, speedMs = 12) {
  const [revealed, setRevealed] = React.useState(active ? "" : fullText);

  React.useEffect(() => {
    if (!active) {
      setRevealed(fullText);
      return;
    }
    setRevealed("");
    if (!fullText) return;
    let i = 0;
    const chunkSize = Math.max(1, Math.floor(fullText.length / 40));
    const interval = setInterval(() => {
      i += chunkSize;
      setRevealed(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, speedMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, active]);

  return revealed;
}

// ─── Single-article summary component ───

export function AIContentSummaries({ articleId, title, content }: SummaryProps) {
  const { toast } = useToast();
  const [level, setLevel] = React.useState<SummaryLevel>("short");
  const [result, setResult] = React.useState<SummaryResult | null>(null);
  const [partial, setPartial] = React.useState<Partial<SummaryResult>>({});
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(true);
  const [insightsOpen, setInsightsOpen] = React.useState(true);
  const [mattersOpen, setMattersOpen] = React.useState(true);
  const [takeawaysOpen, setTakeawaysOpen] = React.useState(true);
  const requestIdRef = React.useRef(0);

  const activeResult = result ?? (Object.keys(partial).length ? (partial as SummaryResult) : null);
  const whyMattersRevealed = useProgressiveReveal(activeResult?.whyItMatters ?? "", loading);

  const runSummarize = React.useCallback(
    async (targetLevel: SummaryLevel, options?: { force?: boolean }) => {
      const cached = !options?.force ? readCache(articleId, targetLevel) : null;
      if (cached) {
        setResult(cached);
        setPartial({});
        return cached;
      }

      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      setResult(null);
      setPartial({});

      try {
        const finalResult = await streamSummary(
          { title, content, level: targetLevel },
          (chunk) => {
            if (requestIdRef.current !== myRequestId) return;
            setPartial((prev) => ({ ...prev, ...chunk }));
          }
        );

        if (requestIdRef.current === myRequestId) {
          setResult(finalResult);
          writeCache(articleId, targetLevel, finalResult);
        }
        return finalResult;
      } catch (err) {
        toast({
          title: "Summarization failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
        return null;
      } finally {
        if (requestIdRef.current === myRequestId) setLoading(false);
      }
    },
    [articleId, title, content, toast]
  );

  const handleLevelChange = (newLevel: SummaryLevel) => {
    setLevel(newLevel);
    const cached = readCache(articleId, newLevel);
    if (cached) {
      setResult(cached);
      setPartial({});
    } else {
      setResult(null);
      setPartial({});
    }
  };

  const handleGenerate = () => {
    void runSummarize(level);
  };

  const handleRegenerate = () => {
    clearCache(articleId);
    void runSummarize(level, { force: true });
  };

  return (
    <Card className="border-border/60 overflow-hidden" data-testid={`ai-summary-card-${articleId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Summary
              <Badge variant="outline" className="text-[9px]">
                {activeResult?.source === "kimi" ? "Kimi AI" : activeResult?.source === "heuristic" ? "Local AI" : "AI-Powered"}
              </Badge>
            </CardTitle>
            <CardDescription className="line-clamp-1">{title}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse summary" : "Expand summary"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "")} />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 pt-2">
          {(["short", "medium", "deep"] as SummaryLevel[]).map((lvl) => (
            <Button
              key={lvl}
              type="button"
              size="sm"
              variant={level === lvl ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => handleLevelChange(lvl)}
              disabled={loading}
              data-testid={`button-level-${lvl}`}
            >
              {LEVEL_LABELS[lvl]}
            </Button>
          ))}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {!activeResult && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Generate an AI-powered {LEVEL_LABELS[level].toLowerCase()} summary of this article.
              </p>
              <Button onClick={handleGenerate} size="sm" className="mt-1" data-testid="button-generate-summary">
                <Sparkles className="h-4 w-4" />
                Generate Summary
              </Button>
            </div>
          )}

          {loading && !activeResult && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {activeResult && (
            <>
              {/* Bullet Summary */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Summary
                </p>
                {(activeResult.summary?.length ?? 0) > 0 ? (
                  <ul className="space-y-1">
                    {activeResult.summary!.map((point, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/90">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : loading ? (
                  <Skeleton className="h-4 w-full" />
                ) : null}
              </div>

              {/* Key Insights */}
              <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Key Insights
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", insightsOpen ? "rotate-180" : "")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1.5">
                  {(activeResult.keyInsights?.length ?? 0) > 0 ? (
                    <ul className="space-y-1">
                      {activeResult.keyInsights!.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/90">
                          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : loading ? (
                    <Skeleton className="h-4 w-4/5" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No key insights available.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Why This Matters */}
              <Collapsible open={mattersOpen} onOpenChange={setMattersOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-xs font-medium text-cyan-600 dark:text-cyan-400"
                  >
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Why This Matters
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", mattersOpen ? "rotate-180" : "")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1.5">
                  {activeResult.whyItMatters ? (
                    <p className="text-sm text-foreground/90 rounded-md bg-cyan-500/5 border border-cyan-500/10 p-2.5">
                      {loading ? whyMattersRevealed : activeResult.whyItMatters}
                    </p>
                  ) : loading ? (
                    <Skeleton className="h-4 w-full" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No context available.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Actionable Takeaways */}
              <Collapsible open={takeawaysOpen} onOpenChange={setTakeawaysOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" />
                      Actionable Takeaways
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", takeawaysOpen ? "rotate-180" : "")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1.5">
                  {(activeResult.actionableTakeaways?.length ?? 0) > 0 ? (
                    <ul className="space-y-1">
                      {activeResult.actionableTakeaways!.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/90">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : loading ? (
                    <Skeleton className="h-4 w-3/5" />
                  ) : (
                    <p className="text-xs text-muted-foreground">No takeaways identified.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      )}

      {expanded && activeResult && (
        <CardFooter className="justify-between border-t border-border/60 pt-3">
          <span className="text-[10px] text-muted-foreground">
            {loading ? "Generating…" : "Cached locally for faster reloads"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleRegenerate}
            disabled={loading}
            data-testid="button-regenerate-summary"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Regenerate
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Batch summarization component ───

type BatchStatus = "idle" | "pending" | "done" | "error";

export function BatchAISummaries({ articles }: BatchSummaryProps) {
  const { toast } = useToast();
  const [level, setLevel] = React.useState<SummaryLevel>("short");
  const [statuses, setStatuses] = React.useState<Record<string, BatchStatus>>({});
  const [results, setResults] = React.useState<Record<string, SummaryResult>>({});
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const idOf = (id: string | number) => String(id);

  const summarizeOne = React.useCallback(
    async (article: { id: string | number; title: string; content: string }, targetLevel: SummaryLevel) => {
      const key = idOf(article.id);
      const cached = readCache(article.id, targetLevel);
      if (cached) {
        setResults((prev) => ({ ...prev, [key]: cached }));
        setStatuses((prev) => ({ ...prev, [key]: "done" }));
        return;
      }

      setStatuses((prev) => ({ ...prev, [key]: "pending" }));
      try {
        const finalResult = await streamSummary(
          { title: article.title, content: article.content, level: targetLevel },
          () => {
            /* batch mode doesn't render intermediate chunks per-card, only final */
          }
        );
        setResults((prev) => ({ ...prev, [key]: finalResult }));
        setStatuses((prev) => ({ ...prev, [key]: "done" }));
        writeCache(article.id, targetLevel, finalResult);
      } catch {
        setStatuses((prev) => ({ ...prev, [key]: "error" }));
      }
    },
    []
  );

  const handleSummarizeAll = React.useCallback(async () => {
    if (articles.length === 0) return;
    setRunning(true);
    setProgress(0);

    // First, try the batch streaming endpoint (single request, streamed
    // per-article results). Falls back to per-article requests if it errors.
    let usedBatchStream = false;
    try {
      // Mark all as pending up front.
      setStatuses((prev) => {
        const next = { ...prev };
        for (const a of articles) next[idOf(a.id)] = "pending";
        return next;
      });

      let completed = 0;
      await streamBatchSummary(articles, level, (id, result) => {
        const key = idOf(id);
        setResults((prev) => ({ ...prev, [key]: result }));
        setStatuses((prev) => ({ ...prev, [key]: "done" }));
        writeCache(id, level, result);
        completed += 1;
        setProgress(Math.round((completed / articles.length) * 100));
      });
      usedBatchStream = true;
    } catch {
      usedBatchStream = false;
    }

    // Fallback: per-article requests for anything still pending.
    if (!usedBatchStream) {
      const CONCURRENCY = 3;
      let completed = 0;
      let index = 0;

      async function worker() {
        while (index < articles.length) {
          const current = articles[index++];
          await summarizeOne(current, level);
          completed += 1;
          setProgress(Math.round((completed / articles.length) * 100));
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, articles.length) }, worker));
    }

    toast({
      title: "Batch summarization complete",
      description: `Summarized ${articles.length} article${articles.length === 1 ? "" : "s"}.`,
    });
    setRunning(false);
  }, [articles, level, summarizeOne, toast]);

  const doneCount = Object.values(statuses).filter((s) => s === "done").length;

  return (
    <Card className="border-border/60" data-testid="batch-ai-summary-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Batch AI Summaries
              <Badge variant="outline" className="text-[9px]">
                {articles.length} article{articles.length === 1 ? "" : "s"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Generate AI summaries for all loaded news articles at once.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {(["short", "medium", "deep"] as SummaryLevel[]).map((lvl) => (
              <Button
                key={lvl}
                type="button"
                size="sm"
                variant={level === lvl ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setLevel(lvl)}
                disabled={running}
                data-testid={`button-batch-level-${lvl}`}
              >
                {LEVEL_LABELS[lvl]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Button
          onClick={handleSummarizeAll}
          disabled={running || articles.length === 0}
          className="w-full sm:w-auto"
          data-testid="button-summarize-all"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? `Summarizing… (${doneCount}/${articles.length})` : "Summarize All News"}
        </Button>

        {running && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="space-y-2">
          {articles.map((article) => {
            const key = idOf(article.id);
            const status = statuses[key] ?? "idle";
            const result = results[key];
            const isOpen = openId === key;

            return (
              <Collapsible
                key={key}
                open={isOpen}
                onOpenChange={(open) => setOpenId(open ? key : null)}
              >
                <div className="rounded-md border border-border/60 p-2.5">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      disabled={status !== "done"}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {status === "pending" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                        {status === "done" && <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {status === "error" && <FileText className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {status === "idle" && <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                        <span className="truncate text-sm font-medium">{article.title}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={status === "done" ? "default" : status === "error" ? "destructive" : "outline"}
                          className="text-[9px]"
                        >
                          {status === "idle" && "Pending"}
                          {status === "pending" && "Summarizing…"}
                          {status === "done" && (result?.source === "kimi" ? "Kimi AI" : "Local AI")}
                          {status === "error" && "Failed"}
                        </Badge>
                        {status === "done" && (
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")} />
                        )}
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  {status === "pending" && (
                    <div className="mt-2 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  )}

                  <CollapsibleContent className="mt-2.5 space-y-2.5 pt-2 border-t border-border/50">
                    {result && (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-primary flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Summary
                          </p>
                          <ul className="space-y-0.5">
                            {result.summary.map((point, i) => (
                              <li key={i} className="flex gap-1.5 text-xs text-foreground/90">
                                <span className="text-primary">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {result.keyInsights.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> Key Insights
                            </p>
                            <ul className="space-y-0.5">
                              {result.keyInsights.map((point, i) => (
                                <li key={i} className="flex gap-1.5 text-xs text-foreground/90">
                                  <Zap className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.whyItMatters && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" /> Why This Matters
                            </p>
                            <p className="text-xs text-foreground/90 rounded bg-cyan-500/5 border border-cyan-500/10 p-2">
                              {result.whyItMatters}
                            </p>
                          </div>
                        )}

                        {result.actionableTakeaways.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <ListChecks className="h-3 w-3" /> Actionable Takeaways
                            </p>
                            <ul className="space-y-0.5">
                              {result.actionableTakeaways.map((point, i) => (
                                <li key={i} className="flex gap-1.5 text-xs text-foreground/90">
                                  <span className="text-emerald-500">✓</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {articles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No articles available to summarize.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIContentSummaries;
