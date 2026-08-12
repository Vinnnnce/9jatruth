"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Wifi,
  Gift,
  ShoppingBag,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ─── Types ───

type LedgerEntry = {
  id: number;
  userHash: string;
  amount: number;
  type: string;
  description: string;
  status?: string;
  createdAt: string;
};

type GiftCard = {
  id: string;
  brand: string;
  logo: string;
  value: number;
  expiry: string;
};

type Voucher = {
  id: string;
  store: string;
  discount: string;
  validity: string;
};

type DataPlan = {
  id: string;
  network: string;
  label: string;
  amount: number;
  size: string;
};

const USER_HASH = "dev_1d6e";

const AIRTIME_AMOUNTS = [100, 200, 500, 1000];

const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

const DATA_PLANS: DataPlan[] = [
  { id: "mtn-1gb", network: "MTN", label: "MTN 1GB · 30 days", amount: 350, size: "1GB" },
  { id: "mtn-3gb", network: "MTN", label: "MTN 3GB · 30 days", amount: 800, size: "3GB" },
  { id: "airtel-2gb", network: "Airtel", label: "Airtel 2GB · 30 days", amount: 550, size: "2GB" },
  { id: "glo-5gb", network: "Glo", label: "Glo 5GB · 30 days", amount: 1200, size: "5GB" },
  { id: "9mobile-1gb", network: "9mobile", label: "9mobile 1GB · 30 days", amount: 350, size: "1GB" },
];

const GIFT_CARDS: GiftCard[] = [
  { id: "gc-amazon-1k", brand: "Amazon", logo: "🛒", value: 1000, expiry: "31 Dec 2026" },
  { id: "gc-google-500", brand: "Google Play", logo: "▶️", value: 500, expiry: "30 Sep 2026" },
  { id: "gc-netflix-1k", brand: "Netflix", logo: "🎬", value: 1000, expiry: "31 Dec 2026" },
  { id: "gc-spotify-500", brand: "Spotify", logo: "🎵", value: 500, expiry: "30 Nov 2026" },
  { id: "gc-jumia-1k", brand: "Jumia", logo: "🛍️", value: 1000, expiry: "31 Oct 2026" },
  { id: "gc-konga-500", brand: "Konga", logo: "🛍️", value: 500, expiry: "30 Nov 2026" },
];

const VOUCHERS: Voucher[] = [
  { id: "v-shoprite-10", store: "Shoprite", discount: "10% off", validity: "30 Sep 2026" },
  { id: "v-spar-15", store: "Spar", discount: "15% off groceries", validity: "31 Oct 2026" },
  { id: "v-game-500", store: "Game", discount: "₦500 off ₦5000+", validity: "30 Nov 2026" },
  { id: "v-slot-1k", store: "Slot", discount: "₦1,000 off accessories", validity: "31 Dec 2026" },
];

const TABS = [
  { value: "airtime", label: "Airtime", icon: Smartphone },
  { value: "data", label: "Data", icon: Wifi },
  { value: "gift-cards", label: "Gift Cards", icon: Gift },
  { value: "vouchers", label: "Vouchers", icon: Ticket },
];

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function detectNetwork(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return null;
  // Strip leading 0 or country code 234
  let prefix = cleaned;
  if (prefix.startsWith("234")) prefix = prefix.slice(3);
  if (prefix.startsWith("0")) prefix = prefix.slice(1);
  if (prefix.length < 3) return null;
  const first = prefix.slice(0, 3);
  if (["803", "806", "810", "813", "814", "816", "903", "703", "706"].includes(first)) return "MTN";
  if (["802", "808", "812", "901", "904", "701", "708"].includes(first)) return "Airtel";
  if (["805", "807", "811", "815", "905", "705"].includes(first)) return "Glo";
  if (["809", "817", "818", "908", "909"].includes(first)) return "9mobile";
  return null;
}

function statusBadge(status: string | undefined) {
  const s = (status || "fulfilled").toLowerCase();
  switch (s) {
    case "pending":
      return { variant: "outline" as const, className: "bg-amber-500/15 text-amber-600 border-amber-500/30", Icon: Clock };
    case "approved":
      return { variant: "outline" as const, className: "bg-blue-500/15 text-blue-600 border-blue-500/30", Icon: CheckCircle2 };
    case "fulfilled":
      return { variant: "outline" as const, className: "bg-green-500/15 text-green-600 border-green-500/30", Icon: CheckCircle2 };
    case "denied":
      return { variant: "outline" as const, className: "bg-red-500/15 text-red-600 border-red-500/30", Icon: XCircle };
    default:
      return { variant: "outline" as const, className: "", Icon: CheckCircle2 };
  }
}

// ─── Animated Counter ───

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = { current: 0 };
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const to = value;

    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      controls.current = Math.round(from + (to - from) * eased);
      setDisplay(controls.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <motion.span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
    </motion.span>
  );
}

