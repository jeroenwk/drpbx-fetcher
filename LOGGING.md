# Logging Guide

The Dropbox Fetcher plugin now supports two logging modes:

## Console Logging (Default)

All logs are written to the browser/development console. This is the default mode.

## Network Stream Logging

Logs are sent to a remote server in real-time, allowing you to monitor plugin activity from a terminal.

### Setup

1. **Start the log server:**
   ```bash
   npm run log-server
   ```
   Or on a custom port:
   ```bash
   npm run log-server:dev  # Uses port 3001
   node log-server.js --port 5000  # Custom port
   ```

2. **Configure the plugin:**
   - Open Obsidian Settings → Dropbox Fetcher
   - Under "Logger type", select **Network Stream**
   - Enter the server host (default: `localhost`)
   - Enter the server port (default: `3000`)

3. **View logs:**
   The terminal running the log server will display formatted logs with:
   - Timestamps
   - Log levels (color-coded: INFO=green, WARN=yellow, ERROR=red, DEBUG=cyan)
   - Plugin version and platform
   - Structured data output

### Remote Logging

To log from a mobile device or remote Obsidian instance:

1. Find your computer's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```

2. Start the log server on your computer:
   ```bash
   npm run log-server
   ```

3. In Obsidian settings, set the host to your computer's IP (e.g., `192.168.1.100`)

4. Make sure firewall allows connections on port 3000

### Log Levels

- **INFO**: General information (sync start, completion)
- **WARN**: Warning messages (non-critical issues)
- **ERROR**: Error messages (failures, exceptions)
- **DEBUG**: Detailed debugging information (file processing, API calls)

### Troubleshooting

**Logs not appearing:**
- Verify the log server is running
- Check the host and port in plugin settings
- Ensure no firewall is blocking the connection
- After 5 consecutive failures, stream logging auto-disables (restart Obsidian to re-enable)

**Reset connection:**
- Change logger type to Console and back to Network Stream
- This resets the failure counter

### Development

The StreamLogger class provides a clean API:

```typescript
import { StreamLogger } from "./src/utils/StreamLogger";

// Initialize once in plugin onload()
StreamLogger.initialize({
  type: 'stream',
  host: 'localhost',
  port: 3000,
  version: '0.2.27',
  platform: 'desktop'
});

// Use anywhere in the code
StreamLogger.log("Info message", { key: "value" });
StreamLogger.warn("Warning message");
StreamLogger.error("Error message", error);
StreamLogger.debug("Debug details", data);
```

Logs always go to console as a fallback, ensuring you never lose important information.
