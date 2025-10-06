# iOS Migration Guide for Dropbox Fetcher Plugin

## Overview
This guide details the modifications needed to make the drpbx-fetcher Obsidian plugin compatible with iOS devices. The main challenge is replacing the localhost OAuth callback system with a mobile-friendly approach.

---

## Phase 1: Dependency Audit & Cleanup

### 1.1 Remove Node.js-Specific Dependencies

**Check your `package.json` and remove:**
- `http` / `https` modules (if imported)
- `express` (if used for OAuth server)
- Native Node.js modules (`fs`, `crypto`, `net`)

**Keep these safe dependencies:**
```json
{
  "dependencies": {
    "obsidian": "^1.0.0",
    "dropbox": "^10.34.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0",
    "@types/node": "^20.0.0"
  }
}
```

### 1.2 Replace Node.js Crypto with Web Crypto API

**Old Code (Node.js):**
```typescript
import crypto from 'crypto';

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}
```

**New Code (Web Crypto - Cross-platform):**
```typescript
// utils/crypto.ts
export class PKCEGenerator {
  static async generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  private static base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
```

---

## Phase 2: OAuth Flow Redesign

### 2.1 Update Dropbox App Configuration

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Add **two** redirect URIs:
   - Desktop: `http://localhost:53134/callback`
   - Mobile: `obsidian://dropbox-callback`

### 2.2 Create Platform Detection Helper

```typescript
// utils/platform.ts
import { Platform } from 'obsidian';

export class PlatformHelper {
  static isMobile(): boolean {
    return Platform.isMobile || Platform.isMobileApp;
  }

  static isDesktop(): boolean {
    return !this.isMobile();
  }

  static getRedirectUri(): string {
    return this.isMobile() 
      ? 'obsidian://dropbox-callback'
      : 'http://localhost:53134/callback';
  }
}
```

### 2.3 Refactor OAuth Authentication

**Create a new authentication manager:**

```typescript
// auth/OAuthManager.ts
import { Notice, Platform } from 'obsidian';
import { PKCEGenerator } from '../utils/crypto';
import { PlatformHelper } from '../utils/platform';
import DropboxFetcherPlugin from '../main';

export class OAuthManager {
  constructor(
    private plugin: DropboxFetcherPlugin,
    private clientId: string
  ) {}

  async authenticate(): Promise<void> {
    if (PlatformHelper.isDesktop()) {
      await this.authenticateDesktop();
    } else {
      await this.authenticateMobile();
    }
  }

  // Desktop OAuth (existing localhost approach)
  private async authenticateDesktop(): Promise<void> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);
    
    // Store verifier for later use
    this.plugin.settings.tempCodeVerifier = verifier;
    await this.plugin.saveSettings();

    // Start local server
    const server = new LocalOAuthServer(
      this.plugin,
      this.clientId,
      verifier
    );
    
    await server.start();
    
    // Open browser
    const authUrl = this.buildAuthUrl(challenge, PlatformHelper.getRedirectUri());
    window.open(authUrl);
  }

  // Mobile OAuth (new custom URI scheme approach)
  private async authenticateMobile(): Promise<void> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);
    
    // Store verifier for callback handling
    this.plugin.settings.tempCodeVerifier = verifier;
    this.plugin.settings.authInProgress = true;
    await this.plugin.saveSettings();

    // Build auth URL with custom URI redirect
    const authUrl = this.buildAuthUrl(challenge, PlatformHelper.getRedirectUri());
    
    new Notice('Opening Dropbox authorization...');
    
    // Open in external browser
    window.open(authUrl, '_blank');
    
    // Register URI handler
    this.registerURIHandler();
  }

  private buildAuthUrl(challenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline'
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  private registerURIHandler(): void {
    // Register handler for obsidian:// protocol
    // This will be called when user is redirected back
    this.plugin.registerObsidianProtocolHandler(
      'dropbox-callback',
      async (params: any) => {
        await this.handleMobileCallback(params);
      }
    );
  }

  private async handleMobileCallback(params: any): Promise<void> {
    if (!this.plugin.settings.authInProgress) {
      new Notice('No authentication in progress');
      return;
    }

    if (params.error) {
      new Notice(`Authentication failed: ${params.error}`);
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
      return;
    }

    if (!params.code) {
      new Notice('No authorization code received');
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
      return;
    }

    // Exchange code for token
    await this.exchangeCodeForToken(params.code);
  }

  private async exchangeCodeForToken(code: string): Promise<void> {
    const verifier = this.plugin.settings.tempCodeVerifier;
    
    if (!verifier) {
      new Notice('Authentication error: missing verifier');
      return;
    }

    try {
      const response = await fetch('https://api.dropbox.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          redirect_uri: PlatformHelper.getRedirectUri(),
          code_verifier: verifier,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store tokens
      this.plugin.settings.accessToken = data.access_token;
      this.plugin.settings.refreshToken = data.refresh_token;
      this.plugin.settings.authInProgress = false;
      this.plugin.settings.tempCodeVerifier = '';
      
      await this.plugin.saveSettings();
      
      new Notice('Successfully authenticated with Dropbox!');
      
    } catch (error) {
      console.error('Token exchange error:', error);
      new Notice(`Authentication failed: ${error.message}`);
      
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
    }
  }
}
```

