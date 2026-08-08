"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { ClipboardList, Send, Loader2 } from "lucide-react";

type Answer = string;

const QUESTIONS = [
  {
    id: "usage_frequency",
    question: "How often do you use Soke?",
    type: "radio",
    options: ["Multiple times a day", "Once a day", "A few times a week", "Once a week", "Rarely"],
  },
  {
    id: "primary_use",
    question: "What is your primary use for Soke?",
    type: "radio",
    options: ["Check community truths", "Report local issues", "View predictions", "Browse feeds", "Community engagement"],
  },
  {
    id: "most_useful_feature",
    question: "Which feature do you find most useful?",
    type: "radio",
    options: ["Feeds", "Predictions", "Geo Map", "Alerts", "Trends", "Submit Truth", "Leaderboard"],
  },
  {
    id: "least_useful_feature",
    question: "Which feature needs the most improvement?",
    type: "radio",
    options: ["Feeds", "Predictions", "Geo Map", "Alerts", "Trends", "Search", "None - all good"],
  },
  {
    id: "trust_level",
    question: "How much do you trust the truth reports on Soke?",
    type: "radio",
    options: ["Very much", "Somewhat", "Neutral", "Not much", "Not at all"],
  },
  {
    id: "improvement_suggestion",
    question: "What would you like to see improved or added?",
    type: "text",
  },
  {
    id: "would_recommend",
    question: "Would you recommend Soke to others?",
    type: "radio",
    options: ["Definitely", "Probably", "Not sure", "Probably not", "Definitely not"],
  },
];

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/questionnaire", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire submitted", description: "Thank you! Your responses have been sent to the admin dashboard." });
      setAnswers({});
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const unanswered = QUESTIONS.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast({ title: `Please answer all questions (${unanswered.length} remaining)` });
      return;
    }
    submitMutation.mutate({ questionnaireType: "user_experience", responses: answers });
  };

  const answeredCount = QUESTIONS.filter((q) => answers[q.id]?.trim()).length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Questionnaire
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Help us improve Soke by answering a few questions. Your responses go directly to the admin dashboard.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{answeredCount}/{QUESTIONS.length}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-6">
          {QUESTIONS.map((q, idx) => (
            <div key={q.id} className="space-y-3">
              <Label className="text-sm font-medium">
                {idx + 1}. {q.question}
              </Label>
              {q.type === "radio" && q.options ? (
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
              ) : (
                <Textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="min-h-[80px]"
                />
              )}
            </div>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || answeredCount < QUESTIONS.length}
            className="w-full gap-2"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="h-4 w-4" /> Submit Questionnaire</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
