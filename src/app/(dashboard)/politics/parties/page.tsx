"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface Party {
  id: number;
  acronym: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  status: string;
  date_registered: string | null;
  headquarters: string | null;
  total_candidates?: number;
  total_office_holders?: number;
}

export default function PartyDirectoryPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [filtered, setFiltered] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "deregistered">("all");

  useEffect(() => {
    fetch("/api/politics/parties")
      .then((r) => r.json())
      .then((data) => {
        setParties(data.parties || []);
        setFiltered(data.parties || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = parties;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.acronym.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    if (filter !== "all") {
      result = result.filter((p) => p.status === filter);
    }
    setFiltered(result);
  }, [search, filter, parties]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Political Party Directory</h1>
        <p className="text-muted-foreground mt-1">
          Registered political parties in Nigeria. Data sourced from INEC.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parties by name or acronym..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "deregistered"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Party Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No parties found matching your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((party) => (
            <Link key={party.id} href={`/politics/party/${party.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: party.color || "#666" }}
                  >
                    {party.acronym.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{party.acronym}</h3>
                      {party.status === "active" ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      ) : party.status === "deregistered" ? (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <XCircle className="h-3 w-3 mr-1" /> Deregistered
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{party.name}</p>
                    {party.date_registered && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Registered: {new Date(party.date_registered).toLocaleDateString("en-NG", { year: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Source: INEC — Party registration data is authoritative as published by the Independent National Electoral Commission.
      </p>
    </div>
  );
}
