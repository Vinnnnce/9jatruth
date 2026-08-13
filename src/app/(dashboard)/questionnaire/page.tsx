"use client";

import { useState, useEffect } from "react";
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
import { ClipboardList, Send, Loader2, CheckCircle2, Star } from "lucide-react";

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
  {
    id: "usage_frequency",
    question: "How often do you use Soke?",
    type: "radio",
    options: ["Multiple times a day", "Once a day", "A few times a week", "Once a week", "Rarely"],
    required: true,
  },
  {
    id: "primary_use",
    question: "What is your primary use for Soke?",
    type: "select",
    options: ["Check community truths", "Report local issues", "View predictions", "Browse feeds", "Community engagement"],
    required: true,
  },
  {
    id: "most_useful_feature",
    question: "Which features do you find most useful? (Select all that apply)",
    type: "checkbox",
    options: ["Feeds", "Predictions", "Geo Map", "Alerts", "Trends", "Submit Truth", "Leaderboard"],
    required: true,
  },
  {
    id: "trust_level",
    question: "How much do you trust the truth reports on Soke?",
    type: "rating",
    required: true,
  },
  {
    id: "would_recommend",
    question: "Would you recommend Soke to others?",
    type: "boolean",
    required: true,
  },
  {
    id: "improvement_suggestion",
    question: "What would you like to see improved or added?",
    type: "textarea",
    placeholder: "Share your ideas for improving Soke...",
    required: false,
  },
];

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [hoverRating, setHoverRating] = useState(0);
  const [activeQuestionnaireId, setActiveQuestionnaireId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch active questionnaires from admin
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

  // Use admin-created questionnaire if available, otherwise use defaults
  const questions: Question[] = (() => {
    const adminQ = questionnaireData?.questionnaires?.[0];
    if (adminQ && adminQ.questions?.length > 0) {
      setActiveQuestionnaireId(adminQ.id);
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
  })();

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire submitted", description: "Thank you! Your responses appear in the feeds section and admin dashboard." });
      setAnswers({});
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => q.required && !answers[q.id]);
    if (unanswered.length > 0) {
      toast({ title: `Please answer all required questions (${unanswered.length} remaining)` });
      return;
    }
    submitMutation.mutate({
      questionnaireType: activeQuestionnaireId ? `admin_${activeQuestionnaireId}` : "user_experience",
      responses: answers,
    });
  };

  const answeredCount = questions.filter((q) => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return String(ans).trim().length > 0;
  }).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-display font-700">Questionnaire</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Help us improve Soke. Your responses appear in the feeds section and are sent to the admin dashboard.
        </p>
      </motion.div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{answeredCount}/{questions.length} answered</span>
        </div>
        <Progress value={progress} className="h-1.5" data-testid="progress-questionnaire" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display">Soke User Experience Survey</CardTitle>
          <CardDescription className="text-xs">
            Your feedback shapes the future of the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {questions.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="space-y-3"
              >
                {idx > 0 && <Separator className="mb-4" />}

                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                    {q.question}
                    {q.required && <span className="text-red-500 text-xs">*</span>}
                  </Label>
                </div>

                {/* Radio (single choice) */}
                {q.type === "radio" && q.options && (
                  <RadioGroup
                    value={answers[q.id] || ""}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  >
                    {q.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`} className="text-sm font-normal cursor-pointer">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* Select dropdown */}
                {q.type === "select" && q.options && (
                  <Select
                    value={answers[q.id] || ""}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an answer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Checkbox (multiple choice) */}
                {q.type === "checkbox" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const current = (answers[q.id] as string[]) || [];
                      const isChecked = current.includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            id={`${q.id}-${opt}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...current, opt]
                                : current.filter((o) => o !== opt);
                              setAnswers((prev) => ({ ...prev, [q.id]: next }));
                            }}
                          />
                          <Label htmlFor={`${q.id}-${opt}`} className="text-sm font-normal cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      );
                    })}
                    {answers[q.id] && Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(answers[q.id] as string[]).map((sel) => (
                          <Badge key={sel} variant="secondary" className="text-[10px]">
                            {sel}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating (1-5 stars) */}
                {q.type === "rating" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                          key={star}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: star }))}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5"
                        >
                          <Star
                            className={`h-6 w-6 transition-colors ${
                              (hoverRating || answers[q.id] || 0) >= star
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        </motion.button>
                      ))}
                      {answers[q.id] && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][answers[q.id]]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Boolean (Yes/No) */}
                {q.type === "boolean" && (
                  <RadioGroup
                    value={answers[q.id] || ""}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                        <Label htmlFor={`${q.id}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="no" id={`${q.id}-no`} />
                        <Label htmlFor={`${q.id}-no`} className="text-sm font-normal cursor-pointer">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {/* Text input */}
                {q.type === "text" && (
                  <Input
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Type your answer..."}
                  />
                )}

                {/* Textarea */}
                {q.type === "textarea" && (
                  <Textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Type your answer..."}
                    className="min-h-[80px]"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <Separator />

          <div className="space-y-3">
            {answeredCount === questions.length && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-green-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                All questions answered. Ready to submit!
              </motion.div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || answeredCount < questions.filter(q => q.required).length}
              className="w-full gap-2"
              data-testid="button-submit-questionnaire"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4" /> Submit Questionnaire</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Your responses will appear in the feeds section and be sent to the admin dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
