# Debugging Guide

## How to View Error Logs

When troubleshooting issues with the Dropbox Fetcher plugin, you'll need to view error logs. Here are the methods:

### Method 1: Obsidian Developer Console (Recommended)

The Developer Console shows all plugin errors and logs in real-time.

**Steps:**

1. Open Obsidian
2. Open the Developer Console:
   - **Mac**: Press `Cmd + Option + I`
   - **Windows/Linux**: Press `Ctrl + Shift + I`
3. Click the **"Console"** tab at the top
4. Trigger the sync (click sync button or use command palette)
5. Watch for red error messages in the console

**Tips:**
- Red text = errors
- Yellow text = warnings
- Gray text = info messages
- You can type `console.clear()` to clear old messages
- Right-click on messages to copy or save them

### Method 2: Launch Obsidian from Terminal

This method shows logs directly in your terminal window.

**Mac:**
```bash
/Applications/Obsidian.app/Contents/MacOS/Obsidian
```

**Linux:**
```bash
obsidian
# or if installed via snap:
snap run obsidian
```

**Windows (Command Prompt):**
```cmd
"C:\Users\YourUsername\AppData\Local\Obsidian\Obsidian.exe"
```

**Windows (PowerShell):**
```powershell
& "C:\Users\$env:USERNAME\AppData\Local\Obsidian\Obsidian.exe"
```

Then perform the sync operation and watch the terminal for log output.

### Method 3: Check Obsidian Log Files

Obsidian saves logs to disk that you can review later.

**Log file locations:**

- **Mac**: `~/Library/Logs/Obsidian/`
- **Windows**: `%APPDATA%\Obsidian\logs\`
- **Linux**: `~/.config/Obsidian/logs/`

Open the most recent log file with a text editor.

## Common Error Messages

### Error 409: Path Conflict

**Example:**
```
Error syncing /path/to/folder: Request failed, status 409
```

**Causes:**
- The Dropbox path doesn't exist
- Path format is incorrect (should start with `/`)
- Case sensitivity mismatch
- Special characters in path
- You don't have permission to access the folder

**Solutions:**
- Verify the exact path in your Dropbox web interface
- Ensure path starts with `/`
- Check for typos or case differences
- Try accessing the folder directly in Dropbox to confirm permissions

### Error 401: Unauthorized

**Example:**
```
Error: Request failed, status 401
```

**Causes:**
- Access token expired
- Invalid or revoked authentication
- App doesn't have required permissions

**Solutions:**
- Clear authentication in plugin settings
- Re-authenticate with Dropbox
- Check app permissions in Dropbox App Console
- Verify your app has `files.metadata.read` and `files.content.read` permissions

### Error 400: Bad Request

**Example:**
```
Error: Request failed, status 400
```

**Causes:**
- Malformed API request
- Invalid parameters

**Solutions:**
- Check folder mapping paths are properly formatted
- Ensure remote path starts with `/`
- Ensure local path doesn't start with `/`

### EADDRINUSE: Port Already in Use

**Example:**
```
Port 53134 is already in use. Please try again in a few moments.
```

**Causes:**
- Previous OAuth server didn't close properly
- Another application is using port 53134

**Solutions:**
- Wait a few moments and try again
- Restart Obsidian
- Kill the process using port 53134:
  ```bash
  # Mac/Linux
  lsof -ti:53134 | xargs kill -9

  # Windows
  netstat -ano | findstr :53134
  taskkill /PID <process_id> /F
  ```

## Debugging Tips

### Enable Verbose Logging

Check the console output for these messages:
- `Syncing [remote] to [local]` - Shows which folder is being processed
- `Running initial Dropbox sync...` - Confirms startup sync
- `Sync complete: X files synced (Y total)` - Shows sync results

### Test Individual Folder Mappings

If one mapping fails:
1. Temporarily remove other mappings in settings
2. Test each mapping individually
3. Identify which specific path is causing issues

### Verify Dropbox Paths

1. Open [Dropbox Web Interface](https://www.dropbox.com)
2. Navigate to the folder you want to sync
3. Copy the exact path from the URL or folder properties
4. Ensure the path in plugin settings matches exactly

### Check Network Connectivity

```bash
# Test Dropbox API connectivity
curl -I https://api.dropboxapi.com/2/users/get_current_account
```

Should return `200 OK` or similar.

### Inspect Vault File System

Verify local paths are valid:
```bash
# Check vault structure
ls -la "/path/to/vault/.obsidian/plugins/"

# Verify plugin files exist
ls -la "/path/to/vault/.obsidian/plugins/drpbx-fetcher/"
```

## Getting Help

When reporting issues, include:

1. **Error message** (full text from console)
2. **Plugin version** (from manifest.json)
3. **Obsidian version** (Settings → About)
4. **Operating system** (Mac/Windows/Linux and version)
5. **Folder mapping configuration** (sanitize sensitive paths)
6. **Steps to reproduce** the issue

**Example bug report:**
```
**Plugin Version:** 0.1.1
**Obsidian Version:** 1.4.16
**OS:** macOS 14.0

**Error:**
Error syncing /MyFolder/Documents: Request failed, status 409

**Folder Mappings:**
- /MyFolder/Documents → ImportedDocs

**Steps:**
1. Added folder mapping in settings
2. Clicked sync button
3. Error appears immediately

**Console Output:**
[paste full error from console]
```

## Advanced Debugging

### Monitor Network Requests

In Developer Console:
1. Go to **"Network"** tab
2. Filter by "Fetch/XHR"
3. Trigger sync
4. Inspect failed requests (red status codes)
5. Click on a request to see headers, payload, and response

### Check Dropbox API Response

Look for the actual API error in the response:
- Click on failed request in Network tab
- Select "Response" sub-tab
- Read the error message from Dropbox API

Common Dropbox error responses:
```json
{
  "error_summary": "path/not_found/...",
  "error": {
    ".tag": "path",
    "path": {
      ".tag": "not_found"
    }
  }
}
```

This tells you exactly what Dropbox didn't like about your request.
