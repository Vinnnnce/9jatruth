"use client";

import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface State { id: number; name: string; code: string; }
interface LGA { id: number; name: string; }
interface Ward { id: number; name: string; }
interface PollingUnit { id: number; name: string; pu_code: string; }

interface GeoSelectorProps {
  onChange?: (selection: {
    stateId?: number;
    lgaId?: number;
    wardId?: number;
    pollingUnitId?: number;
  }) => void;
  showPollingUnits?: boolean;
  defaultToAll?: boolean;
}

export function GeoSelector({ onChange, showPollingUnits = true, defaultToAll = true }: GeoSelectorProps) {
  const [states, setStates] = useState<State[]>([]);
  const [lgas, setLgas] = useState<LGA[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [pollingUnits, setPollingUnits] = useState<PollingUnit[]>([]);

  const [stateId, setStateId] = useState<string>(defaultToAll ? "all" : "");
  const [lgaId, setLgaId] = useState<string>(defaultToAll ? "all" : "");
  const [wardId, setWardId] = useState<string>(defaultToAll ? "all" : "");
  const [puId, setPuId] = useState<string>(defaultToAll ? "all" : "");

  useEffect(() => {
    fetch("/api/geo/states").then((r) => r.json()).then((d) => setStates(d.states || []));
  }, []);

  useEffect(() => {
    if (stateId !== "all" && stateId) {
      fetch(`/api/geo/states/${stateId}/lgas`).then((r) => r.json()).then((d) => setLgas(d.lgas || []));
      setLgaId("all"); setWards([]); setPollingUnits([]); setWardId("all"); setPuId("all");
    } else {
      setLgas([]); setWards([]); setPollingUnits([]);
    }
  }, [stateId]);

  useEffect(() => {
    if (lgaId !== "all" && lgaId) {
      fetch(`/api/geo/lgas/${lgaId}/wards`).then((r) => r.json()).then((d) => setWards(d.wards || []));
      setWardId("all"); setPollingUnits([]); setPuId("all");
    } else {
      setWards([]); setPollingUnits([]);
    }
  }, [lgaId]);

  useEffect(() => {
    if (wardId !== "all" && wardId && showPollingUnits) {
      fetch(`/api/geo/wards/${wardId}/polling-units?limit=1000`).then((r) => r.json()).then((d) => setPollingUnits(d.pollingUnits || []));
      setPuId("all");
    } else {
      setPollingUnits([]);
    }
  }, [wardId, showPollingUnits]);

  useEffect(() => {
    onChange?.({
      stateId: stateId !== "all" ? parseInt(stateId, 10) : undefined,
      lgaId: lgaId !== "all" ? parseInt(lgaId, 10) : undefined,
      wardId: wardId !== "all" ? parseInt(wardId, 10) : undefined,
      pollingUnitId: puId !== "all" ? parseInt(puId, 10) : undefined,
    });
  }, [stateId, lgaId, wardId, puId, onChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <Label className="text-sm font-medium mb-1 block">State</Label>
        <Select value={stateId} onValueChange={setStateId}>
          <SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger>
          <SelectContent>
            {defaultToAll && <SelectItem value="all">All States</SelectItem>}
            {states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium mb-1 block">LGA</Label>
        <Select value={lgaId} onValueChange={setLgaId} disabled={stateId === "all"}>
          <SelectTrigger><SelectValue placeholder="All LGAs" /></SelectTrigger>
          <SelectContent>
            {defaultToAll && <SelectItem value="all">All LGAs</SelectItem>}
            {lgas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium mb-1 block">Ward</Label>
        <Select value={wardId} onValueChange={setWardId} disabled={lgaId === "all"}>
          <SelectTrigger><SelectValue placeholder="All Wards" /></SelectTrigger>
          <SelectContent>
            {defaultToAll && <SelectItem value="all">All Wards</SelectItem>}
            {wards.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {showPollingUnits && (
        <div>
          <Label className="text-sm font-medium mb-1 block">Polling Unit</Label>
          <Select value={puId} onValueChange={setPuId} disabled={wardId === "all"}>
            <SelectTrigger><SelectValue placeholder="All Polling Units" /></SelectTrigger>
            <SelectContent>
              {defaultToAll && <SelectItem value="all">All Polling Units</SelectItem>}
              {pollingUnits.map((pu) => <SelectItem key={pu.id} value={String(pu.id)}>{pu.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