// ─── Main Component ───

export default function Rewards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("airtime");

  // Airtime state
  const [phone, setPhone] = useState("");
  const [airtimeAmount, setAirtimeAmount] = useState<number | null>(null);

  // Data state
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<string>("");

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
    mutationFn: (data: { userHash: string; amount: number; description: string; type?: string }) =>
      apiRequest("POST", "/api/rewards/redeem", data),
    onSuccess: () => {
      toast({ title: "Redemption submitted", description: "Your reward is being processed." });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/ledger"] });
      setAirtimeAmount(null);
      setSelectedPlan("");
    },
    onError: (err: Error) => {
      toast({ title: "Redemption failed", description: err.message, variant: "destructive" });
    },
  });

  const balance = balanceData?.balance ?? 0;
  const detectedNetwork = detectNetwork(phone);

  const handleAirtimeRedeem = () => {
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      toast({ title: "Invalid phone number", variant: "destructive" });
      return;
    }
    if (!airtimeAmount) {
      toast({ title: "Select an amount", variant: "destructive" });
      return;
    }
    if (balance < airtimeAmount) {
      toast({ title: "Insufficient credits", variant: "destructive" });
      return;
    }
    const net = detectedNetwork || "Auto";
    redeemMutation.mutate({
      userHash: USER_HASH,
      amount: airtimeAmount,
      description: `${net} airtime ₦${airtimeAmount} to ${phone}`,
      type: "airtime",
    });
  };

  const handleDataRedeem = () => {
    const plan = DATA_PLANS.find((p) => p.id === selectedPlan);
    if (!plan) {
      toast({ title: "Select a data plan", variant: "destructive" });
      return;
    }
    if (balance < plan.amount) {
      toast({ title: "Insufficient credits", variant: "destructive" });
      return;
    }
    redeemMutation.mutate({
      userHash: USER_HASH,
      amount: plan.amount,
      description: `${plan.label} data bundle`,
      type: "data",
    });
  };

  const handleGiftCardRedeem = (card: GiftCard) => {
    if (balance < card.value) {
      toast({ title: "Insufficient credits", variant: "destructive" });
      return;
    }
    redeemMutation.mutate({
      userHash: USER_HASH,
      amount: card.value,
      description: `${card.brand} gift card (₦${card.value})`,
      type: "gift_card",
    });
  };

  const handleVoucherRedeem = (voucher: Voucher) => {
    redeemMutation.mutate({
      userHash: USER_HASH,
      amount: 0,
      description: `${voucher.store} voucher (${voucher.discount})`,
      type: "voucher",
    });
  };

  const totalEarned = (ledger?.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0) ?? 0);
  const totalRedeemed = Math.abs(ledger?.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0) ?? 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-xl font-display font-700">Rewards & Credits</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Earn credits for verified truth submissions and redeem for airtime, data, and more.
        </p>
      </div>

      {/* ─── Balance Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-primary/20 bg-primary/5 overflow-hidden">
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
                <p className="text-2xl font-display font-700 tabular-nums text-primary">
                  <AnimatedCounter value={balance} />
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                User: <span className="font-mono">{USER_HASH}</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Total Earned</span>
              </div>
              {ledgerLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-display font-700 tabular-nums">{totalEarned.toLocaleString()}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">From submissions & verifications</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
        >
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Total Redeemed</span>
              </div>
              {ledgerLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-display font-700 tabular-nums">{totalRedeemed.toLocaleString()}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Airtime, data, vouchers</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Tabbed Redemption Interface ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
      >
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-display">Redeem Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Airtime Tab */}
              <TabsContent value="airtime">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="airtime"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 pt-2"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0801 234 5678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      {detectedNetwork && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">{detectedNetwork}</Badge>
                          <span>detected automatically</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Select Amount</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {AIRTIME_AMOUNTS.map((amt) => {
                          const selected = airtimeAmount === amt;
                          const canAfford = balance >= amt;
                          return (
                            <motion.button
                              key={amt}
                              whileHover={canAfford ? { scale: 1.03 } : undefined}
                              whileTap={canAfford ? { scale: 0.97 } : undefined}
                              disabled={!canAfford || redeemMutation.isPending}
                              onClick={() => setAirtimeAmount(amt)}
                              className={`rounded-lg border p-3 text-center transition-colors ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : canAfford
                                    ? "border-border hover:border-primary/30 hover:bg-primary/5"
                                    : "border-border opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <Smartphone className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                              <p className="text-sm font-medium">₦{amt}</p>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        onClick={handleAirtimeRedeem}
                        disabled={redeemMutation.isPending || !airtimeAmount}
                        className="w-full"
                      >
                        {redeemMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Smartphone className="h-4 w-4" />
                            Purchase Airtime {airtimeAmount ? `· ₦${airtimeAmount}` : ""}
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </TabsContent>

              {/* Data Tab */}
              <TabsContent value="data">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="data"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 pt-2"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs">Select Network</Label>
                      <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose network" />
                        </SelectTrigger>
                        <SelectContent>
                          {NETWORKS.map((n) => (
                            <SelectItem key={n} value={n}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Select Data Plan</Label>
                      <div className="space-y-2">
                        {DATA_PLANS.filter((p) => !selectedNetwork || p.network === selectedNetwork).map((plan) => {
                          const selected = selectedPlan === plan.id;
                          const canAfford = balance >= plan.amount;
                          return (
                            <motion.button
                              key={plan.id}
                              whileHover={canAfford ? { scale: 1.01 } : undefined}
                              whileTap={canAfford ? { scale: 0.99 } : undefined}
                              disabled={!canAfford || redeemMutation.isPending}
                              onClick={() => setSelectedPlan(plan.id)}
                              className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                                selected
                                  ? "border-primary bg-primary/10"
                                  : canAfford
                                    ? "border-border hover:border-primary/30 hover:bg-primary/5"
                                    : "border-border opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Wifi className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{plan.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{plan.size} data bundle</p>
                                </div>
                              </div>
                              <Badge variant={canAfford ? "secondary" : "outline"} className="text-[10px]">
                                {plan.amount} credits
                              </Badge>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        onClick={handleDataRedeem}
                        disabled={redeemMutation.isPending || !selectedPlan}
                        className="w-full"
                      >
                        {redeemMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Wifi className="h-4 w-4" />
                            Purchase Data
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </TabsContent>

              {/* Gift Cards Tab */}
              <TabsContent value="gift-cards">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="gift-cards"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="pt-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {GIFT_CARDS.map((card, i) => {
                        const canAfford = balance >= card.value;
                        return (
                          <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            whileHover={canAfford ? { y: -4 } : undefined}
                            className={`rounded-xl border p-4 space-y-3 transition-colors ${
                              canAfford
                                ? "border-border hover:border-primary/30 hover:bg-primary/5"
                                : "border-border opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{card.logo}</span>
                              <Badge variant="outline" className="text-[10px]">{card.value} credits</Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{card.brand}</p>
                              <p className="text-[10px] text-muted-foreground">Expires {card.expiry}</p>
                            </div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                size="sm"
                                variant={canAfford ? "default" : "outline"}
                                disabled={!canAfford || redeemMutation.isPending}
                                onClick={() => handleGiftCardRedeem(card)}
                                className="w-full"
                              >
                                <Gift className="h-3.5 w-3.5" />
                                Redeem
                              </Button>
                            </motion.div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </TabsContent>

              {/* Vouchers Tab */}
              <TabsContent value="vouchers">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="vouchers"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 pt-2"
                  >
                    {VOUCHERS.map((voucher, i) => (
                      <motion.div
                        key={voucher.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                        whileHover={{ y: -2 }}
                        className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-muted/50 p-2">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{voucher.store}</p>
                            <p className="text-[10px] text-muted-foreground">{voucher.discount}</p>
                            <p className="text-[9px] text-muted-foreground/70">Valid until {voucher.validity}</p>
                          </div>
                        </div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={redeemMutation.isPending}
                            onClick={() => handleVoucherRedeem(voucher)}
                          >
                            <Ticket className="h-3.5 w-3.5" />
                            Redeem
                          </Button>
                        </motion.div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Redemption History ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
      >
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-display">Redemption History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
              {ledgerLoading ? (
                [...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)
              ) : ledger && ledger.length > 0 ? (
                ledger.map((entry, i) => {
                  const sb = statusBadge(entry.status);
                  const StatusIcon = sb.Icon;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5"
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${
                          entry.amount > 0 ? "bg-green-500/10" : "bg-amber-500/10"
                        }`}
                      >
                        {entry.amount > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{entry.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[8px] capitalize h-4 gap-0.5 ${sb.className}`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {entry.status || "fulfilled"}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/60">{timeAgo(entry.createdAt)}</span>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-mono tabular-nums font-medium ${
                          entry.amount > 0 ? "text-green-500" : "text-amber-500"
                        }`}
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {entry.amount}
                      </span>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Gift className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No transactions yet</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Submit truths and corroborate reports to earn credits.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Info card ─── */}
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Coins className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Earn <span className="font-medium text-foreground">20 credits</span> per verified truth submission and{" "}
            <span className="font-medium text-foreground">10–50 credits</span> per corroboration. Credits can be
            redeemed for airtime, data bundles, gift cards, and shopping vouchers through partner integrations.
            <ChevronRight className="inline h-3 w-3 ml-0.5" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
