import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 21600);
export const FETCH_RETRY_COUNT = Number(process.env.FETCH_RETRY_COUNT ?? 3);

export function nowIso() {
  return new Date().toISOString();
}

export function toCacheExpiryIso(ttlSeconds = CACHE_TTL_SECONDS) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}