### 2.4 Remove Local HTTP Server (Desktop Only)

Keep your existing `LocalOAuthServer` class but wrap it in platform checks:

```typescript
// auth/LocalOAuthServer.ts
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { PlatformHelper } from '../utils/platform';

export class LocalOAuthServer {
  private server: any;
  
  constructor(
    private plugin: any,
    private clientId: string,
    private verifier: string
  ) {
    // Only import http module on desktop
    if (PlatformHelper.isDesktop()) {
      // Your existing server code
    }
  }

  async start(): Promise<void> {
    if (!PlatformHelper.isDesktop()) {
      throw new Error('Local server only available on desktop');
    }
    // Your existing start logic
  }

  // ... rest of your existing server code
}
```

---

## Phase 3: Main Plugin Integration

### 3.1 Update Plugin Settings Interface

```typescript
// settings.ts
export interface DropboxFetcherSettings {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  folderMappings: FolderMapping[];
  
  // Add these new fields for mobile auth
  tempCodeVerifier: string;
  authInProgress: boolean;
}

export const DEFAULT_SETTINGS: DropboxFetcherSettings = {
  clientId: '',
  accessToken: '',
  refreshToken: '',
  folderMappings: [],
  tempCodeVerifier: '',
  authInProgress: false,
};
```

### 3.2 Update Main Plugin Class

```typescript
// main.ts
import { Plugin } from 'obsidian';
import { OAuthManager } from './auth/OAuthManager';
import { PlatformHelper } from './utils/platform';

export default class DropboxFetcherPlugin extends Plugin {
  settings: DropboxFetcherSettings;
  oauthManager: OAuthManager;

  async onload() {
    await this.loadSettings();
    
    // Initialize OAuth manager
    this.oauthManager = new OAuthManager(this, this.settings.clientId);
    
    // Register protocol handler for mobile (important!)
    this.registerObsidianProtocolHandler(
      'dropbox-callback',
      async (params) => {
        if (PlatformHelper.isMobile()) {
          await this.oauthManager['handleMobileCallback'](params);
        }
      }
    );
    
    // Add ribbon icon
    this.addRibbonIcon('sync', 'Sync Dropbox files', () => {
      this.syncFiles();
    });
    
    // Add command
    this.addCommand({
      id: 'sync-dropbox',
      name: 'Sync Dropbox files',
      callback: () => this.syncFiles(),
    });
    
    // Add settings tab
    this.addSettingTab(new DropboxFetcherSettingTab(this.app, this));
    
    // Auto-sync on startup (with delay)
    if (this.settings.accessToken) {
      setTimeout(() => this.syncFiles(), 3000);
    }
  }

  async authenticate() {
    await this.oauthManager.authenticate();
  }

  async syncFiles() {
    // Your existing sync logic - no changes needed
    // File operations use Obsidian's API which is cross-platform
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

---

## Phase 4: File Operations Verification

### 4.1 Ensure Cross-Platform File APIs

**Verify all file operations use Obsidian's API:**

```typescript
// sync/FileSyncer.ts
export class FileSyncer {
  constructor(private app: App) {}

