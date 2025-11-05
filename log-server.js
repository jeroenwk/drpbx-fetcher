#!/usr/bin/env node

/**
 * Lightweight log server for Dropbox Fetcher plugin
 * Receives logs via HTTP POST and displays them in the terminal
 *
 * Usage:
 *   node log-server.js [--port PORT] [--level LEVEL]
 *
 * Examples:
 *   node log-server.js                     # Default port 3000, all levels
 *   node log-server.js --port 3001         # Custom port
 *   node log-server.js --level error       # Show only error logs
 *   node log-server.js --level warn        # Show warn and error logs
 *   node log-server.js --port 3001 --level error  # Custom port and error filter
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Log file setup
const LOG_FILE_PATH = path.join(__dirname, 'log.txt');
let logFileStream = null;

// Initialize log file (create or replace existing)
function initLogFile() {
  // Close existing stream if any
  if (logFileStream) {
    logFileStream.end();
  }

  // Create new file (overwrites existing)
  logFileStream = fs.createWriteStream(LOG_FILE_PATH, { flags: 'w' });

  logFileStream.on('error', (err) => {
    console.error('Error writing to log file:', err.message);
  });
}

// Strip ANSI color codes from string
function stripColors(str) {
  // Remove all ANSI escape sequences
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Write to log file without colors
function writeToLogFile(message) {
  if (logFileStream && !logFileStream.destroyed) {
    const plainMessage = stripColors(message);
    logFileStream.write(plainMessage + '\n');
  }
}

// Override console methods to also write to file
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  originalLog.apply(console, args);
  writeToLogFile(message);
};

console.error = function(...args) {
  const message = args.join(' ');
  originalError.apply(console, args);
  writeToLogFile(message);
};

// Log level priority (higher number = more severe)
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let port = 3000; // Default port
  let minLevel = 'debug'; // Default: show all levels

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
      i++; // Skip next arg
    } else if (args[i] === '--level' && i + 1 < args.length) {
      const level = args[i + 1].toLowerCase();
      if (LOG_LEVELS.hasOwnProperty(level)) {
        minLevel = level;
      } else {
        console.error(`${colors.red}Invalid level: ${args[i + 1]}. Valid levels: debug, info, warn, error${colors.reset}`);
        process.exit(1);
      }
      i++; // Skip next arg
    }
  }

  return { port, minLevel };
}

// Get all network interfaces with their IP addresses
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;

    for (const net of nets) {
      // Skip internal/loopback and non-IPv4 addresses
      if (net.internal || net.family !== 'IPv4') {
        continue;
      }

      // Determine interface type from name
      let type = 'Network';
      if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().startsWith('en0')) {
        type = 'WiFi';
      } else if (name.toLowerCase().includes('ethernet') || name.toLowerCase().startsWith('en1')) {
        type = 'Ethernet';
      } else if (name.toLowerCase().startsWith('en')) {
        type = 'Network';
      }

      addresses.push({
        name,
        address: net.address,
        type
      });
    }
  }

  return addresses;
}

// Format log message with colors
// Returns false if the log should be filtered out based on level
function formatLog(logData, minLevel) {
  const { timestamp, level, message, data, meta } = logData;

  // Filter based on minimum level
  const logLevel = LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : 0;
  const minLevelValue = LOG_LEVELS[minLevel] !== undefined ? LOG_LEVELS[minLevel] : 0;

  if (logLevel < minLevelValue) {
    return false; // Skip this log
  }

  // Color based on log level
  let levelColor;
  let levelLabel;

  switch (level) {
    case 'info':
      levelColor = colors.green;
      levelLabel = 'INFO ';
      break;
    case 'warn':
      levelColor = colors.yellow;
      levelLabel = 'WARN ';
      break;
    case 'error':
      levelColor = colors.red;
      levelLabel = 'ERROR';
      break;
    case 'debug':
      levelColor = colors.cyan;
      levelLabel = 'DEBUG';
      break;
    default:
      levelColor = colors.white;
      levelLabel = level.toUpperCase().padEnd(5);
  }

  // Format timestamp (just time portion for brevity)
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Build formatted output
  let output = `${colors.gray}[${time}]${colors.reset} `;
  output += `${levelColor}${colors.bright}[${levelLabel}]${colors.reset} `;
  output += `${colors.white}${message}${colors.reset}`;

  // Add metadata if present
  if (meta) {
    output += ` ${colors.dim}(v${meta.version} ${meta.platform})${colors.reset}`;
  }

  console.log(output);

  // Display data if present
  if (data !== undefined && data !== null) {
    const dataStr = typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2);

    // Indent data
    const indentedData = dataStr.split('\n').map(line => `  ${colors.gray}│${colors.reset} ${line}`).join('\n');
    console.log(indentedData);
  }

  return true; // Log was displayed
}

// Create HTTP server
function createServer(port, minLevel) {
  const server = http.createServer((req, res) => {
    // Enable CORS for all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only accept POST to /log endpoint
    if (req.method === 'POST' && req.url === '/log') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const logData = JSON.parse(body);
          formatLog(logData, minLevel);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error(`${colors.red}Failed to parse log data:${colors.reset}`, error.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
    } else {
      // Return 404 for other endpoints
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    const networkInterfaces = getNetworkInterfaces();

    console.log(`${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.green}  Dropbox Fetcher Log Server${colors.reset}`);
    console.log(`${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  Listening on port:${colors.reset} ${colors.bright}${port}${colors.reset}`);
    console.log(`${colors.cyan}  Log level filter:${colors.reset} ${colors.bright}${minLevel}${colors.reset} ${colors.dim}(and above)${colors.reset}`);
    console.log();
    console.log(`${colors.cyan}  Available on:${colors.reset}`);
    console.log(`    ${colors.dim}•${colors.reset} http://localhost:${port} ${colors.dim}(local)${colors.reset}`);

    if (networkInterfaces.length > 0) {
      networkInterfaces.forEach(iface => {
        console.log(`    ${colors.dim}•${colors.reset} http://${iface.address}:${port} ${colors.dim}(${iface.name} - ${iface.type})${colors.reset}`);
      });

      console.log();
      const remoteIPs = networkInterfaces.map(i => i.address).join(' or ');
      console.log(`${colors.yellow}  For mobile devices, use:${colors.reset} ${colors.bright}${remoteIPs}${colors.reset}`);
    }

    console.log();
    console.log(`${colors.cyan}  Endpoint:${colors.reset} POST /log`);
    console.log(`${colors.dim}  Press Ctrl+C to stop${colors.reset}`);
    console.log(`${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Shutting down log server...${colors.reset}`);
    server.close(() => {
      console.log(`${colors.green}Server stopped.${colors.reset}`);

      // Close log file stream
      if (logFileStream && !logFileStream.destroyed) {
        logFileStream.end();
      }

      process.exit(0);
    });
  });

  return server;
}

// Start server
const { port, minLevel } = parseArgs();

// Initialize log file before starting server
initLogFile();

createServer(port, minLevel);
