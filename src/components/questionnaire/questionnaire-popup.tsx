"use client";

/**
 * QuestionnairePopup
 * ----------------
 * A system-level interactive modal that appears on the Feeds page whenever an
 * active questionnaire exists. It is deliberately styled to look premium and
 * human-designed — nothing like a regular feed post.
 *
 * Architecture follows the design blueprint:
 *   <QuestionnairePopup />        (this file — orchestrator + overlay + container)
 *     <QuestionnaireHeader />      (title, subtitle, countdown badge, close)
 *     <QuestionnaireSlider />      (multi-question horizontal slider + progress)
 *       <QuestionCard />           (single question wrapper)
 *         <QuestionOptions />      (choice / yes-no buttons)
 *         <QuestionRating />       (star rating)
 *         <QuestionTextInput />   (short / long text)
 *     <QuestionnaireActions />     (submit / skip / next)
 *     <QuestionnaireSuccess />     (confetti + thank-you, auto-close 2s)
 *
 * 24-hour logic:
 *   - Backend returns only active, non-expired questionnaires (effective
 *     expiry = expires_at ?? created_at + 24h).
 *   - Dismissal / submission state is persisted to localStorage, keyed per
 *     questionnaire + expiry, so a submitted or skipped popup won't reappear
 *     until the questionnaire expires.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  Star,
  Send,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───

export type QuestionType =
  | "text"
  | "textarea"
  | "single-choice"
  | "multiple-choice"
  | "rating"
  | "boolean";

export type QuestionnaireQuestion = {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type ActiveQuestionnaire = {
  id: number;
  title?: string;
  description?: string;
  questions: QuestionnaireQuestion[];
  expiresAt?: string;
};

type AnswerValue = string | number | boolean | string[];

// ─── Helpers ───

function normalizeType(t: string): QuestionType {
  const s = (t || "").toLowerCase().trim();
  if (["radio", "select", "single", "single-choice"].includes(s)) return "single-choice";
  if (["checkbox", "multi", "multiple", "multiple-choice"].includes(s)) return "multiple-choice";
  if (["boolean", "yes-no", "yesno", "yn"].includes(s)) return "boolean";
  if (s === "rating" || s === "stars" || s === "emoji") return "rating";
  if (s === "textarea" || s === "long-text") return "textarea";
  return "text";
}

function isAnswered(q: QuestionnaireQuestion, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `Expires in ${h}h ${m}m`;
  return `Expires in ${m}m`;
}

function dismissalKey(id: number, expiresAt?: string) {
  return `questionnaire-popup:${id}:${expiresAt ?? "no-expiry"}`;
}

function isDismissed(id: number, expiresAt?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(dismissalKey(id, expiresAt));
    if (!v) return false;
    const parsed = JSON.parse(v) as { until?: number };
    if (parsed.until && parsed.until <= Date.now()) {
      window.localStorage.removeItem(dismissalKey(id, expiresAt));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markDismissed(id: number, expiresAt?: string) {
  if (typeof window === "undefined") return;
  const until = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 24 * 60 * 60 * 1000;
  try {
    window.localStorage.setItem(
      dismissalKey(id, expiresAt),
      JSON.stringify({ until, at: Date.now() }),
    );
  } catch {
    /* storage may be unavailable — non-fatal */
  }
}

// ─── Question inputs ───

