"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  isNatural: boolean;
}

const STORAGE_KEY = "9jatruth_voice_pref";

/**
 * Hook for browser SpeechSynthesis voice selection.
 * Loads available voices, persists selection, and provides speak/stop functions.
 */
export function useVoiceSelection() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  // Load voices (they load asynchronously in some browsers)
  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      // Deduplicate and categorize voices
      const seen = new Set<string>();
      const voiceOptions: VoiceOption[] = availableVoices
        .filter((v) => {
          const key = `${v.name}-${v.lang}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((v) => ({
          name: v.name,
          lang: v.lang,
          voiceURI: v.voiceURI,
          // Heuristic: "natural" voices tend to have these keywords
          isNatural: /natural|neural|premium|enhanced|google|safari|female|male/i.test(v.name) ||
            v.localService === false,
        }))
        .sort((a, b) => {
          // Prioritize English voices, then natural voices
          const aEn = a.lang.startsWith("en");
          const bEn = b.lang.startsWith("en");
          if (aEn && !bEn) return -1;
          if (!aEn && bEn) return 1;
          if (a.isNatural && !b.isNatural) return -1;
          if (!a.isNatural && b.isNatural) return 1;
          return a.name.localeCompare(b.name);
        });

      setVoices(voiceOptions);

      // Load saved preference
      if (!selectedVoiceURI && voiceOptions.length > 0) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            const exists = voiceOptions.find((v) => v.voiceURI === parsed.voiceURI);
            if (exists) {
              setSelectedVoiceURI(parsed.voiceURI);
              if (parsed.rate) setRate(parsed.rate);
              if (parsed.pitch) setPitch(parsed.pitch);
              return;
            }
          }
          // Default to first English natural voice, or first voice
          const defaultVoice = voiceOptions.find((v) => v.lang.startsWith("en") && v.isNatural) ||
            voiceOptions.find((v) => v.lang.startsWith("en")) ||
            voiceOptions[0];
          if (defaultVoice) {
            setSelectedVoiceURI(defaultVoice.voiceURI);
          }
        } catch {
          // localStorage might not be available
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Retry loading voices after a delay (Chrome sometimes needs this)
    const timer = setTimeout(loadVoices, 500);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      clearTimeout(timer);
    };
  }, [supported, selectedVoiceURI]);

  const selectVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceURI, rate, pitch }));
    } catch {}
  }, [rate, pitch]);

  const updateRate = useCallback((newRate: number) => {
    setRate(newRate);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceURI: selectedVoiceURI, rate: newRate, pitch }));
    } catch {}
  }, [selectedVoiceURI, pitch]);

  const updatePitch = useCallback((newPitch: number) => {
    setPitch(newPitch);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceURI: selectedVoiceURI, rate, pitch: newPitch }));
    } catch {}
  }, [selectedVoiceURI, rate]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!supported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Split into chunks for better reliability with long texts
    const maxChunkLength = 200;
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, maxChunkLength);
      // Try to break at a sentence boundary
      const lastSentence = Math.max(
        chunk.lastIndexOf(". "),
        chunk.lastIndexOf("! "),
        chunk.lastIndexOf("? "),
        chunk.lastIndexOf(", ")
      );
      if (lastSentence > 50 && remaining.length > maxChunkLength) {
        chunk = chunk.slice(0, lastSentence + 1);
      }
      chunks.push(chunk.trim());
      remaining = remaining.slice(chunk.length);
    }

    setSpeaking(true);
    let chunkIndex = 0;

    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        setSpeaking(false);
        onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      const selectedVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (selectedVoice) {
        const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = selectedVoice?.lang || "en-US";

      utterance.onend = () => {
        chunkIndex++;
        speakNext();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }, [supported, voices, selectedVoiceURI, rate, pitch]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return {
    voices,
    selectedVoiceURI,
    selectVoice,
    rate,
    updateRate,
    pitch,
    updatePitch,
    speak,
    stop,
    speaking,
    supported,
  };
}
