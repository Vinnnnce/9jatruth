"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Loader2, Send, Coins } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function GiftModal({
  recipientUserHash,
  recipientName,
  trigger,
}: {
  recipientUserHash: string;
  recipientName?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const giftMutation = useMutation({
    mutationFn: async (data: { recipientUserHash: string; amount: number; message?: string }) => {
      return apiRequest("POST", "/api/rewards/gift", data);
    },
    onSuccess: () => {
      toast({ title: "Gift sent", description: `Sent ${amount} points to ${recipientName || "user"}` });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      setOpen(false);
      setAmount(10);
      setMessage("");
    },
    onError: (err: any) => {
      toast({
        title: "Gift failed",
        description: err?.message || "Could not send gift",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (amount <= 0 || amount > 1000) {
      toast({ title: "Invalid amount", description: "Enter between 1 and 1000 points", variant: "destructive" });
      return;
    }
    giftMutation.mutate({
      recipientUserHash,
      amount,
      message: message || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Gift className="h-3.5 w-3.5" />
            Send Gift
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Send Reward Points
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-md bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-muted-foreground">
              Send your reward points as a gift to{" "}
              <span className="font-medium text-foreground">{recipientName || "this user"}</span>.
              Points will be deducted from your balance.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Coins className="h-3 w-3" />
              Amount (points)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={1000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="h-9"
              />
              <div className="flex gap-1">
                {[10, 50, 100].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setAmount(v)}
                    className="h-9 px-2 text-xs"
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message..."
              rows={2}
              maxLength={200}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={giftMutation.isPending || amount <= 0}
              className="gap-1.5"
            >
              {giftMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send {amount} Points
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
