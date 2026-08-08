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
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ClipboardList, Plus, Trash2, FileText, Users, Clock, Star } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";

type Question = {
  id: string;
  type: "text" | "single_choice" | "multiple_choice" | "rating" | "scale";
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  minRating?: number;
  maxRating?: number;
};

type Questionnaire = {
  id: number;
  title: string;
  description?: string;
  category: string;
  questions: Question[];
  status: string;
  responseCount: number;
  expiresAt?: string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function QuestionnairesPage() {
  const { isSignedIn } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
  });
  const [questions, setQuestions] = useState<Question[]>([]);

  const { data: questionnaires, isLoading } = useQuery<Questionnaire[]>({
    queryKey: ["/api/questionnaires"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; category: string; questions: Question[] }) => {
      const res = await apiRequest("POST", "/api/questionnaires", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questionnaire created", description: "Your questionnaire is now live" });
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      setCreateOpen(false);
      setForm({ title: "", description: "", category: "general" });
      setQuestions([]);
    },
    onError: () => {
      toast({ title: "Failed to create questionnaire", variant: "destructive" });
    },
  });

  const responseMutation = useMutation({
    mutationFn: async (qId: number) => {
      const res = await apiRequest("POST", `/api/questionnaires/${qId}/responses`, { answers });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Response submitted", description: "Thank you for participating!" });
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      setRespondingTo(null);
      setAnswers({});
    },
    onError: () => {
      toast({ title: "Failed to submit response", variant: "destructive" });
    },
  });

  const addQuestion = (type: Question["type"]) => {
    const newQ: Question = {
      id: `q${Date.now()}`,
      type,
      question: "",
      required: true,
      options: type === "single_choice" || type === "multiple_choice" ? ["", ""] : undefined,
      minRating: type === "rating" ? 1 : undefined,
      maxRating: type === "rating" ? 5 : undefined,
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (questions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...form, questions });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Questionnaires
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create surveys and collect community insights
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Questionnaire</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label className="text-sm">Title</Label>
                <Input
                  placeholder="e.g. Community Power Survey"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Description (optional)</Label>
                <Textarea
                  placeholder="What is this survey about?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1.5 min-h-[60px]"
                />
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
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="traffic">Traffic</SelectItem>
                    <SelectItem value="prices">Prices</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Questions Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Questions</Label>
                  <div className="flex gap-1 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("text")} className="text-[10px] h-7">Text</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("single_choice")} className="text-[10px] h-7">Single Choice</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("multiple_choice")} className="text-[10px] h-7">Multi Choice</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("rating")} className="text-[10px] h-7">Rating</Button>
                  </div>
                </div>
                {questions.map((q, idx) => (
                  <Card key={q.id} className="border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px]">{idx + 1}</Badge>
                        <Badge variant="outline" className="text-[9px] capitalize">{q.type.replace("_", " ")}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 w-6 p-0"
                          onClick={() => removeQuestion(q.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Question text"
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                      />
                      {(q.type === "single_choice" || q.type === "multiple_choice") && (
                        <div className="space-y-1">
                          {q.options?.map((opt, oi) => (
                            <Input
                              key={oi}
                              placeholder={`Option ${oi + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[oi] = e.target.value;
                                updateQuestion(q.id, { options: newOpts });
                              }}
                              className="h-8 text-xs"
                            />
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6"
                            onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ""] })}
                          >
                            <Plus className="h-3 w-3" /> Add option
                          </Button>
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 text-xs">
                        <Checkbox
                          checked={q.required}
                          onCheckedChange={(v) => updateQuestion(q.id, { required: v === true })}
                        />
                        Required
                      </label>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Questionnaire"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Questionnaire List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-5 w-2/3 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : questionnaires && questionnaires.length > 0 ? (
        <div className="space-y-3">
          {questionnaires.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-sm font-medium truncate">{q.title}</h3>
                      <Badge variant="outline" className="text-[9px] capitalize">{q.category}</Badge>
                    </div>
                    {q.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {q.responseCount} responses
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(q.createdAt)}
                      </span>
                      <span>{q.questions.length} questions</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRespondingTo(q.id);
                      setAnswers({});
                    }}
                  >
                    Respond
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No active questionnaires</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a questionnaire to collect community insights
            </p>
          </CardContent>
        </Card>
      )}

      {/* Response Dialog */}
      <Dialog
        open={respondingTo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRespondingTo(null);
            setAnswers({});
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {questionnaires?.find((q) => q.id === respondingTo)?.title || "Questionnaire"}
            </DialogTitle>
          </DialogHeader>
          {respondingTo && questionnaires && (() => {
            const q = questionnaires.find((x) => x.id === respondingTo);
            if (!q) return null;
            return (
              <div className="space-y-4">
                {q.description && (
                  <p className="text-sm text-muted-foreground">{q.description}</p>
                )}
                {q.questions.map((question, qi) => (
                  <div key={question.id} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {qi + 1}. {question.question}
                      {question.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {question.type === "text" && (
                      <Textarea
                        placeholder={question.placeholder || "Your answer..."}
                        value={answers[question.id] || ""}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      />
                    )}
                    {question.type === "single_choice" && (
                      <RadioGroup
                        value={answers[question.id] || ""}
                        onValueChange={(v) => setAnswers({ ...answers, [question.id]: v })}
                      >
                        {question.options?.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <RadioGroupItem value={opt} id={`${question.id}-${oi}`} />
                            <Label htmlFor={`${question.id}-${oi}`} className="text-sm font-normal cursor-pointer">
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                    {question.type === "multiple_choice" && (
                      <div className="space-y-2">
                        {question.options?.map((opt, oi) => {
                          const selected: string[] = answers[question.id] || [];
                          return (
                            <div key={oi} className="flex items-center gap-2">
                              <Checkbox
                                id={`${question.id}-${oi}`}
                                checked={selected.includes(opt)}
                                onCheckedChange={(v) => {
                                  const next = v ? [...selected, opt] : selected.filter((s) => s !== opt);
                                  setAnswers({ ...answers, [question.id]: next });
                                }}
                              />
                              <Label htmlFor={`${question.id}-${oi}`} className="text-sm font-normal cursor-pointer">
                                {opt}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {question.type === "rating" && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setAnswers({ ...answers, [question.id]: star })}
                          >
                            <Star
                              className={`h-5 w-5 transition-colors ${
                                (answers[question.id] || 0) >= star
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => responseMutation.mutate(respondingTo)}
                    disabled={responseMutation.isPending}
                  >
                    {responseMutation.isPending ? "Submitting..." : "Submit Response"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
