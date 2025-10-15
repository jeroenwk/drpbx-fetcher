/**
 * Mock implementation of Obsidian API for testing
 */

export const moment = (date?: Date | string) => {
  const d = date ? new Date(date) : new Date('2024-01-15T14:30:00Z');

  return {
    format: (formatStr: string) => {
      // Simple mock implementation for common formats
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      const formats: Record<string, string> = {
        'YYYY-MM-DD': `${year}-${month}-${day}`,
        'YYYY-MM-DD HH:mm': `${year}-${month}-${day} ${hours}:${minutes}`,
        'YYYY-MM-DD HH:mm:ss': `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
        'HH:mm': `${hours}:${minutes}`,
        'HH:mm:ss': `${hours}:${minutes}:${seconds}`,
        'YYYY': String(year),
        'MM': month,
        'DD': day,
      };

      return formats[formatStr] || formatStr;
    },
  };
};

export class Platform {
  static isMobile = false;
  static isMobileApp = false;
  static isIosApp = false;
  static isAndroidApp = false;
  static isMacOS = true;
  static isWin = false;
  static isLinux = false;
}

export class Vault {
  // Mock implementation
}

export class Plugin {
  // Mock implementation
}

export class PluginSettingTab {
  // Mock implementation
}

export class Setting {
  // Mock implementation
}

export class Notice {
  constructor(message: string) {
    // Mock notice
  }
}

export class Modal {
  // Mock implementation
}

export class TFolder {
  // Mock implementation
}

export const requestUrl = jest.fn();

export type RequestUrlParam = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type RequestUrlResponse = {
  status: number;
  headers: Record<string, string>;
  json: unknown;
  text: string;
  arrayBuffer: ArrayBuffer;
};
