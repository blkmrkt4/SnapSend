import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { initializeDatabase } from "./db";
import { createServer } from "http";
import fs from "fs";
import os from "os";

export interface StartServerOptions {
  port?: number;
  onP2PFileReceived?: (data: { file: any; fromDevice: string; isClipboard: boolean; clipboardContent?: string }) => void;
  onPeerHandshake?: (ws: any, peerId: string, peerName: string) => void;
}

export interface StartServerResult {
  server: ReturnType<typeof createServer>;
  port: number;
  app: ReturnType<typeof express>;
}

export async function startServer(options: StartServerOptions = {}): Promise<StartServerResult> {
  const requestedPort = options.port ?? 5000;

  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Auto-create uploads directory (use SNAPSEND_UPLOADS_DIR in Electron production)
  const uploadsDir = process.env.SNAPSEND_UPLOADS_DIR || "uploads";
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Initialize SQLite database
  initializeDatabase();

  const server = await registerRoutes(app, {
    onP2PFileReceived: options.onP2PFileReceived,
    onPeerHandshake: options.onPeerHandshake,
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Error ${status}: ${message}`);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return new Promise((resolve, reject) => {
    server.listen(requestedPort, "0.0.0.0", () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : requestedPort;

      log(`serving on port ${actualPort}`);

      // Print local IP addresses so user knows what URL to open on other machines
      const nets = os.networkInterfaces();
      const addresses: string[] = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            addresses.push(net.address);
          }
        }
      }
      if (addresses.length > 0) {
        log(`Open on other devices:`);
        for (const addr of addresses) {
          log(`  http://${addr}:${actualPort}`);
        }
      }

      resolve({ server, port: actualPort, app });
    });

    server.on('error', reject);
  });
}

// Standalone startup (non-Electron)
const isElectron = process.env.ELECTRON === 'true';
if (!isElectron) {
  startServer({ port: 5000 }).catch((error) => {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  });
}
