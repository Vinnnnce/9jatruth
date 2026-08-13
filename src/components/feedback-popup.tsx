"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, MessageSquare, Clock, Loader2, Send } from "lucide-react";

type ScheduleCheck = {
  shouldShow: boolean;
  due?: boolean;
  reason?: string;
};

const CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
  { value: "ui_ux", label: "UI/UX" },
  { value: "performance", label: "Performance" },
];

export function FeedbackPopup() {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if feedback is due on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/feedback/schedule/check");
        const data: ScheduleCheck = await res.json();
        if (active && (data.due || data.shouldShow)) {
          setShow(true);
        }
      } catch {
        // Endpoint may not be available — silently skip
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!rating) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Please select a category", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/feedback/schedule", {
        rating,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      toast({ title: "Thank you for your feedback!" });
      setShow(false);
      setRating(0);
      setCategory("");
      setSubject("");
      setMessage("");
    } catch {
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemindLater = async () => {
    try {
      await apiRequest("POST", "/api/feedback/schedule", { remindLater: true });
    } catch {
      // best-effort
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/15 p-1.5">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-700">We value your feedback</h3>
                  <p className="text-[10px] text-muted-foreground">Help us improve Soke</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setShow(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Rating stars */}
              <div className="space-y-1.5">
                <Label className="text-xs">How would you rate your experience?</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          (hoverRating || rating) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </motion.button>
                  ))}
                  {rating > 0 && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs text-muted-foreground ml-2"
                    >
                      {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-subject" className="text-xs">Subject</Label>
                <Input
                  id="feedback-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary..."
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message" className="text-xs">Message</Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us more..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemindLater}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Remind me later
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="ml-auto gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FeedbackPopup;
