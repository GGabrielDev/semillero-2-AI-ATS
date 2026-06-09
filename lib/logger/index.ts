export interface LogPayload {
  message: string;
  error?: Error | unknown;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static format(level: "INFO" | "WARN" | "ERROR", payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const parts: string[] = [`[${timestamp}] [${level}] ${payload.message}`];

    if (payload.latencyMs !== undefined) {
      parts.push(`(Latency: ${payload.latencyMs}ms)`);
    }

    if (payload.error) {
      const errorMsg =
        payload.error instanceof Error
          ? payload.error.stack || payload.error.message
          : String(payload.error);
      parts.push(`\nError: ${errorMsg}`);
    }

    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      parts.push(`\nMetadata: ${JSON.stringify(payload.metadata, null, 2)}`);
    }

    return parts.join(" ");
  }

  static info(message: string, metadata?: Record<string, unknown>, latencyMs?: number) {
    console.log(this.format("INFO", { message, metadata, latencyMs }));
  }

  static warn(message: string, metadata?: Record<string, unknown>, latencyMs?: number) {
    console.warn(this.format("WARN", { message, metadata, latencyMs }));
  }

  static error(
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, unknown>,
    latencyMs?: number
  ) {
    console.error(this.format("ERROR", { message, error, metadata, latencyMs }));
  }
}
