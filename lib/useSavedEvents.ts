"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Saved ("❤️") events live in this browser only: no account needed.
const STORAGE_KEY = "durbs:saved";
const listeners = new Set<() => void>();
let memoryFallback = "[]";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return memoryFallback; // private mode / blocked storage
  }
}

function writeRaw(value: string) {
  memoryFallback = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Keep working for this page view even if storage is unavailable.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): string[] {
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useSavedEvents() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const saved = useMemo(() => new Set(parse(raw)), [raw]);

  const toggle = useCallback((id: string) => {
    const ids = new Set(parse(readRaw()));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    writeRaw(JSON.stringify(Array.from(ids)));
  }, []);

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);

  return { saved, isSaved, toggle, count: saved.size };
}
