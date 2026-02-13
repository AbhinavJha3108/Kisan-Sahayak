type LogLevel = "info" | "warn" | "error";

function baseLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta
  };
  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  baseLog("info", message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  baseLog("warn", message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>) {
  baseLog("error", message, meta);
}
