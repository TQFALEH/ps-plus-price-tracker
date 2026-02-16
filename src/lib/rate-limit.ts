const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Entry = {
  count: number;
  resetAt: number;
};

const requestCounts = new Map<string, Entry>();

export function checkRateLimit(key: string) {
  const now = Date.now();
  const existing = requestCounts.get(key);

  if (!existing || now > existing.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return { ok: false, remaining: 0 };
  }

  existing.count += 1;
  return { ok: true, remaining: MAX_REQUESTS - existing.count };
}
