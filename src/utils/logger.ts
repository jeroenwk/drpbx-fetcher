import { App } from "obsidian";
import { PlatformHelper } from "./platform";

export class FileLogger {
  private static logFile: string;
  private static app: App;
  private static enableFileLogging: boolean = false;
  private static writeQueue: Promise<void> = Promise.resolve();
  private static fileInitialized: boolean = false;

  static initialize(app: App, logFilePath?: string, enableFileLogging?: boolean) {
    this.app = app;
    this.enableFileLogging = enableFileLogging ?? false;
    this.fileInitialized = false;

    if (logFilePath) {
      this.logFile = logFilePath;
    } else {
      // Create unique log file name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.logFile = `dropbox-sync-debug-${timestamp}.md`;
    }

    // Log initialization to console
    console.log(`[FileLogger] Initialized - File: ${this.logFile}, Enabled: ${this.enableFileLogging}`);
  }

  private static async ensureFileExists(): Promise<void> {
    if (this.fileInitialized) {
      return;
    }

    try {
      // Check if file exists
      const exists = await this.app.vault.adapter.exists(this.logFile);

      if (!exists) {
        // Create file with header
        const manifest = (this.app as any).plugins?.manifests?.["drpbx-fetcher"];
        const version = manifest?.version || "unknown";
        const platform = PlatformHelper.getPlatformName();
        const timestamp = new Date().toISOString();
        const header = `# Dropbox Sync Debug Log\n\nPlatform: ${platform}\nVersion: ${version}\nStarted: ${timestamp}\n\n---\n`;

        await this.app.vault.adapter.write(this.logFile, header);
        console.log(`[FileLogger] Created log file: ${this.logFile}`);
      } else {
        console.log(`[FileLogger] Log file already exists: ${this.logFile}`);
      }

      this.fileInitialized = true;
    } catch (error) {
      console.error(`[FileLogger] Failed to ensure file exists:`, error);
      throw error;
    }
  }

  static async log(message: string, data?: any) {
    // Always log to console
    console.log(message, data);

    // Only write to file if enabled
    if (!this.enableFileLogging) {
      return;
    }

    // Check if initialized
    if (!this.app) {
      console.error("[FileLogger] Not initialized - app is undefined");
      return;
    }

    // Queue the write operation to prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Ensure file exists
        await this.ensureFileExists();

        // Build log entry
        const timestamp = new Date().toISOString();
        let logEntry = `\n## ${timestamp}\n${message}\n`;

        if (data) {
          logEntry += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n";
        }

        // Read existing content
        const existingContent = await this.app.vault.adapter.read(this.logFile);

        // Write with appended content
        await this.app.vault.adapter.write(this.logFile, existingContent + logEntry);

      } catch (error) {
        console.error("[FileLogger] Failed to write to log file:", error);
        console.error("[FileLogger] Error details:", {
          message: error.message,
          stack: error.stack,
          logFile: this.logFile
        });
      }
    });

    // Wait for write to complete
    await this.writeQueue;
  }

  static async error(message: string, error?: any) {
    const errorData = error ? {
      message: error.message,
      status: error.status,
      stack: error.stack,
      ...error
    } : undefined;

    await this.log(`❌ ERROR: ${message}`, errorData);
  }

  static async clear() {
    try {
      const exists = await this.app.vault.adapter.exists(this.logFile);
      if (exists) {
        await this.app.vault.adapter.remove(this.logFile);
        this.fileInitialized = false;
        console.log(`[FileLogger] Cleared log file: ${this.logFile}`);
      }
    } catch (error) {
      console.error("[FileLogger] Failed to clear log file:", error);
    }
  }
}
