"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Star,
  RotateCcw,
  Send,
  Pencil,
  Sparkles,
} from "lucide-react";

type QuestionType = "radio" | "checkbox" | "text" | "textarea" | "rating" | "select" | "boolean";

interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

// Dynamic questionnaire definitions — can also be loaded from admin-created questionnaires
const DEFAULT_QUESTIONS: Question[] = [
  { id: "usage_frequency", question: "How often do you use 9jatruth?", type: "radio", options: ["Multiple times a day", "Once a day", "A few times a week", "Once a week", "Rarely"], required: true },
  { id: "primary_use", question: "What is your primary use for 9jatruth?", type: "select", options: ["Check community truths", "Report local issues", "View predictions", "Browse feeds", "Community engagement"], required: true },
  { id: "most_useful_feature", question: "Which features do you find most useful? (Select all that apply)", type: "checkbox", options: ["Feeds", "Predictions", "Geo Map", "Alerts", "Trends", "Submit Truth", "Leaderboard"], required: true },
  { id: "trust_level", question: "How much do you trust the truth reports on 9jatruth?", type: "rating", required: true },
  { id: "would_recommend", question: "Would you recommend 9jatruth to others?", type: "boolean", required: true },
  { id: "improvement_suggestion", question: "What would you like to see improved or added?", type: "textarea", placeholder: "Share your ideas for improving 9jatruth...", required: false },
];

function isAnswered(q: Question, answers: Record<string, any>): boolean {
  const ans = answers[q.id];
  if (!ans) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  return String(ans).trim().length > 0;
}

