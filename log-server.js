#!/usr/bin/env node

/**
 * Lightweight log server for Dropbox Fetcher plugin
 * Receives logs via HTTP POST and displays them in the terminal
 *
 * Usage:
 *   node log-server.js [--port PORT]
 *
 * Examples:
 *   node log-server.js                  # Default port 3000
 *   node log-server.js --port 3001      # Custom port
 */

const http = require('http');
const os = require('os');

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const port = 3000; // Default port

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        return parsedPort;
      }
    }
  }

  return port;
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
function formatLog(logData) {
  const { timestamp, level, message, data, meta } = logData;

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
}

// Create HTTP server
function createServer(port) {
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
          formatLog(logData);

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
      process.exit(0);
    });
  });

  return server;
}

// Start server
const port = parseArgs();
createServer(port);
