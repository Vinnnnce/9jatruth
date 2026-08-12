"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/hooks/use-toast";
import { BarChart3, Clock, CheckCircle2, Loader2 } from "lucide-react";

export interface PollData {
  id: number;
  question: string;
  totalVotes: number;
  expiresAt: string | null;
  userVote: number | null;
  options: {
    id: number;
    text: string;
    voteCount: number;
  }[];
}

export function PollCard({ pollId }: { pollId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [voting, setVoting] = useState(false);

  const { data: poll, isLoading } = useQuery<PollData>({
    queryKey: ["/api/polls", pollId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/polls/${pollId}`);
      return res.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: (optionId: number) =>
      apiRequest("POST", `/api/polls/${pollId}/vote`, { optionId }),
    onSuccess: () => {
      toast({ title: "Vote recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/polls", pollId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to vote", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !poll) {
    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading poll...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasVoted = poll.userVote !== null;
  const isExpired = !!(poll.expiresAt && new Date(poll.expiresAt) < new Date());

  const handleVote = (optionId: number) => {
    if (hasVoted || isExpired) return;
    setVoting(true);
    voteMutation.mutate(optionId, { onSettled: () => setVoting(false) });
  };

  const timeRemaining = poll.expiresAt
    ? new Date(poll.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-600 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-primary" />
            {poll.question}
          </CardTitle>
          {hasVoted && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {poll.options.map((option) => {
          const percentage = poll.totalVotes > 0
            ? Math.round((option.voteCount / poll.totalVotes) * 100)
            : 0;
          const isUserChoice = poll.userVote === option.id;

          return (
            <div key={option.id}>
              {hasVoted ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={isUserChoice ? "font-600 text-primary" : ""}>
                      {option.text}
                      {isUserChoice && " ✓"}
                    </span>
                    <span className="text-muted-foreground">
                      {percentage}% ({option.voteCount})
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2 px-3"
                  disabled={voting || isExpired}
                  onClick={() => handleVote(option.id)}
                >
                  {option.text}
                </Button>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}</span>
          {timeRemaining && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? "Ended" : "Ends"} {timeRemaining}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
