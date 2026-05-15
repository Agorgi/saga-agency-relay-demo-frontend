"use client";

import { useEffect, useState } from "react";
import {
  PERSONA_CHANGE_EVENT,
  PERSONA_COOKIE_NAME,
  PERSONA_STORAGE_KEY,
  normalizePersona,
  type Persona,
} from "@/lib/sagasanPersonas";

function readPersonaFromCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PERSONA_COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  return normalizePersona(decodeURIComponent(cookie.split("=")[1] || ""));
}

export function readSessionPersona() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = normalizePersona(window.localStorage.getItem(PERSONA_STORAGE_KEY));
  return stored ?? readPersonaFromCookie();
}

export function writeSessionPersona(persona: Persona | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextPersona = normalizePersona(persona);

  if (nextPersona) {
    window.localStorage.setItem(PERSONA_STORAGE_KEY, nextPersona);
    document.cookie = `${PERSONA_COOKIE_NAME}=${encodeURIComponent(nextPersona)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } else {
    window.localStorage.removeItem(PERSONA_STORAGE_KEY);
    document.cookie = `${PERSONA_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }

  window.dispatchEvent(
    new CustomEvent(PERSONA_CHANGE_EVENT, {
      detail: { persona: nextPersona },
    }),
  );
}

export function useSessionPersona() {
  const [persona, setPersonaState] = useState<Persona | null>(null);

  useEffect(() => {
    setPersonaState(readSessionPersona());

    function handleChange(event: Event) {
      const nextPersona = normalizePersona(
        (event as CustomEvent<{ persona?: string | null }>).detail?.persona,
      );
      setPersonaState(nextPersona ?? readSessionPersona());
    }

    window.addEventListener(PERSONA_CHANGE_EVENT, handleChange);
    return () => {
      window.removeEventListener(PERSONA_CHANGE_EVENT, handleChange);
    };
  }, []);

  return {
    persona,
    setPersona: writeSessionPersona,
  };
}