function QuestionInput({ q, answers, setAnswers, hoverRating, setHoverRating }: {
  q: Question;
  answers: Record<string, any>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  hoverRating: number;
  setHoverRating: (n: number) => void;
}) {
  if (q.type === "radio" && q.options) {
    return (
      <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} className="gap-3">
        {q.options.map((opt) => (
          <label key={opt} htmlFor={`${q.id}-${opt}`} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer transition-colors hover:border-primary/60 hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
            <span className="text-sm font-normal">{opt}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (q.type === "select" && q.options) {
    return (
      <Select value={answers[q.id] || ""} onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Select an answer..." /></SelectTrigger>
        <SelectContent>
          {q.options.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
        </SelectContent>
      </Select>
    );
  }
  if (q.type === "checkbox" && q.options) {
    const current: string[] = (answers[q.id] as string[]) || [];
    return (
      <div className="space-y-2">
        {q.options.map((opt) => {
          const isChecked = current.includes(opt);
          return (
            <label key={opt} htmlFor={`${q.id}-${opt}`} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer transition-colors hover:border-primary/60 hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <Checkbox
                id={`${q.id}-${opt}`}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const next = checked ? [...current, opt] : current.filter((o) => o !== opt);
                  setAnswers((p) => ({ ...p, [q.id]: next }));
                }}
              />
              <span className="text-sm font-normal">{opt}</span>
            </label>
          );
        })}
        {current.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {current.map((sel) => (<Badge key={sel} variant="secondary" className="text-[10px]">{sel}</Badge>))}
          </div>
        )}
      </div>
    );
  }
  if (q.type === "rating") {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setAnswers((p) => ({ ...p, [q.id]: star }))}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Star className={`h-8 w-8 transition-colors ${(hoverRating || answers[q.id] || 0) >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
          </motion.button>
        ))}
        {answers[q.id] ? (
          <span className="text-xs text-muted-foreground ml-3">{["", "Poor", "Fair", "Good", "Very Good", "Excellent"][answers[q.id]]}</span>
        ) : null}
      </div>
    );
  }
  if (q.type === "boolean") {
    return (
      <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} className="flex gap-3">
        {[
          { v: "yes", label: "Yes" },
          { v: "no", label: "No" },
        ].map((opt) => (
          <label key={opt.v} htmlFor={`${q.id}-${opt.v}`} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border/60 p-4 cursor-pointer transition-colors hover:border-primary/60 hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value={opt.v} id={`${q.id}-${opt.v}`} />
            <span className="text-sm font-medium">{opt.label}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (q.type === "text") {
    return <Input value={answers[q.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder={q.placeholder || "Type your answer..."} />;
  }
  return <Textarea value={answers[q.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder={q.placeholder || "Type your answer..."} className="min-h-[120px]" />;
}

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [hoverRating, setHoverRating] = useState(0);
  const [step, setStep] = useState(0); // 0..n-1 = questions, n = review, n+1 = success
  const { toast } = useToast();

  const { data: questionnaireData } = useQuery<{ questionnaires: any[] }>({
    queryKey: ["/api/questionnaire/manage", "active"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/questionnaire/manage?status=active");
        return res.json();
      } catch {
        return { questionnaires: [] };
      }
    },
  });

  const adminQ = questionnaireData?.questionnaires?.[0];
  const activeQuestionnaireId = adminQ?.id ?? null;

  const questions: Question[] = useMemo(() => {
    if (adminQ && adminQ.questions?.length > 0) {
      return adminQ.questions.map((q: any) => ({
        id: q.id,
        question: q.text,
        type: q.type as QuestionType,
        options: q.options,
        required: q.required,
        placeholder: q.placeholder,
      }));
    }
    return DEFAULT_QUESTIONS;
  }, [adminQ]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire submitted", description: "Thank you! Your responses have been sent to the admin dashboard." });
      setStep(questions.length + 1); // success state
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const totalSteps = questions.length + 1; // questions + review
  const progress = Math.min((step / totalSteps) * 100, 100);
  const onReview = step === questions.length;
  const onSuccess = step === questions.length + 1;

  const canAdvance = () => {
    if (onReview) return true;
    const q = questions[step];
    if (!q) return false;
    if (!q.required) return true;
    return isAnswered(q, answers);
  };

  const goNext = () => {
    if (!canAdvance()) {
      toast({ title: "This question is required", description: "Please answer before continuing." });
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    const missing = questions.filter((q) => q.required && !isAnswered(q, answers));
    if (missing.length > 0) {
      toast({ title: `${missing.length} required question(s) unanswered` });
      setStep(questions.findIndex((q) => q.required && !isAnswered(q, answers)));
      return;
    }
    submitMutation.mutate({
      questionnaireType: activeQuestionnaireId ? `admin_${activeQuestionnaireId}` : "user_experience",
      responses: answers,
    });
  };

  const reset = () => {
    setAnswers({});
    setStep(0);
    setHoverRating(0);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-display font-700">9jatruth Feedback Survey</h1>
        </div>
        <p className="text-sm text-muted-foreground">Help shape the future of the platform. Your responses go directly to the admin dashboard.</p>
      </motion.div>

      <Card className="overflow-hidden border-border/60">
        {!onSuccess && (
          <>
            {/* Progress bar */}
            <div className="border-b border-border/60 bg-card/50 px-5 py-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {onReview ? "Review your answers" : `Question ${step + 1} of ${questions.length}`}
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" data-testid="progress-questionnaire" />
              {/* Step dots */}
              <div className="flex items-center gap-1 pt-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= step ? "bg-primary" : "bg-muted"
                    } ${i === step ? "ring-2 ring-primary/30" : ""}`}
                    aria-label={`Go to question ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <CardContent className="p-6 md:p-8 min-h-[340px] flex flex-col">
          <AnimatePresence mode="wait">
            {onSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-10"
              >
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <CheckCircle2 className="h-9 w-9 text-green-500" />
                  </div>
                </motion.div>
                <div>
                  <h2 className="text-lg font-semibold">Thank you for your feedback</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">Your responses have been recorded and sent to the admin dashboard.</p>
                </div>
                <Button variant="outline" onClick={reset} className="gap-2 mt-2">
                  <RotateCcw className="h-4 w-4" /> Retake Survey
                </Button>
              </motion.div>
            ) : onReview ? (
              <motion.div key="review" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Review your answers</h2>
                </div>
                <div className="space-y-2">
                  {questions.map((q, i) => {
                    const ans = answers[q.id];
                    const display = Array.isArray(ans) ? ans.join(", ") : ans ? String(ans) : null;
                    return (
                      <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Q{i + 1}. {q.question}</p>
                          <p className="text-sm font-medium truncate">{display ?? <span className="text-muted-foreground/60 italic">Not answered</span>}</p>
                        </div>
                        {!isAnswered(q, answers) && q.required && <Badge variant="destructive" className="text-[9px]">Required</Badge>}
                        <Button size="sm" variant="ghost" className="h-7 gap-1 shrink-0" onClick={() => setStep(i)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col">
                {(() => {
                  const q = questions[step];
                  if (!q) return null;
                  return (
                    <div className="flex-1 flex flex-col">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{step + 1}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{q.type}</Badge>
                        {q.required && <span className="text-[10px] text-red-500">Required</span>}
                      </div>
                      <Label className="text-base font-medium mb-4 block">{q.question}</Label>
                      <div className="flex-1">
                        <QuestionInput q={q} answers={answers} setAnswers={setAnswers} hoverRating={hoverRating} setHoverRating={setHoverRating} />
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        {/* Footer nav */}
        {!onSuccess && (
          <div className="border-t border-border/60 px-5 py-4 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={goBack} disabled={step === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {!onReview && isAnswered(questions[step], answers) && (
                <Badge variant="secondary" className="text-[9px] gap-1"><CheckCircle2 className="h-3 w-3" /> Answered</Badge>
              )}
            </div>
            {onReview ? (
              <Button size="sm" onClick={handleSubmit} disabled={submitMutation.isPending} className="gap-2">
                {submitMutation.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>) : (<><Send className="h-4 w-4" /> Submit</>)}
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} className="gap-1">
                {step === questions.length - 1 ? "Review" : "Next"} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
