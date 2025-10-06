import { App } from "obsidian";
import { PlatformHelper } from "./platform";

export class FileLogger {
  private static logFile: string;
  private static app: App;

  static initialize(app: App) {
    this.app = app;
    // Create unique log file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = `dropbox-sync-debug-${timestamp}.md`;
  }

  static async log(message: string, data?: any) {
    // Check if initialized
    if (!this.app) {
      console.error("FileLogger not initialized - app is undefined");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      let logEntry = `\n## ${timestamp}\n${message}\n`;

      if (data) {
        logEntry += "```json\n" + JSON.stringify(data, null, 2) + "\n```\n";
      }

      // Try to append to existing file first
      try {
        const existingFile = this.app.vault.getAbstractFileByPath(this.logFile);
        if (existingFile) {
          const currentContent = await this.app.vault.read(existingFile as any);
          await this.app.vault.modify(existingFile as any, currentContent + logEntry);
        } else {
          // File doesn't exist, create it
          const manifest = (this.app as any).plugins?.manifests?.["drpbx-fetcher"];
          const version = manifest?.version || "unknown";
          const platform = PlatformHelper.getPlatformName();
          const header = `# Dropbox Sync Debug Log\n\nPlatform: ${platform}\nVersion: ${version}\nStarted: ${timestamp}\n\n---\n`;
          await this.app.vault.create(this.logFile, header + logEntry);
        }
      } catch (createError) {
        // If create fails because file exists, try to append again
        if (createError.message && createError.message.includes("already exists")) {
          const existingFile = this.app.vault.getAbstractFileByPath(this.logFile);
          if (existingFile) {
            const currentContent = await this.app.vault.read(existingFile as any);
            await this.app.vault.modify(existingFile as any, currentContent + logEntry);
          }
        } else {
          throw createError;
        }
      }
    } catch (error) {
      console.error("Failed to write to log file:", error);
      // Don't show notice for every log error, just log to console
    }
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
      const existingFile = this.app.vault.getAbstractFileByPath(this.logFile);
      if (existingFile) {
        await this.app.vault.delete(existingFile);
      }
    } catch (error) {
      console.error("Failed to clear log file:", error);
    }
  }
}
