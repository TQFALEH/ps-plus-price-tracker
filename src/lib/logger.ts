type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    meta: meta ?? null
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta)
};
