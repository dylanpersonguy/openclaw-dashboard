"use client";

import { AuthMode } from "@/auth/mode";

let localToken: string | null = null;
let tokenBypassed = false;
const STORAGE_KEY = "mc_local_auth_token";
const BYPASS_KEY = "mc_local_auth_bypass";

export function isLocalAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === AuthMode.Local;
}

export function setLocalAuthToken(token: string): void {
  localToken = token;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Ignore storage failures (private mode / policy).
  }
}

export function getLocalAuthToken(): string | null {
  if (localToken) return localToken;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      localToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage failures (private mode / policy).
  }
  return null;
}

export function clearLocalAuthToken(): void {
  localToken = null;
  tokenBypassed = false;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(BYPASS_KEY);
  } catch {
    // Ignore storage failures (private mode / policy).
  }
}

/**
 * Mark local auth as bypassed (no token needed — backend has no
 * LOCAL_AUTH_TOKEN configured).
 */
export function setLocalAuthBypassed(): void {
  tokenBypassed = true;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BYPASS_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

export function isLocalAuthBypassed(): boolean {
  if (tokenBypassed) return true;
  if (typeof window === "undefined") return false;
  try {
    const stored = window.sessionStorage.getItem(BYPASS_KEY);
    if (stored === "1") {
      tokenBypassed = true;
      return true;
    }
  } catch {
    // Ignore storage failures.
  }
  return false;
}
