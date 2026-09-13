"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Calendar, Clock, MapPin, ExternalLink } from "lucide-react";

interface ElectionEvent {
  id: number;
  name: string;
  description: string | null;
  event_type: string;
  geo_scope: string;
  state_name: string | null;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  status: string;
  notes: string | null;
  source_url: string | null;
}

interface Timetable {
  id: number;
  title: string;
  description: string | null;
  published_date: string | null;
  status: string;
  source_url: string | null;
  events: ElectionEvent[];
}

interface Election {
  id: number;
  year: number;
  name: string;
  type: string;
  election_date: string | null;
  status: string;
  has_timetable: boolean;
  timetable_id: number | null;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  voter_registration: "📝",
  party_primaries: "🏛️",
  campaign_period: "📣",
  election_day: "🗳️",
  collation: "📊",
  result_announcement: "📢",
  voter_verification: "✓",
  party_registration: "📋",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  ongoing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  scheduled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function ElectionCalendarPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/politics/elections")
      .then((r) => r.json())
      .then((data) => {
        setElections(data.elections || []);
        if (data.elections?.length > 0) {
          setSelectedElection(data.elections[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadTimetable = useCallback(async (electionId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/politics/elections/${electionId}/timetable`);
      if (res.ok) {
        const data = await res.json();
        setTimetable(data.timetable);
      } else {
        setTimetable(null);
      }
    } catch {
      setTimetable(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedElection) {
      loadTimetable(selectedElection.id);
    }
  }, [selectedElection, loadTimetable]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return "TBD";
    if (start === end) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
  };

  if (loading && !timetable) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Election Calendar</h1>
        <p className="text-muted-foreground mt-1">
          Official INEC election timetable and key dates. Data sourced from the Independent National Electoral Commission (INEC).
        </p>
      </div>

      {/* Election Selector */}
      <div className="flex flex-wrap gap-2">
        {elections.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelectedElection(e)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedElection?.id === e.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>

      {/* Neutrality Banner */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300">
        This page presents factual election timetable information as published by INEC. No predictions or projections are made.
      </div>

      {/* Timetable */}
      {timetable ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{timetable.title}</CardTitle>
                  {timetable.description && (
                    <p className="text-sm text-muted-foreground mt-1">{timetable.description}</p>
                  )}
                </div>
                <Badge className={STATUS_COLORS[timetable.status] || STATUS_COLORS.scheduled}>
                  {timetable.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Timeline */}
          <div className="space-y-3">
            {timetable.events?.map((event, idx) => (
              <Card key={event.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                  className="w-full text-left"
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="text-2xl">{EVENT_TYPE_ICONS[event.event_type] || "📅"}</div>
                      {idx < timetable.events.length - 1 && (
                        <div className="w-px h-8 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{event.name}</h3>
                        <Badge className={STATUS_COLORS[event.status] || STATUS_COLORS.scheduled}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateRange(event.start_date, event.end_date)}
                        </span>
                        {event.state_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.state_name}
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedEvent === event.id ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </button>
                {expandedEvent === event.id && (
                  <div className="px-4 pb-4 pl-14 space-y-2">
                    {event.description && <p className="text-sm">{event.description}</p>}
                    {event.notes && <p className="text-sm text-muted-foreground">{event.notes}</p>}
                    {event.source_url && (
                      <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Source: INEC
                      </a>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {timetable.source_url && (
            <p className="text-xs text-muted-foreground text-center">
              Source:{" "}
              <a href={timetable.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                INEC Official Website
              </a>
            </p>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No timetable has been published for this election yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
