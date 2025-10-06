# Dropbox App Setup Guide

## How to Get Your Dropbox Client ID

Follow these steps to create a Dropbox app and obtain your Client ID for the plugin.

### Step 1: Access Dropbox App Console

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Sign in with your Dropbox account

### Step 2: Create a New App

1. Click the **"Create app"** button
2. Choose the following options:

   **Choose an API:**
   - Select **"Scoped access"**

   **Choose the type of access you need:**
   - Select **"Full Dropbox"** (to access all folders)
   - Alternatively, select **"App folder"** if you only want to sync a specific app folder

   **Name your app:**
   - Enter a unique name (e.g., "Obsidian Dropbox Fetcher")
   - Note: App names must be unique across all Dropbox apps

3. Check the box to agree to Dropbox API Terms and Conditions
4. Click **"Create app"**

### Step 3: Configure App Settings

Once your app is created, you'll be taken to the app's settings page.

#### Required Settings

1. **OAuth 2 Redirect URIs**
   - Scroll down to the "OAuth 2" section
   - Click **"Add"** under "Redirect URIs"
   - Enter: `http://localhost:53134/callback`
   - Click **"Add"**

   This allows the plugin to receive the authentication response.

2. **Permissions (Scopes)**
   - Go to the **"Permissions"** tab
   - Enable the following scopes:
     - `files.metadata.read` - View information about files and folders
     - `files.content.read` - View content of files and folders
   - Click **"Submit"** at the bottom

### Step 4: Get Your Client ID

1. Go back to the **"Settings"** tab
2. Find the **"App key"** field at the top of the page
3. Copy the App key - this is your **Client ID**
4. Paste this into the Obsidian plugin settings

### Important Notes

- **Keep your App key secure** - Don't share it publicly
- **App secret is NOT needed** - This plugin uses PKCE (Proof Key for Code Exchange) for secure OAuth without requiring an app secret
- **Redirect URI must match exactly** - Make sure it's `http://localhost:53134/callback`
- The plugin uses **offline access** (refresh tokens) so you won't need to re-authenticate frequently

### Permissions Explained

The plugin requires minimal permissions:

- **files.metadata.read**: To list files and folders in your Dropbox
- **files.content.read**: To download file content to your vault

The plugin does NOT:
- Write, modify, or delete any files in your Dropbox
- Access your Dropbox permanently (you can revoke access anytime)
- Share your data with third parties

### Revoking Access

If you want to revoke the plugin's access to your Dropbox:

1. Go to your [Dropbox Account Settings](https://www.dropbox.com/account/connected_apps)
2. Find your app in the "Linked apps" section
3. Click **"Disconnect"** next to the app name

You can re-authenticate anytime by clicking "Authenticate" in the plugin settings.

## Troubleshooting

### "App name already taken"
- Try a different, more unique name
- You can append numbers or your username (e.g., "Obsidian-Fetcher-YourName")

### "Invalid redirect URI"
- Make sure you entered exactly: `http://localhost:53134/callback`
- No trailing slash, no extra spaces
- Must be added in the app settings before authenticating

### "Permission denied" errors during sync
- Go to the Permissions tab in your Dropbox app settings
- Ensure required scopes are enabled
- Click "Submit" to save changes
- Re-authenticate in the plugin (clear authentication and authenticate again)

### Can't find App key
- It's on the Settings tab of your app
- Located near the top, labeled "App key"
- It's a long string of letters and numbers (not the App secret)
