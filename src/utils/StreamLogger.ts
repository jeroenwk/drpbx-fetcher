import { requestUrl } from "obsidian";

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  meta: {
    version: string;
    platform: string;
  };
}

export type LoggerType = "console" | "stream";

interface StreamLoggerConfig {
  type: LoggerType;
  host: string;
  port: number;
  version: string;
  platform: string;
}

/**
 * Streaming logger that sends logs to a remote server
 * Falls back to console logging on errors
 */
export class StreamLogger {
  private static instance: StreamLogger | null = null;
  private config: StreamLoggerConfig;
  private failureCount = 0;
  private maxFailures = 5;
  private disabled = false;

  private constructor(config: StreamLoggerConfig) {
    this.config = config;
  }

  static initialize(config: StreamLoggerConfig): void {
    if (!StreamLogger.instance) {
      StreamLogger.instance = new StreamLogger(config);
    } else {
      // Update config if already initialized
      StreamLogger.instance.config = config;
      StreamLogger.instance.failureCount = 0;
      StreamLogger.instance.disabled = false;
    }
  }

  static getInstance(): StreamLogger {
    if (!StreamLogger.instance) {
      throw new Error("StreamLogger not initialized. Call initialize() first.");
    }
    return StreamLogger.instance;
  }

  /**
   * Log an info message
   */
  static log(message: string, data?: unknown): void {
    this.getInstance().send("info", message, data);
  }

  /**
   * Log a warning message
   */
  static warn(message: string, data?: unknown): void {
    this.getInstance().send("warn", message, data);
  }

  /**
   * Log an error message
   */
  static error(message: string, error?: unknown): void {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error ? {
      value: String(error)
    } : undefined;

    this.getInstance().send("error", message, errorData);
  }

  /**
   * Log a debug message
   */
  static debug(message: string, data?: unknown): void {
    this.getInstance().send("debug", message, data);
  }

  /**
   * Send log message to server or console
   */
  private send(level: LogLevel, message: string, data?: unknown): void {
    // Always log to console as fallback
    const consoleMessage = data ? `${message}` : message;
    switch (level) {
      case "info":
      case "debug":
        console.log(consoleMessage, data || "");
        break;
      case "warn":
        console.warn(consoleMessage, data || "");
        break;
      case "error":
        console.error(consoleMessage, data || "");
        break;
    }

    // If stream logging is disabled or has too many failures, skip network request
    if (this.config.type !== "stream" || this.disabled) {
      return;
    }

    // Send to server (non-blocking, fire-and-forget)
    this.sendToServer(level, message, data).catch((error) => {
      // Silently handle errors to avoid disrupting plugin
      this.failureCount++;
      if (this.failureCount >= this.maxFailures) {
        console.warn(
          `[StreamLogger] Disabled after ${this.maxFailures} consecutive failures. Last error:`,
          error.message
        );
        this.disabled = true;
      }
    });
  }

  /**
   * Send log message to remote server
   */
  private async sendToServer(level: LogLevel, message: string, data?: unknown): Promise<void> {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data || undefined,
      meta: {
        version: this.config.version,
        platform: this.config.platform,
      },
    };

    const url = `http://${this.config.host}:${this.config.port}/log`;

    try {
      await requestUrl({
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logMessage),
      });

      // Reset failure count on success
      this.failureCount = 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Rethrow to be caught by send() method
      throw new Error(`Failed to send log to ${url}: ${errorMessage}`);
    }
  }

  /**
   * Check if stream logging is available
   */
  static isStreamAvailable(): boolean {
    const instance = this.getInstance();
    return instance.config.type === "stream" && !instance.disabled;
  }

  /**
   * Reset failure counter (useful after fixing connection issues)
   */
  static reset(): void {
    const instance = this.getInstance();
    instance.failureCount = 0;
    instance.disabled = false;
  }
}