  async downloadFile(dropboxPath: string, localPath: string, content: ArrayBuffer) {
    // ✓ Cross-platform - uses Obsidian's API
    await this.app.vault.adapter.writeBinary(localPath, content);
  }

  async createFolder(path: string) {
    // ✓ Cross-platform
    const folder = this.app.vault.getAbstractFileByPath(path);
    if (!folder) {
      await this.app.vault.createFolder(path);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    // ✓ Cross-platform
    return await this.app.vault.adapter.exists(path);
  }

  async getFileSize(path: string): Promise<number> {
    // ✓ Cross-platform
    const stat = await this.app.vault.adapter.stat(path);
    return stat?.size ?? 0;
  }
}
```

---

## Phase 5: Settings UI Updates

### 5.1 Update Settings Tab

```typescript
// settings-tab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import { PlatformHelper } from './utils/platform';

export class DropboxFetcherSettingTab extends PluginSettingTab {
  plugin: DropboxFetcherPlugin;

  constructor(app: App, plugin: DropboxFetcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Dropbox Fetcher Settings' });

    // Platform indicator
    new Setting(containerEl)
      .setName('Platform')
      .setDesc(`Running on: ${PlatformHelper.isMobile() ? 'Mobile (iOS/Android)' : 'Desktop'}`)
      .setClass('dropbox-platform-info');

    // Client ID
    new Setting(containerEl)
      .setName('Dropbox App Client ID')
      .setDesc('Enter your Dropbox app client ID')
      .addText(text => text
        .setPlaceholder('Enter client ID')
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        }));

    // Authentication button
    const authSetting = new Setting(containerEl)
      .setName('Authentication')
      .setDesc(
        this.plugin.settings.accessToken
          ? '✓ Connected to Dropbox'
          : 'Click to connect your Dropbox account'
      );

    authSetting.addButton(button => button
      .setButtonText(this.plugin.settings.accessToken ? 'Re-authenticate' : 'Authenticate')
      .onClick(async () => {
        await this.plugin.authenticate();
      }));

    // Mobile-specific instructions
    if (PlatformHelper.isMobile()) {
      containerEl.createEl('div', {
        cls: 'setting-item-description',
        text: '📱 Mobile: After clicking Authenticate, you\'ll be redirected to Dropbox. ' +
              'After authorizing, you\'ll be brought back to Obsidian automatically.'
      });
    }

    // Folder mappings section
    containerEl.createEl('h3', { text: 'Folder Mappings' });

    // Display existing mappings
    this.plugin.settings.folderMappings.forEach((mapping, index) => {
      new Setting(containerEl)
        .setName(`Mapping ${index + 1}`)
        .setDesc(`${mapping.remotePath} → ${mapping.localPath}`)
        .addButton(button => button
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.folderMappings.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }));
    });

    // Add new mapping
    let newRemotePath = '';
    let newLocalPath = '';

    new Setting(containerEl)
      .setName('Add new mapping')
      .setDesc('Remote Dropbox path')
      .addText(text => text
        .setPlaceholder('/Documents/Notes')
        .onChange(value => newRemotePath = value));

    new Setting(containerEl)
      .setDesc('Local vault path')
      .addText(text => text
        .setPlaceholder('ImportedNotes')
        .onChange(value => newLocalPath = value));

    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Add Mapping')
        .setCta()
        .onClick(async () => {
          if (newRemotePath && newLocalPath) {
            this.plugin.settings.folderMappings.push({
              remotePath: newRemotePath,
              localPath: newLocalPath
            });
            await this.plugin.saveSettings();
            this.display();
          }
        }));

    // Sync button
    new Setting(containerEl)
      .setName('Manual Sync')
      .setDesc('Sync all configured folders now')
      .addButton(button => button
        .setButtonText('Sync Now')
        .setCta()
        .onClick(() => this.plugin.syncFiles()));
  }
}
```

---

## Phase 6: Testing Checklist

### 6.1 Desktop Testing
- [ ] OAuth flow works with localhost
- [ ] Files sync correctly
- [ ] Settings persist
- [ ] Auto-sync on startup works

### 6.2 iOS Testing
- [ ] Custom URI scheme redirects back to Obsidian
- [ ] OAuth callback is received and processed
- [ ] Tokens are stored correctly
- [ ] Files download and sync
- [ ] Folders are created properly
- [ ] Settings UI displays correctly on mobile
- [ ] Safari browser opens correctly for OAuth
- [ ] Return to Obsidian works smoothly

### 6.3 Android Testing
- [ ] Custom URI scheme redirects back to Obsidian
- [ ] OAuth callback is received and processed
- [ ] Tokens are stored correctly
- [ ] Files download and sync
- [ ] Folders are created properly
- [ ] Settings UI displays correctly on mobile
- [ ] Chrome/default browser opens correctly for OAuth
- [ ] Return to Obsidian works from browser
- [ ] Test on different Android versions (10+)

### 6.4 Common Issues & Solutions

**Issue: URI handler not triggered**
```typescript
// Make sure protocol handler is registered in onload()
this.registerObsidianProtocolHandler('dropbox-callback', handler);
```

**Issue: App doesn't return after OAuth (iOS)**
- Verify `obsidian://dropbox-callback` is added to Dropbox app redirect URIs
- Check Obsidian mobile version supports protocol handlers (v1.4.0+)
- Ensure Safari is set as default browser or the OAuth flow is opening Safari