function QuestionOptions({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  const type = normalizeType(question.type);
  const options = question.options ?? [];

  if (type === "boolean") {
    const selected = typeof value === "string" ? value : "";
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {["Yes", "No"].map((opt) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-12 rounded-xl border text-sm font-medium transition-all active:scale-[0.98]",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (type === "multiple-choice") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((o) => o !== opt)
        : [...selected, opt];
      onChange(next);
    };
    return (
      <div className="space-y-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "w-full text-left rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.99] flex items-center justify-between gap-2",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <span className="truncate">{opt}</span>
              {active && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    );
  }

  // single-choice
  const selected = typeof value === "string" ? value : "";
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "w-full text-left rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.99] flex items-center justify-between gap-2",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <span className="truncate">{opt}</span>
            {active && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function QuestionRating({
  value,
  onChange,
}: {
  value: AnswerValue | undefined;
  onChange: (v: number) => void;
}) {
  const rating = typeof value === "number" ? value : 0;
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover || rating) >= star;
        return (
          <motion.button
            key={star}
            type="button"
            whileTap={{ scale: 0.85 }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="p-1"
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
              )}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

function QuestionTextInput({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (v: string) => void;
}) {
  const isLong = normalizeType(question.type) === "textarea";
  const current = typeof value === "string" ? value : "";
  return (
    <textarea
      value={current}
      onChange={(e) => onChange(e.target.value)}
      rows={isLong ? 4 : 2}
      maxLength={isLong ? 1000 : 300}
      placeholder={question.placeholder || "Type your answer..."}
      className={cn(
        "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors resize-none placeholder:text-muted-foreground/60",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
      )}
    />
  );
}

// ─── Question card ───

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  const type = normalizeType(question.type);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-start gap-2">
        <p className="text-[17px] font-semibold leading-snug text-foreground">
          {question.text}
        </p>
        {question.required && <span className="mt-0.5 text-red-500">*</span>}
      </div>
      <div className="flex-1">
        {type === "rating" ? (
          <QuestionRating value={value} onChange={(v) => onChange(v)} />
        ) : type === "text" || type === "textarea" ? (
          <QuestionTextInput question={question} value={value} onChange={onChange} />
        ) : (
          <QuestionOptions question={question} value={value} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

// ─── Slider ───

function QuestionnaireSlider({
  questions,
  current,
  answers,
  onAnswer,
}: {
  questions: QuestionnaireQuestion[];
  current: number;
  answers: Record<string, AnswerValue>;
  onAnswer: (id: string, v: AnswerValue) => void;
}) {
  const total = questions.length;
  const pct = total > 1 ? (current / (total - 1)) * 100 : 100;
  const q = questions[current];

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          Question {current + 1} of {total}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${Math.max(8, pct)}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* Slider track */}
      <div className="overflow-hidden">
        <motion.div
          className="flex"
          animate={{ x: `-${current * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
        >
          {questions.map((question, i) => (
            <div key={question.id} className="w-full shrink-0 px-0.5">
              <div className="min-h-[180px]">
                {i === current ? (
                  <QuestionCard
                    question={question}
                    value={answers[question.id]}
                    onChange={(v) => onAnswer(question.id, v)}
                  />
                ) : (
                  <div className="opacity-0 select-none pointer-events-none">
                    <QuestionCard
                      question={question}
                      value={answers[question.id]}
                      onChange={(v) => onAnswer(question.id, v)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Actions ───

function QuestionnaireActions({
  isLast,
  canProceed,
  canGoBack,
  submitting,
  onBack,
  onNext,
  onSubmit,
  onSkip,
}: {
  isLast: boolean;
  canProceed: boolean;
  canGoBack: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-5 space-y-2.5">
      <button
        type="button"
        onClick={isLast ? onSubmit : onNext}
        disabled={submitting || (isLast ? false : !canProceed)}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary-foreground shadow-sm transition-all active:scale-[0.99]",
          "bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:active:scale-100",
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : isLast ? (
          <>
            <Send className="h-4 w-4" />
            Submit
          </>
        ) : (
          <>
            Next
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            !canGoBack && "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ─── Success ───

function QuestionnaireSuccess({ title }: { title: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        color: ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ef4444"][i % 5],
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  return (
    <div className="relative flex flex-col items-center justify-center py-8 text-center">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            className="absolute top-2 rounded-sm"
            style={{ left: `${p.left}%`, width: p.size, height: p.size, backgroundColor: p.color }}
            initial={{ y: -10, opacity: 1, rotate: 0 }}
            animate={{ y: 320, opacity: [1, 1, 0], rotate: 360 }}
            transition={{ duration: 1.8, delay: p.delay, ease: "easeIn" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon-green/15"
      >
        <Check className="h-7 w-7 text-neon-green" />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">Thank you for participating!</h3>
      {title && <p className="mt-1 text-xs text-muted-foreground">{title}</p>}
    </div>
  );
}

// ─── Header ───

function QuestionnaireHeader({
  title,
  subtitle,
  remainingMs,
  onClose,
}: {
  title: string;
  subtitle: string;
  remainingMs: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <ClipboardList className="h-4 w-4 text-primary" />
          </span>
          <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <p className="mt-0.5 pl-9 text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
          <Clock className="h-3 w-3" />
          {formatRemaining(remainingMs)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close questionnaire"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main popup ───

export function QuestionnairePopup() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [success, setSuccess] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  // Fetch the active (non-expired) questionnaire.
  const { data } = useQuery<{ questionnaires: ActiveQuestionnaire[] }>({
    queryKey: ["/api/questionnaire/active"],
  });

  const questionnaire = data?.questionnaires?.[0];
  const questions = questionnaire?.questions ?? [];

  // Decide whether to show, respecting 24h dismissal state in localStorage.
  useEffect(() => {
    if (!questionnaire || questions.length === 0) {
      setOpen(false);
      return;
    }
    if (isDismissed(questionnaire.id, questionnaire.expiresAt)) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setCurrent(0);
    setAnswers({});
    setSuccess(false);
  }, [questionnaire?.id, questions.length, questionnaire?.expiresAt]);

  // Live countdown badge + auto-close on expiry.
  useEffect(() => {
    if (!open || !questionnaire?.expiresAt) return;
    const tick = () => {
      const diff = new Date(questionnaire.expiresAt!).getTime() - Date.now();
      setRemainingMs(diff);
      if (diff <= 0) {
        markDismissed(questionnaire.id, questionnaire.expiresAt);
        setOpen(false);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [open, questionnaire?.id, questionnaire?.expiresAt]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionnaire?.id, questionnaire?.expiresAt]);

  const handleClose = useCallback(() => {
    if (questionnaire) markDismissed(questionnaire.id, questionnaire.expiresAt);
    setOpen(false);
  }, [questionnaire]);

  const handleSkip = useCallback(() => {
    if (questionnaire) markDismissed(questionnaire.id, questionnaire.expiresAt);
    setOpen(false);
    toast({ title: "Questionnaire skipped", description: "You can answer it later before it expires." });
  }, [questionnaire, toast]);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/questionnaire/answer", {
        questionnaireId: questionnaire?.id,
        responses: answers,
      }),
    onSuccess: () => {
      setSuccess(true);
      if (questionnaire) markDismissed(questionnaire.id, questionnaire.expiresAt);
      // Auto-close 2s after the success animation.
      setTimeout(() => setOpen(false), 2000);
    },
    onError: (err: Error) => {
      toast({
        title: "Could not submit",
        description: err.message?.replace(/^\d{3}:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!open || !questionnaire || questions.length === 0) return null;

  const total = questions.length;
  const q = questions[current];
  const isLast = current === total - 1;
  const canProceed = isAnswered(q, answers[q.id]) || !q.required;

  const handleNext = () => {
    if (!canProceed) {
      toast({ title: "Please answer this question", variant: "destructive" });
      return;
    }
    setCurrent((c) => Math.min(c + 1, total - 1));
  };
  const handleBack = () => setCurrent((c) => Math.max(c - 1, 0));

  const handleSubmit = () => {
    // Validate all required questions across the whole flow.
    const missing = questions.filter(
      (qq) => qq.required && !isAnswered(qq, answers[qq.id]),
    );
    if (missing.length > 0) {
      const idx = questions.findIndex((x) => x.id === missing[0].id);
      if (idx >= 0) setCurrent(idx);
      toast({ title: "Please answer all required questions", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  const title = questionnaire.title || "Questionnaire";
  const subtitle = questionnaire.description || "Share your opinion";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="questionnaire-title"
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[520px] overflow-hidden rounded-t-[24px] sm:rounded-[24px] border border-white/40 bg-white/80 dark:bg-card/80 shadow-2xl backdrop-blur-xl sm:mx-auto"
          >
            {/* Accent gradient header strip */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-warm-orange via-electric-blue to-purple-glow" />

            <div className="max-h-[90vh] overflow-y-auto px-5 pb-5 pt-5 sm:px-6">
              {success ? (
                <QuestionnaireSuccess title={title} />
              ) : (
                <>
                  <QuestionnaireHeader
                    title={title}
                    subtitle={subtitle}
                    remainingMs={remainingMs}
                    onClose={handleClose}
                  />

                  <div className="mt-4">
                    <QuestionnaireSlider
                      questions={questions}
                      current={current}
                      answers={answers}
                      onAnswer={(id, v) =>
                        setAnswers((prev) => ({ ...prev, [id]: v }))
                      }
                    />
                  </div>

                  <QuestionnaireActions
                    isLast={isLast}
                    canProceed={canProceed}
                    canGoBack={current > 0}
                    submitting={submitMutation.isPending}
                    onBack={handleBack}
                    onNext={handleNext}
                    onSubmit={handleSubmit}
                    onSkip={handleSkip}
                  />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QuestionnairePopup;
