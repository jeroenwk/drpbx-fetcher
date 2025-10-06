import { Platform } from "obsidian";

export class PlatformHelper {
  static isMobile(): boolean {
    return Platform.isMobile || Platform.isMobileApp;
  }

  static isDesktop(): boolean {
    return !this.isMobile();
  }

  static isIOS(): boolean {
    return Platform.isIosApp;
  }

  static isAndroid(): boolean {
    return Platform.isAndroidApp;
  }

  static getRedirectUri(): string {
    return this.isMobile()
      ? "obsidian://dropbox-callback"
      : "http://localhost:53134/callback";
  }

  static getPlatformName(): string {
    if (this.isIOS()) return "iOS";
    if (this.isAndroid()) return "Android";
    if (Platform.isMacOS) return "macOS";
    if (Platform.isWin) return "Windows";
    if (Platform.isLinux) return "Linux";
    return "Desktop";
  }
}
