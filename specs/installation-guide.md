# Installation Guide

## Installing Dropbox Fetcher Plugin

### Prerequisites

- Obsidian installed on your system
- Node.js and npm installed (for building from source)

### Installation Steps

#### Method 1: Install from Source (Development)

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd drpbx-fetcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the plugin**
   ```bash
   npm run build
   ```

4. **Copy to your Obsidian vault**

   Create the plugin directory:
   ```bash
   mkdir -p "[Your Vault Path]/.obsidian/plugins/drpbx-fetcher"
   ```

   Copy the built files:
   ```bash
   cp dist/main.js dist/manifest.json dist/versions.json "[Your Vault Path]/.obsidian/plugins/drpbx-fetcher/"
   ```

5. **Enable the plugin in Obsidian**
   - Restart Obsidian or reload plugins (Cmd+R on Mac, Ctrl+R on Windows/Linux)
   - Go to Settings → Community plugins
   - Find "Dropbox Fetcher" in the Installed plugins list
   - Toggle it on

#### Method 2: Development with Symlink

For easier development with auto-reload:

1. **Build the project**
   ```bash
   npm install
   npm run build
   ```

2. **Create a symlink**
   ```bash
   ln -s /path/to/drpbx-fetcher/dist "[Your Vault Path]/.obsidian/plugins/drpbx-fetcher"
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

   This watches for changes and rebuilds automatically.

4. **Enable in Obsidian**
   - Restart Obsidian or reload plugins
   - Enable "Dropbox Fetcher" in Settings → Community plugins

## Configuration

After installation, you need to configure the plugin:

1. **Get Dropbox App Credentials**
   - Go to https://www.dropbox.com/developers/apps
   - Create a new app (Scoped access, Full Dropbox)
   - Copy your App key (Client ID)
   - Set redirect URI to: `http://localhost:53134/callback`

2. **Configure in Obsidian**
   - Open Settings → Dropbox Fetcher
   - Paste your Client ID
   - Click "Authenticate" to connect your Dropbox account
   - Add folder mappings (Remote Dropbox path → Local vault path)

3. **Sync your files**
   - Click the sync ribbon icon, or
   - Use Command Palette: "Sync Dropbox files"
   - Files sync automatically on startup

## Troubleshooting

### Plugin doesn't appear in Obsidian
- Ensure all three files are in the plugin folder: `main.js`, `manifest.json`, `versions.json`
- Try restarting Obsidian completely
- Check that Community plugins are enabled in Settings → Community plugins

### Authentication fails
- Verify your Client ID is correct
- Ensure redirect URI is set to `http://localhost:53134/callback` in Dropbox app settings
- Check that port 53134 is not already in use

### Files not syncing
- Verify folder mappings are configured correctly
- Remote paths must start with `/`
- Check Obsidian console (Ctrl+Shift+I / Cmd+Option+I) for errors
