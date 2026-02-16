import { logger } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  label: string
): Promise<T> {
  let attempt = 0;
  let delayMs = 500;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      logger.warn(`${label} failed. Retrying`, { attempt, delayMs, error });
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}
