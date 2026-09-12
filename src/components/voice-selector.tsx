"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Volume2, Gauge } from "lucide-react";
import { useVoiceSelection } from "@/components/hooks/use-voice-selection";

export function VoiceSelector() {
  const {
    voices,
    selectedVoiceURI,
    selectVoice,
    rate,
    updateRate,
    pitch,
    updatePitch,
    supported,
  } = useVoiceSelection();

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Text-to-speech is not supported on this browser.
      </p>
    );
  }

  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
  const otherVoices = voices.filter((v) => !v.lang.startsWith("en"));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5" />
          Voice Selection
        </Label>
        <Select
          value={selectedVoiceURI || undefined}
          onValueChange={selectVoice}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select a voice" />
          </SelectTrigger>
          <SelectContent>
            {englishVoices.length > 0 && (
              <>
                <SelectItem value="__en_header" disabled className="font-medium text-xs text-muted-foreground">
                  English Voices
                </SelectItem>
                {englishVoices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    <span className="flex items-center gap-2">
                      {v.name}
                      {v.isNatural && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          Natural
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">{v.lang}</span>
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
            {otherVoices.length > 0 && (
              <>
                <SelectItem value="__other_header" disabled className="font-medium text-xs text-muted-foreground">
                  Other Languages
                </SelectItem>
                {otherVoices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    <span className="flex items-center gap-2">
                      {v.name}
                      <span className="text-[9px] text-muted-foreground">{v.lang}</span>
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            Speed: {rate.toFixed(1)}x
          </Label>
          <Slider
            value={[rate]}
            onValueChange={(vals) => updateRate(vals[0])}
            min={0.5}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            Pitch: {pitch.toFixed(1)}
          </Label>
          <Slider
            value={[pitch]}
            onValueChange={(vals) => updatePitch(vals[0])}
            min={0.5}
            max={2}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
