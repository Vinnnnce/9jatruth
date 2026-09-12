"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { Loader2, Mail, Lock, User } from "lucide-react";

interface FallbackAuthFormProps {
  mode: "signin" | "signup";
}

export function FallbackAuthForm({ mode }: FallbackAuthFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { email, password, displayName }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: mode === "signup" ? "Sign up failed" : "Sign in failed",
          description: data.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: mode === "signup" ? "Account created" : "Welcome back",
        description: mode === "signup"
          ? "Your account has been created successfully"
          : `Welcome back, ${data.user?.displayName || ""}`,
      });

      router.push("/feeds");
      router.refresh();
    } catch {
      toast({
        title: "Connection error",
        description: "Please check your internet and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="displayName" className="text-xs">Display Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="displayName"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="pl-9 h-10"
              required
              minLength={2}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9 h-10"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9 h-10"
            required
            minLength={mode === "signup" ? 6 : 1}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-10 gap-2"
        disabled={loading}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading
          ? "Please wait..."
          : mode === "signup"
            ? "Create Account"
            : "Sign In"}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <a href="/sign-in" className="text-primary hover:underline font-medium">
              Sign in
            </a>
          </>
        ) : (
          <>
            Don't have an account?{" "}
            <a href="/sign-up" className="text-primary hover:underline font-medium">
              Sign up
            </a>
          </>
        )}
      </p>
    </form>
  );
}
