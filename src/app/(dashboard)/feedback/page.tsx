"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { MessageSquare, Star, Send, Loader2 } from "lucide-react";

export default function FeedbackPage() {
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback sent", description: "Your feedback has been sent to the admin dashboard." });
      setSubject("");
      setMessage("");
      setRating(0);
      setCategory("general");
    },
    onError: () => {
      toast({ title: "Failed to send feedback", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields" });
      return;
    }
    submitMutation.mutate({ category, subject, message, rating, pageUrl: window.location.href });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Feedback
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Share your thoughts, report issues, or suggest improvements. All feedback goes directly to the admin dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display">Send Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="ui">UI/UX Feedback</SelectItem>
                <SelectItem value="performance">Performance Issue</SelectItem>
                <SelectItem value="content">Content Issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your feedback"
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your feedback in detail..."
              className="min-h-[150px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Rating (optional)</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-5 w-5 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !subject.trim() || !message.trim()}
            className="w-full gap-2"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4" /> Send Feedback</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
