"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { Coins, ArrowUpRight, ArrowDownLeft, Gift, Smartphone, Wifi, ShoppingBag } from "lucide-react";

type LedgerEntry = {
  id: number;
  userHash: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

const USER_HASH = "dev_1d6e";

const redemptionOptions = [
  { id: "airtime-200", label: "200 Airtime (MTN/Airtel/Glo)", amount: 200, icon: Smartphone },
  { id: "airtime-500", label: "500 Airtime (MTN/Airtel/Glo)", amount: 500, icon: Smartphone },
  { id: "data-1gb", label: "1GB Data Bundle", amount: 350, icon: Wifi },
  { id: "data-3gb", label: "3GB Data Bundle", amount: 800, icon: Wifi },
  { id: "voucher-1k", label: "1,000 Shopping Voucher", amount: 1000, icon: ShoppingBag },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Rewards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [redeemAmount, setRedeemAmount] = useState<string>("");
  const [redeemDesc, setRedeemDesc] = useState<string>("");

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ userHash: string; balance: number }>({
    queryKey: ["/api/rewards/balance", USER_HASH],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rewards/balance?userHash=${USER_HASH}`);
      return res.json();
    },
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["/api/rewards/ledger", USER_HASH],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rewards/ledger?userHash=${USER_HASH}`);
      return res.json();
    },
  });

  const redeemMutation = useMutation({
    mutationFn: (data: { userHash: string; amount: number; description: string }) =>
      apiRequest("POST", "/api/rewards/redeem", data),
    onSuccess: () => {
      toast({ title: "Redemption successful", description: "Your reward has been processed." });
      setRedeemAmount("");
      setRedeemDesc("");
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/ledger"] });
    },
    onError: (err: Error) => {
      toast({ title: "Redemption failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRedeem = (amount: number, description: string) => {
    redeemMutation.mutate({ userHash: USER_HASH, amount, description });
  };

  const handleCustomRedeem = () => {
    const amount = parseInt(redeemAmount, 10);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid credit amount.", variant: "destructive" });
      return;
    }
    if (!redeemDesc.trim()) {
      toast({ title: "Missing description", description: "Please describe what you're redeeming.", variant: "destructive" });
      return;
    }
    handleRedeem(amount, redeemDesc.trim());
  };

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Rewards & Credits</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Earn credits for verified truth submissions and corroboration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="col-span-1 border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/15 p-1.5">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Credit Balance</span>
              </div>
            </div>
            {balanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-display font-700 tabular-nums text-primary">{balance.toLocaleString()}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">User: <span className="font-mono">{USER_HASH}</span></p>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Total Earned</span>
            </div>
            {ledgerLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className="text-2xl font-display font-700 tabular-nums">
                {(ledger?.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0) ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">From submissions & verifications</p>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Total Redeemed</span>
            </div>
            {ledgerLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className="text-2xl font-display font-700 tabular-nums">
                {Math.abs(ledger?.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0) ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Airtime, data, vouchers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-display">Redeem Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {redemptionOptions.map((opt) => {
                const Icon = opt.icon;
                const canAfford = balance >= opt.amount;
                return (
                  <button
                    key={opt.id}
                    data-testid={`redeem-${opt.id}`}
                    disabled={!canAfford || redeemMutation.isPending}
                    onClick={() => handleRedeem(opt.amount, opt.label)}
                    className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                      canAfford
                        ? "border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
                        : "border-border opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{opt.label}</span>
                    </div>
                    <Badge variant={canAfford ? "secondary" : "outline"} className="text-[10px]">
                      {opt.amount} credits
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-medium">Custom Redemption</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-24"
                  data-testid="input-redeem-amount"
                />
                <Input
                  placeholder="Description"
                  value={redeemDesc}
                  onChange={(e) => setRedeemDesc(e.target.value)}
                  className="flex-1"
                  data-testid="input-redeem-desc"
                />
                <Button
                  size="sm"
                  onClick={handleCustomRedeem}
                  disabled={redeemMutation.isPending}
                  data-testid="button-redeem-custom"
                >
                  Redeem
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-display">Transaction Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
              {ledgerLoading ? (
                [...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)
              ) : ledger && ledger.length > 0 ? (
                ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5 animate-fade-in">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${
                      entry.amount > 0 ? "bg-green-500/10" : "bg-amber-500/10"
                    }`}>
                      {entry.amount > 0
                        ? <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                        : <ArrowDownLeft className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{entry.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] capitalize h-3.5">{entry.type}</Badge>
                        <span className="text-[9px] text-muted-foreground/60">{timeAgo(entry.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-mono tabular-nums font-medium ${
                      entry.amount > 0 ? "text-green-500" : "text-amber-500"
                    }`}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Gift className="h-5 w-5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Earn <span className="font-medium text-foreground">20 credits</span> per verified truth submission and <span className="font-medium text-foreground">10-50 credits</span> per corroboration. Credits can be redeemed for airtime, data bundles, and shopping vouchers through partner integrations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
