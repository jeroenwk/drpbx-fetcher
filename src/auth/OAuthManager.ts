import { Notice, requestUrl } from "obsidian";
import { PKCEGenerator } from "../utils/crypto";
import { PlatformHelper } from "../utils/platform";
import type DrpbxFetcherPlugin from "../../main";
import * as http from "http";

export class OAuthManager {
  private server: http.Server | null = null;

  constructor(
    private plugin: DrpbxFetcherPlugin,
    private clientId: string
  ) {}

  async authenticate(): Promise<void> {
    if (!this.clientId) {
      new Notice("Please set your Dropbox Client ID first");
      return;
    }

    if (PlatformHelper.isDesktop()) {
      await this.authenticateDesktop();
    } else {
      await this.authenticateMobile();
    }
  }

  // Desktop OAuth (localhost approach)
  private async authenticateDesktop(): Promise<void> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

    // Store verifier for later use
    this.plugin.settings.codeVerifier = verifier;
    await this.plugin.saveSettings();

    // Build auth URL
    const authUrl = this.buildAuthUrl(challenge, PlatformHelper.getRedirectUri());

    // Start local server
    await this.startLocalServer(verifier);

    // Open browser
    window.open(authUrl);
  }

  // Mobile OAuth (custom URI scheme approach)
  private async authenticateMobile(): Promise<void> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

    // Store verifier for callback handling
    this.plugin.settings.codeVerifier = verifier;
    this.plugin.settings.authInProgress = true;
    await this.plugin.saveSettings();

    // Build auth URL with custom URI redirect
    const authUrl = this.buildAuthUrl(challenge, PlatformHelper.getRedirectUri());

    new Notice("Opening Dropbox authorization...");

    // Open in external browser
    window.open(authUrl, "_blank");
  }

  private buildAuthUrl(challenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      token_access_type: "offline",
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  async handleMobileCallback(params: Record<string, string>): Promise<void> {
    if (!this.plugin.settings.authInProgress) {
      new Notice("No authentication in progress");
      return;
    }

    if (params.error) {
      new Notice(`Authentication failed: ${params.error}`);
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
      return;
    }

    if (!params.code) {
      new Notice("No authorization code received");
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
      return;
    }

    // Exchange code for token
    await this.exchangeCodeForToken(params.code);
  }

  private async exchangeCodeForToken(code: string): Promise<void> {
    const verifier = this.plugin.settings.codeVerifier;

    if (!verifier) {
      new Notice("Authentication error: missing verifier");
      return;
    }

    try {
      const response = await requestUrl({
        url: "https://api.dropbox.com/oauth2/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          client_id: this.clientId,
          redirect_uri: PlatformHelper.getRedirectUri(),
          code_verifier: verifier,
        }).toString(),
      });

      if (response.status === 200) {
        const data = response.json;

        // Store tokens
        this.plugin.settings.accessToken = data.access_token;
        this.plugin.settings.refreshToken = data.refresh_token;
        this.plugin.settings.authInProgress = false;
        this.plugin.settings.codeVerifier = "";

        await this.plugin.saveSettings();

        new Notice("Successfully authenticated with Dropbox!");

        // Refresh settings UI if it's open
        if (this.plugin.settingsTab) {
          this.plugin.settingsTab.display();
        }
      } else {
        throw new Error(`Token exchange failed: ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Token exchange error:", error);
      new Notice(`Authentication failed: ${errorMessage}`);

      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
    }
  }

  // Desktop-only: Local HTTP server for OAuth callback
  private async startLocalServer(verifier: string): Promise<void> {
    if (!PlatformHelper.isDesktop()) {
      throw new Error("Local server only available on desktop");
    }

    this.server = http.createServer(async (req, res) => {
      if (req.url?.startsWith("/callback")) {
        const url = new URL(req.url, "http://localhost:53134");
        const code = url.searchParams.get("code");

        if (code) {
          try {
            // Exchange the code for tokens
            await this.exchangeCodeForToken(code);

            // Send response to browser
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Complete</h1>
                  <p>You can close this window and return to Obsidian.</p>
                  <script>window.close()</script>
                </body>
              </html>
            `);
          } catch (error) {
            new Notice("Error during authentication");
            console.error("Authentication error:", error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Failed</h1>
                  <p>Error: ${errorMessage}</p>
                  <p>You can close this window and try again.</p>
                </body>
              </html>
            `);
          }

          // Close the server
          this.server?.close();
        }
      }
    });

    // Start listening on the port
    this.server.listen(53134, "localhost", () => {
      console.log("OAuth server listening on port 53134");
    });

    // Handle server errors
    this.server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        new Notice("Port 53134 is already in use. Please try again in a few moments.");
      } else {
        new Notice("Error starting OAuth server");
        console.error("Server error:", error);
      }
    });
  }

  cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