**Issue: App doesn't return after OAuth (Android)**
- Android may show "Open with" dialog - user must select Obsidian
- Some Android browsers cache the redirect - try clearing browser cache
- Test with both Chrome and Samsung Internet Browser
- Verify Android app links are properly configured in Obsidian

**Issue: Tokens not persisting**
```typescript
// Always await saveSettings
await this.plugin.saveSettings();
```

**Issue: Different behavior on Android vs iOS**
```typescript
// Use platform-specific handling if needed
if (Platform.isMobileApp) {
  // Mobile-specific code
  if (Platform.isAndroidApp) {
    // Android-specific workarounds
  } else if (Platform.isIosApp) {
    // iOS-specific workarounds
  }
}
```

---

## Phase 7: Build & Distribution

### 7.1 Update Build Configuration

**Ensure your `esbuild.config.mjs` or build script targets browser environment:**

```javascript
// esbuild.config.mjs
import esbuild from 'esbuild';

const production = process.argv[2] === 'production';

esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*'],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  platform: 'browser', // Important for mobile compatibility
  define: {
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')
  }
}).catch(() => process.exit(1));
```

### 7.2 Update README

Add mobile-specific setup instructions:

```markdown
## Mobile Setup (iOS/Android)

1. Install the plugin on your mobile device
2. In your Dropbox App Console, add the redirect URI: `obsidian://dropbox-callback`
3. In plugin settings, enter your Client ID
4. Tap "Authenticate"
5. You'll be redirected to Dropbox in your browser
6. After authorizing, you'll automatically return to Obsidian
7. Configure your folder mappings and sync!

### Mobile Limitations
- The OAuth flow requires opening an external browser
- Large file downloads may take longer on mobile networks
- Background sync is not supported on mobile
```

---

## Summary of Changes

### Files to Modify
1. `main.ts` - Add protocol handler registration, platform detection
2. `settings.ts` - Add mobile auth state fields
3. `settings-tab.ts` - Add mobile UI adaptations
4. Create `auth/OAuthManager.ts` - New unified auth manager
5. Create `utils/crypto.ts` - Web Crypto implementation
6. Create `utils/platform.ts` - Platform detection helper
7. Update `package.json` - Remove Node.js dependencies
8. Update `esbuild.config.mjs` - Set platform to 'browser'

### New Features
- ✅ Cross-platform OAuth (desktop + mobile)
- ✅ Custom URI scheme handling for iOS
- ✅ Web Crypto API for PKCE
- ✅ Platform-specific UI hints

### Backward Compatibility
- ✅ Desktop functionality remains unchanged
- ✅ Existing settings migrate automatically
- ✅ No breaking changes for current users

---

## Next Steps

1. **Backup your current code**
2. **Implement Phase 1-3** (core OAuth changes)
3. **Test on desktop** to ensure no regressions
4. **Build and sideload** on iOS for testing
5. **Iterate based on mobile testing**
6. **Update documentation**
7. **Release new version** with mobile support

## Support Resources

- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian Mobile API](https://docs.obsidian.md/Plugins/Guides/Understanding+platform+differences)
- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide)
- [Web Crypto API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

Good luck with your iOS migration! 🚀