import { randomUUID } from "node:crypto";
import { refreshAll } from "@/lib/pricing-service";
import { logger } from "@/lib/logger";

export type RefreshJobStatus = "queued" | "running" | "done" | "failed";

export interface RefreshJob {
  id: string;
  status: RefreshJobStatus;
  force: boolean;
  staleOnly: boolean;
  progressText: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  total: number;
  processed: number;
  ok: number;
  cached: number;
  failed: number;
}

const jobs = new Map<string, RefreshJob>();

export function getRefreshJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}

export function createRefreshJob(input?: { force?: boolean; staleOnly?: boolean }) {
  const force = Boolean(input?.force);
  const staleOnly = Boolean(input?.staleOnly);
  const id = randomUUID();

  const job: RefreshJob = {
    id,
    status: "queued",
    force,
    staleOnly,
    progressText: "Queued",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    total: 0,
    processed: 0,
    ok: 0,
    cached: 0,
    failed: 0
  };
  jobs.set(id, job);

  // Fire-and-forget background execution in the same runtime.
  setTimeout(() => {
    runRefreshJob(id).catch((error) => {
      logger.error("Refresh job failed", { jobId: id, error });
    });
  }, 20);

  return job;
}

async function runRefreshJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  const batchSize = 6;
  let offset = 0;
  let done = false;

  try {
    while (!done) {
      const response = await refreshAll(!job.staleOnly || job.force, { offset, limit: batchSize });
      job.total = response.total;
      job.processed += response.processed;
      job.ok += response.ok;
      job.cached += response.cached;
      job.failed += response.failed;
      job.progressText = `${response.offset + 1}-${response.offset + response.processed} / ${response.total}`;
      done = response.done;
      offset = response.nextOffset ?? 0;
    }

    job.status = "done";
    job.finishedAt = new Date().toISOString();
    job.progressText = "Done";
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Refresh job failed";
    job.finishedAt = new Date().toISOString();
    job.progressText = "Failed";
  }
}
