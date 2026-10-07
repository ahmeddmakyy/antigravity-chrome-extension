import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { Logger } from "./logger.js";
import {
  UserChatMessage,
  ToolActivityEvent,
  TaskStateType,
  WSClientMessage,
  WSServerMessage,
  AgentStatus,
  WakeMode,
  PlanStep,
  TurnSummary,
  SavedAttachment,
} from "./types.js";
import { BRIDGE_VERSION } from "./version.js";
import { EXTENSION_ORIGIN } from "./constants.js";
import { getDataDir } from "./paths.js";
import { saveAttachment, cleanOldUploads } from "./upload-manager.js";

function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>([EXTENSION_ORIGIN]);
  if (process.env.MYCHROME_ALLOWED_ORIGINS) {
    for (const o of process.env.MYCHROME_ALLOWED_ORIGINS.split(",")) {
      const trimmed = o.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }
  return allowed;
}

export interface BridgeOptions {
  /** Folder where .session.json is kept (linked conversation, setup flags). */
  stateDir?: string;
  /** How long the Stop hook may park a finished turn when no waker is online. 0 disables. */
  holdSeconds?: number;
  /** Without a Stop hook, a turn with no agent activity for this long is presumed idle (tests shorten it). */
  presumedIdleMs?: number;
}

interface WakeJob {
  jobId: string;
  action: "send-message";
  conversationId: string;
  /** Full prompt including the user's text. Used when agentapi can be spawned without a shell. */
  prompt: string;
  /** Plain ASCII prompt without user text. Used when only a shell shim is available. */
  safePrompt: string;
}

interface WakeResult {
  ok: boolean;
  error?: string;
  usedSafePrompt?: boolean;
}

interface PendingWakeJob {
  resolve: (r: WakeResult) => void;
  timer: NodeJS.Timeout;
}

interface WakerWaiter {
  res: http.ServerResponse;
  timer: NodeJS.Timeout;
}

interface HeldStop {
  resolve: (out: StopHookOutput) => void;
  timer: NodeJS.Timeout;
}

export interface StopHookOutput {
  decision: "continue" | "stop";
  reason?: string;
}

interface SessionState {
  linkedConversationId?: string | null;
  setupDone?: boolean;
  hooksSeenAt?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WAKER_ONLINE_MS = 45000;
const WAKER_POLL_MS = 25000;
const LINK_WINDOW_MS = 180000;
const MAX_BODY = 1024 * 1024;
/** Without a working Stop hook we cannot see the end of a turn, so a quiet agent is presumed idle after this. */
const PRESUMED_IDLE_MS = 90000;
/** A turn with no activity at all for this long is closed (no Stop hook / with Stop hook). */
const SAFETY_NO_HOOK_MS = 300000;
const SAFETY_WITH_HOOK_MS = 900000;

/** Replace data URLs and very long strings so results stay readable in the panel and the logs. */
export function summarizeResult(result: unknown, max = 1500): string {
  if (result === undefined) return "";
  let text: string;
  try {
    text = typeof result === "string" ? result : JSON.stringify(result);
  } catch {
    text = String(result);
  }
  text = text.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, (m) => `[image ${Math.round(m.length / 1024)} KB]`);
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/** Keep only small top-level fields of a result: they let the panel write labels like "Clicked Save". */
export function lightResult(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    if (Array.isArray(result)) return { count: result.length };
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (k === "dataUrl" || k === "elements") continue;
    if (k === "text" && typeof v === "string") {
      out.textLength = v.length;
      continue;
    }
    if (typeof v === "string") out[k] = v.length > 200 ? v.slice(0, 197) + "..." : v;
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length <= 6) {
      const inner: Record<string, unknown> = {};
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof iv === "number" || typeof iv === "boolean") inner[ik] = iv;
        else if (typeof iv === "string") inner[ik] = iv.slice(0, 120);
      }
      out[k] = inner;
    } else if (Array.isArray(v)) out[`${k}Count`] = v.length;
  }
  return out;
}

const NUDGE_TEXT =
  "You ended your turn without calling reply_to_user(kind='final'). The user only sees the Chrome side panel, " +
  "not this chat. Send your answer now with reply_to_user(kind='final'), then end your turn.";

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

interface PendingUserQuestion {
  resolve: (value: { approved?: boolean; answer?: string }) => void;
  timer: NodeJS.Timeout;
}

export class BridgeWSServer {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private activeSocket: WebSocket | null = null;
  private pairingToken: string;
  private logger: Logger;
  private port: number;

  // State management
  private monotonicMessageId = 1;
  private messageQueue: UserChatMessage[] = [];
  private waitResolvers: Array<(msg: UserChatMessage | null) => void> = [];
  private pendingCommands = new Map<string, PendingCommand>();
  private pendingQuestions = new Map<string, PendingUserQuestion>();
  private isStopped = false;

  // Task & Listening state
  private activeTabId: number | undefined;
  private userUiLanguage = "ar";
  private taskStateTimer: NodeJS.Timeout | null = null;
  private taskWatchdogTimer: NodeJS.Timeout | null = null;
  private isWaitingForUser = false;
  private pendingWaitCalls = 0;
  private listeningTimer: NodeJS.Timeout | null = null;
  private isListeningCurrently = false;

  // Push-mode state (sidecar waker + Stop hook)
  private stateDir: string | null;
  private holdSeconds: number;
  private linkedConversationId: string | null = null;
  private linkPendingSince = 0;
  private setupDone = false;
  private hooksSeenAt = 0;
  private wakerLastSeen = 0;
  private wakerWaiters: WakerWaiter[] = [];
  private wakerJobs: WakeJob[] = [];
  private pendingWakeJobs = new Map<string, PendingWakeJob>();
  private wakeInFlight = false;
  private heldStop: HeldStop | null = null;
  private attachments = new Map<number, string>();
  private lastDeliveredBatch: UserChatMessage[] = [];

  // Turn bookkeeping for the linked conversation
  private turnSeq = 0;
  private turnId = "";
  private turnStartedAt = 0;
  private turnFirstActivityAt = 0;
  private lastActivityAt = 0;
  private turnTools = 0;
  private turnErrors = 0;
  private turnPlan: PlanStep[] | null = null;
  private hookSelfTestAt = 0;
  private extensionVersion = "";
  private presumedIdleMs = PRESUMED_IDLE_MS;
  private pendingLanguageNote: string | null = null;
  private turnActive = false;
  private turnHadUserMessage = false;
  private turnFinalSent = false;
  private turnNudged = false;
  private turnStoppedByUser = false;
  private turnSafetyTimer: NodeJS.Timeout | null = null;
  private lastStatusJson = "";
  private statusTicker: NodeJS.Timeout | null = null;

  constructor(port: number, pairingToken: string, logger: Logger, options: BridgeOptions = {}) {
    this.port = port;
    this.pairingToken = pairingToken;
    this.logger = logger;
    this.stateDir = options.stateDir ?? getDataDir();
    this.holdSeconds = options.holdSeconds ?? 1800;
    this.presumedIdleMs = options.presumedIdleMs ?? PRESUMED_IDLE_MS;
    this.loadSessionState();

    this.logger.addListener((level, message, data) => {
      this.broadcast({
        type: "bridge_log_event",
        level,
        message,
        data,
        timestamp: Date.now(),
      });
    });
  }

  public async start(): Promise<void> {
    try {
      const cleaned = cleanOldUploads(7);
      if (cleaned > 0) {
        this.logger.info(`[Uploads] Cleaned ${cleaned} upload folder(s)/file(s) older than 7 days.`);
      }
    } catch (err) {
      this.logger.warn(`[Uploads] Failed to clean old uploads: ${err instanceof Error ? err.message : String(err)}`);
    }

    return new Promise((resolve, reject) => {
      const setupServer = () => {
        this.httpServer = http.createServer((req, res) => {
          const pathname = (req.url || "/").split("?")[0];
          if (req.method === "GET" && pathname === "/ping") {
            res.writeHead(200, {
              "Content-Type": "text/plain",
              "Access-Control-Allow-Origin": "*",
            });
            res.end("mychrome");
            return;
          }
          if (pathname.startsWith("/hook/") || pathname.startsWith("/waker/") || pathname === "/status") {
            this.handleControlRequest(pathname, req, res).catch((err) => {
              this.logger.error(`[HTTP] ${pathname} failed: ${err instanceof Error ? err.message : String(err)}`);
              if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
              }
              if (!res.writableEnded) res.end(JSON.stringify({ decision: "stop", error: "internal" }));
            });
            return;
          }
          if (req.method === "POST" && req.url === "/shutdown") {
            const tokenHeader = req.headers["x-bridge-token"];
            if (tokenHeader === this.pairingToken) {
              this.logger.info("[WS] Received takeover shutdown request with valid token. Exiting gracefully...");
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "shutting_down" }));
              setTimeout(async () => {
                await this.stop();
                if (process.env.NODE_ENV !== "test") {
                  process.exit(0);
                }
              }, 50);
              return;
            } else {
              this.logger.warn("[WS] Unauthorized shutdown request rejected.");
              res.writeHead(403);
              res.end("Forbidden");
              return;
            }
          }
          res.writeHead(404);
          res.end();
        });

        this.wss = new WebSocketServer({
          server: this.httpServer,
          maxPayload: 60 * 1024 * 1024,
          verifyClient: (info, callback) => {
            const origin = info.origin || "";
            const allowed = getAllowedOrigins();
            if (origin && !allowed.has(origin)) {
              if (process.env.NODE_ENV === "test" && origin.startsWith("chrome-extension://")) {
                callback(true);
                return;
              }
              this.logger.warn(`[WS] Rejected connection from unauthorized origin: ${origin}`);
              callback(false, 403, "Forbidden Origin");
              return;
            }
            callback(true);
          },
        });

        this.wss.on("error", (err) => {
          this.logger.debug("[WS] WebSocketServer handled error:", err.message);
        });

        this.wss.on("connection", (ws, req) => {
          const clientOrigin = req.headers.origin || "";
          this.logger.info(`[WS] New connection from ${req.socket.remoteAddress} (origin: ${clientOrigin || "none"})`);
          let authenticated = false;

          const authTimeout = setTimeout(() => {
            if (!authenticated) {
              this.logger.warn(`[WS] Connection timed out waiting for auth message.`);
              ws.close(4001, "Auth timeout");
            }
          }, 5000);

          ws.on("message", (raw) => {
            try {
              const data = JSON.parse(raw.toString("utf-8")) as WSClientMessage;
              if (!authenticated) {
                if (data.type === "auth") {
                  const allowed = getAllowedOrigins();
                  const isAutoPaired = Boolean(clientOrigin && allowed.has(clientOrigin));
                  const isTokenMatch = Boolean(this.pairingToken && data.token === this.pairingToken);

                  if (isAutoPaired || isTokenMatch) {
                    authenticated = true;
                    clearTimeout(authTimeout);
                    if (this.activeSocket && this.activeSocket !== ws && this.activeSocket.readyState === WebSocket.OPEN) {
                      this.logger.info(`[WS] A newer extension connection replaced the previous one.`);
                      try { this.activeSocket.close(4000, "Replaced"); } catch {}
                    }
                    this.activeSocket = ws;
                    this.isStopped = false;
                    this.extensionVersion = typeof data.extensionVersion === "string" ? data.extensionVersion : "";
                    if (isAutoPaired) {
                      this.logger.info(`[WS] Client automatically paired via trusted origin (${clientOrigin}, extension ${this.extensionVersion || "unknown"}, bridge ${BRIDGE_VERSION}).`);
                    } else {
                      this.logger.info(`[WS] Client paired and authenticated with token (extension ${this.extensionVersion || "unknown"}, bridge ${BRIDGE_VERSION}).`);
                    }
                    this.send(ws, { type: "auth_ok", listening: this.isListeningCurrently, bridgeVersion: BRIDGE_VERSION });
                    this.lastStatusJson = "";
                    this.broadcastStatus();
                  } else {
                    this.logger.warn(`[WS] Authentication failed: origin '${clientOrigin}' is not auto-paired and token invalid.`);
                    this.send(ws, { type: "auth_error", error: "Invalid pairing token" });
                    ws.close(4003, "Invalid token");
                  }
                } else {
                  this.logger.warn(`[WS] Expected auth message, received '${(data as { type?: string }).type}'.`);
                  this.send(ws, { type: "auth_error", error: "Expected auth message" });
                  ws.close(4002, "Expected auth");
                }
                return;
              }

              this.handleClientMessage(data).catch((err) => {
                this.logger.error(`[WS] Failed to handle message:`, err);
              });
            } catch (err) {
              this.logger.error(`[WS] Failed to parse message:`, err);
            }
          });

          ws.on("close", () => {
            this.logger.info(`[WS] Client disconnected.`);
            this.clearTaskWatchdog();
            if (this.activeSocket === ws) {
              this.activeSocket = null;
            }
          });

        });
      };

      const tryBind = (attempt: number) => {
        setupServer();

        const onError = async (err: NodeJS.ErrnoException) => {
          this.httpServer?.removeListener("error", onError);
          this.httpServer?.removeListener("listening", onListening);
          try {
            this.wss?.close();
            this.httpServer?.close();
          } catch {}

          if (err.code === "EADDRINUSE") {
            this.logger.warn(`[WS] Port ${this.port} is already in use. Attempting takeover (attempt ${attempt + 1}/10)...`);
            try {
              await fetch(`http://127.0.0.1:${this.port}/shutdown`, {
                method: "POST",
                headers: { "x-bridge-token": this.pairingToken },
              });
            } catch {
              // Old process might be closing
            }

            if (attempt < 10) {
              setTimeout(() => tryBind(attempt + 1), 300);
            } else {
              this.logger.error(`[WS] Port ${this.port} in use and takeover failed after 10 attempts.`);
              if (process.env.NODE_ENV !== "test") {
                process.stderr.write(`[FATAL] Port ${this.port} is already in use and takeover failed.\n`);
                process.exit(1);
              } else {
                reject(err);
              }
            }
          } else {
            this.logger.error(`[WS] Server error:`, err);
            reject(err);
          }
        };

        const onListening = () => {
          this.httpServer?.removeListener("error", onError);
          this.httpServer?.removeListener("listening", onListening);
          this.logger.info(`[WS] WebSocket server bound to 127.0.0.1:${this.port}`);
          if (!this.statusTicker) {
            this.statusTicker = setInterval(() => this.broadcastStatus(), 10000);
            this.statusTicker.unref?.();
          }
          resolve();
        };

        this.httpServer!.once("error", onError);
        this.httpServer!.once("listening", onListening);
        this.httpServer!.listen(this.port, "127.0.0.1");
      };

      tryBind(0);
    });
  }

  private async handleClientMessage(msg: WSClientMessage): Promise<void> {
    if (msg.type === "ping") {
      if (this.activeSocket) this.send(this.activeSocket, { type: "pong" });
      return;
    }

    if (msg.type === "chat_message") {
      this.isStopped = false;
      const msgId = this.monotonicMessageId++;
      const savedAttachments: SavedAttachment[] = [];
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        const allowed = msg.attachments.slice(0, 5);
        for (let i = 0; i < allowed.length; i++) {
          const a = allowed[i];
          try {
            const saved = await saveAttachment(msgId, i + 1, a);
            savedAttachments.push(saved);
          } catch (err) {
            this.logger.error(`[Uploads] Failed to save attachment "${a.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      const userMsg: UserChatMessage = {
        messageId: msgId,
        clientMsgId: msg.clientMsgId,
        text: msg.text,
        tab: msg.tab,
        screenshot: msg.screenshot,
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        ui_language: msg.ui_language,
        timestamp: Date.now(),
      };
      this.logger.info(`[WS] Received user message #${userMsg.messageId}: "${userMsg.text.slice(0, 60)}" (attachments: ${savedAttachments.length})`);
      this.routeUserMessage(userMsg);
      return;
    }

    if (msg.type === "command_result" || msg.type === "browser_command_result") {
      const pending = this.pendingCommands.get(msg.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingCommands.delete(msg.correlationId);
        if ("success" in msg && !msg.success) {
          pending.reject(new Error(msg.error || "Command execution failed in extension"));
        } else if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    if (msg.type === "ui_language") {
      const lang = msg.lang === "en" ? "en" : "ar";
      if (lang !== this.userUiLanguage) {
        this.userUiLanguage = lang;
        this.logger.info(`[WS] Panel language changed to ${lang}.`);
        if (this.turnActive) {
          const name = lang === "en" ? "English" : "Arabic (Egyptian)";
          this.pendingLanguageNote = `The user switched the side panel to ${name}. From now on write every intent, progress update and plan step in ${name}.`;
        }
      }
      return;
    }

    if (msg.type === "client_event") {
      const name = String(msg.name || "event").slice(0, 60);
      let extra = "";
      try {
        extra = msg.data ? " " + JSON.stringify(msg.data).slice(0, 300) : "";
      } catch {}
      this.logger.info(`[Extension] ${name}${extra}`);
      return;
    }

    if (msg.type === "get_bridge_log") {
      const lines = this.logger.getRecentLines(500);
      if (this.activeSocket) {
        this.send(this.activeSocket, { type: "bridge_log", lines });
      }
      return;
    }

    if (msg.type === "user_action") {
      if (msg.action === "stop") {
        this.logger.warn(`[WS] User pressed STOP in side panel.`);
        this.isStopped = true;
        this.turnStoppedByUser = true;
        this.clearTaskWatchdog();
        for (const [, pending] of this.pendingCommands) {
          clearTimeout(pending.timer);
          pending.reject(new Error("stopped_by_user"));
        }
        this.pendingCommands.clear();
        for (const [, question] of this.pendingQuestions) {
          clearTimeout(question.timer);
          question.resolve({ approved: false, answer: "stopped_by_user" });
        }
        this.pendingQuestions.clear();
        this.isWaitingForUser = false;
        if (this.turnActive) {
          this.endTurn("stopped by user");
        } else {
          this.broadcastTaskState("idle", this.activeTabId, this.userUiLanguage === "ar" ? "تم الإيقاف" : "Stopped");
        }
        return;
      }


      if (msg.correlationId && this.pendingQuestions.has(msg.correlationId)) {
        const question = this.pendingQuestions.get(msg.correlationId)!;
        clearTimeout(question.timer);
        this.pendingQuestions.delete(msg.correlationId);
        this.isWaitingForUser = false;
        this.resetInactivityTimer();

        if (msg.action === "approve") {
          question.resolve({ approved: true });
        } else if (msg.action === "deny") {
          question.resolve({ approved: false });
        } else if (msg.action === "answer") {
          question.resolve({ answer: String(msg.value ?? "") });
        }
      }
    }
  }

  private send(ws: WebSocket, msg: WSServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public broadcast(msg: WSServerMessage): void {
    if (this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN) {
      this.activeSocket.send(JSON.stringify(msg));
    }
  }

  // ==========================================================
  // Session persistence (.session.json)
  // ==========================================================
  private sessionFile(): string | null {
    return this.stateDir ? path.join(this.stateDir, ".session.json") : null;
  }

  private loadSessionState(): void {
    const file = this.sessionFile();
    if (!file || !fs.existsSync(file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8")) as SessionState;
      if (typeof data.linkedConversationId === "string" && UUID_RE.test(data.linkedConversationId)) {
        this.linkedConversationId = data.linkedConversationId;
      }
      this.setupDone = Boolean(data.setupDone);
      this.hooksSeenAt = typeof data.hooksSeenAt === "number" ? data.hooksSeenAt : 0;
      this.logger.info(
        `[Session] Loaded: linked=${this.linkedConversationId ? "yes" : "no"}, setupDone=${this.setupDone}, hooksSeen=${this.hooksSeenAt > 0}`
      );
    } catch (err) {
      this.logger.warn(`[Session] Could not read .session.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private saveSessionState(): void {
    const file = this.sessionFile();
    if (!file) return;
    try {
      let current: SessionState = {};
      if (fs.existsSync(file)) {
        try {
          current = JSON.parse(fs.readFileSync(file, "utf-8"));
        } catch {}
      }
      const next: SessionState = {
        ...current,
        linkedConversationId: this.linkedConversationId,
        hooksSeenAt: this.hooksSeenAt,
      };
      fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf-8");
    } catch (err) {
      this.logger.warn(`[Session] Could not write .session.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ==========================================================
  // Agent status (what the side panel shows in the status chip)
  // ==========================================================
  private isWakerOnline(): boolean {
    return this.wakerWaiters.length > 0 || Date.now() - this.wakerLastSeen < WAKER_ONLINE_MS;
  }

  private hooksConfirmed(): boolean {
    return this.hooksSeenAt > 0;
  }

  private isLinkPending(): boolean {
    return this.linkPendingSince > 0 && Date.now() - this.linkPendingSince < LINK_WINDOW_MS;
  }

  public getWakeMode(): WakeMode {
    if (this.waitResolvers.length > 0) return "legacy";
    if (this.heldStop) return "hold";
    if (this.linkedConversationId && this.isWakerOnline()) return "push";
    return "none";
  }

  public getAgentStatus(): AgentStatus & { version: string } {
    return {
      version: BRIDGE_VERSION,
      linked: Boolean(this.linkedConversationId),
      linkPending: this.isLinkPending(),
      waker: this.isWakerOnline(),
      hooks: this.hooksConfirmed(),
      setupDone: this.setupDone,
      busy: this.turnActive,
      mode: this.getWakeMode(),
      queued: this.messageQueue.length,
    };
  }

  /** True when the agent can safely end its turn and still be woken up by the next panel message. */
  public canEndTurnSafely(): boolean {
    const linkedOrPending = Boolean(this.linkedConversationId) || this.isLinkPending();
    if (!linkedOrPending) return false;
    return this.isWakerOnline() || this.hooksConfirmed() || this.setupDone;
  }

  public broadcastStatus(): void {
    const status = this.getAgentStatus();
    const json = JSON.stringify(status);
    if (json === this.lastStatusJson) return;
    this.lastStatusJson = json;
    this.broadcast({ type: "agent_status", status });
  }

  // ==========================================================
  // Message routing
  // ==========================================================
  private routeUserMessage(userMsg: UserChatMessage): void {
    if (userMsg.screenshot) {
      this.attachments.set(userMsg.messageId, userMsg.screenshot);
    }
    if (userMsg.attachments) {
      for (const a of userMsg.attachments) {
        if (a.isImage && a.dataUrl && !this.attachments.has(userMsg.messageId)) {
          this.attachments.set(userMsg.messageId, a.dataUrl);
        }
      }
    }
    if (this.attachments.size > 20) {
      const oldest = this.attachments.keys().next().value;
      if (oldest !== undefined) this.attachments.delete(oldest);
    }

    // 1. Legacy long-poll is waiting: hand it over directly.
    if (this.waitResolvers.length > 0) {
      const resolver = this.waitResolvers.shift()!;
      resolver(userMsg);
      return;
    }

    this.messageQueue.push(userMsg);

    // 2. A finished turn is parked by the Stop hook: release it with this message.
    if (this.heldStop) {
      this.releaseHeldStop();
      return;
    }

    // 3. The agent is mid-task: the message rides along with its next tool result.
    //    Without a working Stop hook we cannot see the end of a turn, so after a long silence
    //    we presume the agent is idle and wake it instead of waiting for a tool call that never comes.
    if (this.turnActive) {
      const quietMs = Date.now() - (this.lastActivityAt || this.turnStartedAt);
      if (!this.hooksConfirmed() && quietMs > this.presumedIdleMs && this.linkedConversationId && this.isWakerOnline()) {
        this.logger.info(
          `[Route] No agent activity for ${Math.round(quietMs / 1000)}s and no Stop hook: presuming the agent is idle and waking it.`
        );
        this.endTurn("presumed idle", this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser);
        void this.dispatchWake();
        return;
      }
      this.logger.info(`[Route] Agent is busy. Message #${userMsg.messageId} queued for the next tool result.`);
      this.broadcastStatus();
      return;
    }

    // 4. Push: wake the linked conversation through the sidecar.
    if (this.linkedConversationId && this.isWakerOnline()) {
      void this.dispatchWake();
      return;
    }

    // 5. Nothing can wake the agent right now.
    const code = this.linkedConversationId || this.isLinkPending() ? "queued_asleep" : "queued_not_linked";
    this.logger.warn(`[Route] No wake channel. Message #${userMsg.messageId} queued (${code}).`);
    this.broadcast({ type: "system_note", code });
    this.broadcastStatus();
  }

  /** Format one or more panel messages as plain text for the agent. */
  public formatMessagesForAgent(msgs: UserChatMessage[], intro?: string): string {
    const lines: string[] = [];
    lines.push(
      intro ??
        (msgs.length === 1
          ? `New message from the user in the Chrome side panel (#${msgs[0].messageId}):`
          : `The user sent ${msgs.length} new messages in the Chrome side panel:`)
    );
    for (const m of msgs) {
      lines.push("");
      if (msgs.length > 1) lines.push(`Message #${m.messageId}:`);
      if (m.tab && typeof m.tab.id === "number") {
        lines.push(`Tab: id ${m.tab.id}, "${(m.tab.title || "").slice(0, 120)}", ${(m.tab.url || "").slice(0, 300)}`);
      }
      const panelLang = m.ui_language === "en" ? "English" : "Arabic (Egyptian)";
      lines.push(
        `Panel language: ${panelLang}. Write every intent, progress update and plan step in ${panelLang}. ` +
          `Write the final answer in the language of the user's message.`
      );
      if (m.screenshot || this.attachments.has(m.messageId)) {
        lines.push(`Screenshot attached: call read_panel_messages with message_id ${m.messageId} to see it.`);
      }
      if (m.attachments && m.attachments.length > 0) {
        lines.push(`Attachments (${m.attachments.length} file${m.attachments.length > 1 ? "s" : ""}):`);
        for (let i = 0; i < m.attachments.length; i++) {
          const a = m.attachments[i];
          const sizeKb = (a.size / 1024).toFixed(1);
          lines.push(`  ${i + 1}. "${a.name}" (${a.mime}, ${sizeKb} KB)`);
          lines.push(`     Path: ${a.path}`);
          if (a.isImage) {
            lines.push(`     (Image content returned in tool result below)`);
          } else {
            lines.push(`     (Open this document/file by path with your own file tools)`);
          }
        }
      }
      lines.push("");
      lines.push(m.text);
    }
    lines.push("");
    lines.push(
      "Work on that tab with the browser tools. For a task with 3 or more steps, call update_plan first. " +
        "Send short reply_to_user(kind='progress') updates, finish with reply_to_user(kind='final'), then end your turn."
    );
    return lines.join("\n");
  }

  /** Mark messages as handed to the agent: ack them in the panel and start (or extend) a turn. */
  private deliverMessages(msgs: UserChatMessage[]): void {
    if (msgs.length === 0) return;
    for (const m of msgs) {
      if (m.clientMsgId) this.broadcast({ type: "message_ack", clientMsgId: m.clientMsgId });
    }
    const last = msgs[msgs.length - 1];
    if (last.tab?.id) this.activeTabId = last.tab.id;
    this.userUiLanguage = last.ui_language || this.userUiLanguage || "ar";
    this.lastDeliveredBatch = msgs;
    this.beginTurn(true);
  }

  private beginTurn(fromUserMessage: boolean): void {
    // A new request after the final answer is a new turn for the panel, even if Antigravity
    // continues the same execution (Stop hook "continue").
    if (fromUserMessage && this.turnActive && this.turnFinalSent) {
      this.endTurn("next message");
    }
    const wasActive = this.turnActive;
    this.turnActive = true;
    if (!wasActive) {
      this.turnSeq += 1;
      this.turnId = `t${this.turnSeq}`;
      this.turnStartedAt = Date.now();
      this.turnFirstActivityAt = 0;
      this.lastActivityAt = 0;
      this.turnTools = 0;
      this.turnErrors = 0;
      this.turnPlan = null;
      this.logger.info(`[Turn ${this.turnId}] Started (${fromUserMessage ? "user message" : "agent activity"}).`);
      this.broadcast({ type: "turn_started", turnId: this.turnId, fromUser: fromUserMessage, startedAt: this.turnStartedAt });
    }
    if (fromUserMessage) {
      this.turnHadUserMessage = true;
      this.turnFinalSent = false;
      this.turnNudged = false;
      this.turnStoppedByUser = false;
      this.isStopped = false;
      const thinkLabel = this.userUiLanguage === "ar" ? "بيفكر..." : "Thinking...";
      this.broadcastTaskState("thinking", this.activeTabId, thinkLabel);
      this.startTaskWatchdog();
    } else if (!wasActive) {
      this.turnHadUserMessage = false;
      this.turnFinalSent = false;
      this.turnNudged = false;
      this.turnStoppedByUser = false;
    }
    this.armTurnSafety();
    this.resetInactivityTimer();
    this.broadcastStatus();
  }

  /** Called on any agent tool call: the agent is clearly running. */
  private markAgentActive(): void {
    if (!this.turnActive) {
      this.beginTurn(false);
    } else {
      this.armTurnSafety();
    }
    const now = Date.now();
    this.lastActivityAt = now;
    if (!this.turnFirstActivityAt) {
      this.turnFirstActivityAt = now;
      const waited = now - this.turnStartedAt;
      if (waited > 30000) {
        this.logger.info(`[Turn ${this.turnId}] First agent activity came ${Math.round(waited / 1000)}s after the turn started.`);
      }
    }
  }

  public getTurnSummary(reason: string): TurnSummary {
    return {
      turnId: this.turnId,
      reason,
      finalSent: this.turnFinalSent,
      stoppedByUser: this.turnStoppedByUser,
      tools: this.turnTools,
      errors: this.turnErrors,
      durationMs: this.turnStartedAt ? Date.now() - this.turnStartedAt : 0,
      firstActivityMs: this.turnFirstActivityAt ? this.turnFirstActivityAt - this.turnStartedAt : null,
    };
  }

  private endTurn(reason: string, noReply = false): void {
    if (!this.turnActive && !noReply) {
      this.broadcastStatus();
      return;
    }
    if (this.turnActive) {
      const summary = this.getTurnSummary(reason);
      this.logger.info(
        `[Turn ${summary.turnId}] Ended (${reason}) after ${Math.round(summary.durationMs / 1000)}s: ` +
          `${summary.tools} tool call(s), ${summary.errors} error(s), final reply ${summary.finalSent ? "sent" : "NOT sent"}` +
          (summary.firstActivityMs !== null ? `, first activity after ${Math.round(summary.firstActivityMs / 1000)}s.` : ", no agent activity.")
      );
      this.broadcast({ type: "turn_ended", summary });
    }
    this.turnActive = false;
    this.clearTaskWatchdog();
    if (this.turnSafetyTimer) {
      clearTimeout(this.turnSafetyTimer);
      this.turnSafetyTimer = null;
    }
    if (noReply) {
      this.broadcast({ type: "system_note", code: "no_reply" });
    }
    this.broadcastTaskState("idle", this.activeTabId);
    this.broadcastStatus();
  }

  /** If the Stop hook never arrives (not installed or broken), do not stay "busy" forever. */
  private armTurnSafety(): void {
    if (this.turnSafetyTimer) clearTimeout(this.turnSafetyTimer);
    const ms = this.hooksConfirmed() ? SAFETY_WITH_HOOK_MS : SAFETY_NO_HOOK_MS;
    this.turnSafetyTimer = setTimeout(() => {
      this.turnSafetyTimer = null;
      if (this.turnActive) {
        const noReply = this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser;
        this.endTurn("safety timeout: no agent activity", noReply);
        if (this.messageQueue.length > 0 && this.linkedConversationId && this.isWakerOnline()) {
          void this.dispatchWake();
        }
      }
    }, ms);
    this.turnSafetyTimer.unref?.();
  }

  /**
   * Messages that arrived while the agent was working. They are attached to the next
   * tool result so the agent sees them without ending its turn.
   */
  public takeInterrupts(includeLanguageNote = true): string | null {
    const langNote = includeLanguageNote ? this.pendingLanguageNote : null;
    if (includeLanguageNote) this.pendingLanguageNote = null;
    if (!this.turnActive || this.messageQueue.length === 0) return langNote;
    const msgs = this.messageQueue.splice(0);
    this.deliverMessages(msgs);
    this.logger.info(`[Route] Delivered ${msgs.length} queued message(s) inside a tool result.`);
    return (langNote ? langNote + "\n\n" : "") + this.formatMessagesForAgent(
      msgs,
      msgs.length === 1
        ? `IMPORTANT: while you were working, the user sent a new message in the side panel (#${msgs[0].messageId}). Take it into account now:`
        : `IMPORTANT: while you were working, the user sent ${msgs.length} new messages in the side panel. Take them into account now:`
    );
  }

  /** Used by read_panel_messages: queued messages first, otherwise the last delivered batch. */
  public readPanelMessages(messageId?: number): {
    messages: UserChatMessage[];
    screenshots: Map<number, string>;
    imageAttachments: Array<{ dataUrl: string; name?: string }>;
  } {
    let messages: UserChatMessage[];
    if (typeof messageId === "number") {
      const fromBatch = this.lastDeliveredBatch.find((m) => m.messageId === messageId);
      const fromQueue = this.messageQueue.find((m) => m.messageId === messageId);
      messages = fromBatch ? [fromBatch] : fromQueue ? [fromQueue] : [];
      if (fromQueue) {
        this.messageQueue = this.messageQueue.filter((m) => m !== fromQueue);
        this.deliverMessages([fromQueue]);
      }
    } else if (this.messageQueue.length > 0) {
      messages = this.messageQueue.splice(0);
      this.deliverMessages(messages);
    } else {
      messages = this.lastDeliveredBatch;
    }
    const screenshots = new Map<number, string>();
    const imageAttachments: Array<{ dataUrl: string; name?: string }> = [];
    for (const m of messages) {
      const shot = m.screenshot || this.attachments.get(m.messageId);
      if (shot) screenshots.set(m.messageId, shot);
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.isImage && a.dataUrl) {
            imageAttachments.push({ dataUrl: a.dataUrl, name: a.name });
          }
        }
      }
    }
    return { messages, screenshots, imageAttachments };
  }

  /** connect_side_panel: link this conversation and hand over anything already waiting. */
  public connectPanel(conversationId?: string): {
    linked: boolean;
    linkPending: boolean;
    mode: WakeMode;
    canEndTurn: boolean;
    queued: UserChatMessage[];
  } {
    this.linkPendingSince = Date.now();
    if (conversationId && UUID_RE.test(conversationId)) {
      this.setLinkedConversation(conversationId, "connect_side_panel");
    }
    this.markAgentActive();
    const queued = this.messageQueue.splice(0);
    if (queued.length > 0) this.deliverMessages(queued);
    const canEndTurn = this.canEndTurnSafely();
    // The agent is told to end its turn right away, so the bridge must not think it is still busy:
    // otherwise the next panel message would wait for a tool call that never comes.
    if (queued.length === 0 && canEndTurn && !this.hooksConfirmed()) {
      this.endTurn("connect_side_panel: nothing waiting");
    }
    this.broadcastStatus();
    return {
      linked: Boolean(this.linkedConversationId),
      linkPending: this.isLinkPending(),
      mode: this.getWakeMode(),
      canEndTurn,
      queued,
    };
  }

  private setLinkedConversation(conversationId: string, source: string): void {
    if (this.linkedConversationId === conversationId) return;
    this.linkedConversationId = conversationId;
    this.logger.info(`[Session] Linked to Antigravity conversation ${conversationId} (via ${source}).`);
    this.saveSessionState();
    this.broadcast({ type: "system_note", code: "linked" });
    this.broadcastStatus();
  }

  // ==========================================================
  // Wake-up through the sidecar (agentapi send-message)
  // ==========================================================
  private async dispatchWake(): Promise<void> {
    if (this.wakeInFlight || !this.linkedConversationId) return;
    const msgs = this.messageQueue.splice(0);
    if (msgs.length === 0) return;
    this.wakeInFlight = true;

    const last = msgs[msgs.length - 1];
    if (last.tab?.id) this.activeTabId = last.tab.id;
    this.userUiLanguage = last.ui_language || this.userUiLanguage;
    const wakingLabel = this.userUiLanguage === "ar" ? "بيصحّي Antigravity..." : "Waking Antigravity...";
    this.broadcastTaskState("thinking", this.activeTabId, wakingLabel);

    const job: WakeJob = {
      jobId: `wake_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: "send-message",
      conversationId: this.linkedConversationId,
      prompt: this.formatMessagesForAgent(msgs),
      safePrompt:
        "New message from the user in the Chrome side panel. Call read_panel_messages to read it, then handle it with the browser tools and reply_to_user.",
    };

    this.logger.info(`[Wake] Sending ${msgs.length} message(s) to conversation ${job.conversationId} through the waker.`);
    const result = await this.enqueueWakeJob(job, 25000);
    this.wakeInFlight = false;

    if (result.ok) {
      this.logger.info(`[Wake] Delivered${result.usedSafePrompt ? " (safe prompt)" : ""}.`);
      this.deliverMessages(msgs);
    } else {
      this.logger.error(`[Wake] Failed: ${result.error || "unknown error"}`);
      this.messageQueue.unshift(...msgs);
      this.broadcast({
        type: "delivery_error",
        error: result.error || "unknown error",
        clientMsgIds: msgs.map((m) => m.clientMsgId).filter((x): x is string => Boolean(x)),
      });
      this.broadcastTaskState("idle", this.activeTabId);
      this.broadcastStatus();
      return;
    }

    // Anything that arrived while the wake was in flight now rides along with tool results.
    this.broadcastStatus();
  }

  private enqueueWakeJob(job: WakeJob, timeoutMs: number): Promise<WakeResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingWakeJobs.delete(job.jobId);
        this.wakerJobs = this.wakerJobs.filter((j) => j.jobId !== job.jobId);
        resolve({ ok: false, error: "The waker did not answer in time. Is the sidecar enabled in Antigravity?" });
      }, timeoutMs);
      this.pendingWakeJobs.set(job.jobId, { resolve, timer });

      const waiter = this.wakerWaiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        this.sendJson(waiter.res, 200, job);
      } else {
        this.wakerJobs.push(job);
      }
    });
  }

  // ==========================================================
  // HTTP control endpoints (Stop hook, waker, status)
  // ==========================================================
  private async handleControlRequest(pathname: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.headers["x-bridge-token"] !== this.pairingToken) {
      this.logger.warn(`[HTTP] Rejected ${pathname}: bad or missing token.`);
      this.sendJson(res, 403, { decision: "stop", error: "forbidden" });
      return;
    }

    if (req.method === "GET" && pathname === "/status") {
      this.sendJson(res, 200, {
        ...this.getAgentStatus(),
        linkedConversationId: this.linkedConversationId,
        extensionConnected: Boolean(this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN),
        extensionVersion: this.extensionVersion || null,
        hooksSeenAt: this.hooksSeenAt || null,
        hookSelfTestAt: this.hookSelfTestAt || null,
        turnId: this.turnActive ? this.turnId : null,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/hook/stop") {
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const out = await this.handleStopHook(body, res);
      if (!res.writableEnded) this.sendJson(res, 200, out);
      return;
    }

    if (req.method === "GET" && pathname === "/waker/next") {
      this.handleWakerNext(res);
      return;
    }

    if (req.method === "POST" && pathname === "/waker/result") {
      const body = (await this.readJsonBody(req)) as { jobId?: string; ok?: boolean; error?: string; usedSafePrompt?: boolean };
      const pending = body.jobId ? this.pendingWakeJobs.get(body.jobId) : undefined;
      if (pending && body.jobId) {
        clearTimeout(pending.timer);
        this.pendingWakeJobs.delete(body.jobId);
        pending.resolve({ ok: Boolean(body.ok), error: body.error, usedSafePrompt: Boolean(body.usedSafePrompt) });
      }
      this.wakerLastSeen = Date.now();
      this.sendJson(res, 200, { ok: true });
      return;
    }

    this.sendJson(res, 404, { error: "not found" });
  }

  private handleWakerNext(res: http.ServerResponse): void {
    const wasOnline = this.isWakerOnline();
    this.wakerLastSeen = Date.now();
    if (!wasOnline) {
      this.logger.info("[Waker] Sidecar connected.");
    }

    const job = this.wakerJobs.shift();
    if (job) {
      this.sendJson(res, 200, job);
      this.broadcastStatus();
      return;
    }

    const waiter: WakerWaiter = {
      res,
      timer: setTimeout(() => {
        this.wakerWaiters = this.wakerWaiters.filter((w) => w !== waiter);
        this.wakerLastSeen = Date.now();
        if (!res.writableEnded) {
          res.writeHead(204);
          res.end();
        }
      }, WAKER_POLL_MS),
    };
    this.wakerWaiters.push(waiter);
    res.on("close", () => {
      clearTimeout(waiter.timer);
      this.wakerWaiters = this.wakerWaiters.filter((w) => w !== waiter);
    });
    this.broadcastStatus();

    // Messages that waited while nothing could wake the agent go out now.
    if (!wasOnline && this.messageQueue.length > 0 && this.linkedConversationId && !this.turnActive && !this.heldStop) {
      this.logger.info(`[Waker] Delivering ${this.messageQueue.length} message(s) that were waiting.`);
      void this.dispatchWake();
    }
  }

  /**
   * Stop hook: Antigravity calls this every time an agent turn ends (any conversation).
   * - Links the conversation right after connect_side_panel.
   * - Makes sure the final answer went to the panel (one nudge).
   * - Hands over messages that arrived during the turn.
   * - With no waker online, parks the finished turn until the next message (hold mode).
   */
  public async handleStopHook(body: Record<string, unknown>, res?: http.ServerResponse): Promise<StopHookOutput> {
    if (body.selfTest === true) {
      this.hookSelfTestAt = Date.now();
      this.logger.info("[Hook] Self-test: the Stop hook script reached the bridge.");
      return { decision: "stop" };
    }
    const cid = typeof body.conversationId === "string" ? body.conversationId : "";
    const terminationReason = typeof body.terminationReason === "string" ? body.terminationReason : "";
    const firstHook = this.hooksSeenAt === 0;
    this.hooksSeenAt = Date.now();
    if (firstHook) {
      this.saveSessionState();
      this.logger.info("[Hook] First Stop hook received from Antigravity. Hooks are working.");
      this.broadcastStatus();
    }
    this.logger.debug(
      `[Hook] Stop received (conversation ${cid ? cid.slice(0, 8) : "none"}, reason ${terminationReason || "n/a"}, linked ${cid && cid === this.linkedConversationId ? "yes" : "no"}).`
    );

    if (cid && this.isLinkPending() && UUID_RE.test(cid)) {
      this.linkPendingSince = 0;
      if (this.linkedConversationId !== cid) {
        this.setLinkedConversation(cid, "stop hook");
      }
    }

    if (!cid || cid !== this.linkedConversationId) {
      return { decision: "stop" };
    }

    this.logger.info(`[Hook] Stop for linked conversation (reason: ${terminationReason || "n/a"}).`);
    const normalStop = !terminationReason || terminationReason === "model_stop";

    if (
      normalStop &&
      this.turnActive &&
      this.turnHadUserMessage &&
      !this.turnFinalSent &&
      !this.turnNudged &&
      !this.turnStoppedByUser
    ) {
      this.turnNudged = true;
      this.logger.warn("[Hook] Turn ended without reply_to_user(final). Nudging the agent once.");
      return { decision: "continue", reason: NUDGE_TEXT };
    }

    if (normalStop && this.messageQueue.length > 0) {
      const msgs = this.messageQueue.splice(0);
      this.deliverMessages(msgs);
      this.logger.info(`[Hook] Continuing the turn with ${msgs.length} queued message(s).`);
      return { decision: "continue", reason: this.formatMessagesForAgent(msgs) };
    }

    const noReply = this.turnActive && this.turnHadUserMessage && !this.turnFinalSent && !this.turnStoppedByUser;
    this.endTurn(`stop hook: ${terminationReason || "model_stop"}`, noReply);

    if (normalStop && res && this.holdSeconds > 0 && !this.isWakerOnline()) {
      return this.holdStop(res);
    }
    return { decision: "stop" };
  }

  /** Park the finished turn: no model calls happen while this request is open. */
  private holdStop(res: http.ServerResponse): Promise<StopHookOutput> {
    if (this.heldStop) {
      clearTimeout(this.heldStop.timer);
      this.heldStop.resolve({ decision: "stop" });
      this.heldStop = null;
    }
    this.logger.info(`[Hook] No waker online. Holding the finished turn for up to ${this.holdSeconds}s.`);
    return new Promise((resolve) => {
      const held: HeldStop = {
        resolve: (out) => {
          if (this.heldStop === held) this.heldStop = null;
          clearTimeout(held.timer);
          resolve(out);
          this.broadcastStatus();
        },
        timer: setTimeout(() => {
          this.logger.info("[Hook] Hold expired. The agent goes to sleep.");
          held.resolve({ decision: "stop" });
        }, this.holdSeconds * 1000),
      };
      this.heldStop = held;
      res.on("close", () => {
        if (this.heldStop === held && !res.writableEnded) {
          this.logger.warn("[Hook] The held Stop hook was closed by Antigravity.");
          clearTimeout(held.timer);
          this.heldStop = null;
          this.broadcastStatus();
        }
      });
      this.broadcastStatus();
    });
  }

  private releaseHeldStop(): void {
    const held = this.heldStop;
    if (!held) return;
    const msgs = this.messageQueue.splice(0);
    if (msgs.length === 0) return;
    this.deliverMessages(msgs);
    this.logger.info(`[Hook] Releasing the held turn with ${msgs.length} message(s).`);
    held.resolve({ decision: "continue", reason: this.formatMessagesForAgent(msgs) });
  }

  private readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new Error("Body too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });
      req.on("error", reject);
    });
  }

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    if (res.writableEnded) return;
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  }

  // Task state and Glow handling
  public broadcastTaskState(state: TaskStateType, tabId?: number, label?: string): void {
    const tid = tabId ?? this.activeTabId;
    this.broadcast({
      type: "task_state",
      state,
      tabId: tid,
      label,
    });
  }

  /**
   * v4: the panel and the page overlay stay in "working" for the whole turn. Between tool calls the
   * agent is thinking, so we say that instead of flipping to idle (which made the glow blink and
   * produced false "task incomplete" notes). Idle only comes from the end of the turn.
   */
  private resetInactivityTimer(): void {
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    this.taskStateTimer = null;
  }

  private thinkingLabel(): string {
    return this.userUiLanguage === "ar" ? "بيفكر..." : "Thinking...";
  }

  /** Kept for the watchdog API used by older code paths. It no longer ends turns on its own. */
  private startTaskWatchdog(): void {
    this.clearTaskWatchdog();
  }

  private resetTaskWatchdog(): void {
    // no-op in v4 (see resetInactivityTimer)
  }

  private clearTaskWatchdog(): void {
    if (this.taskWatchdogTimer) {
      clearTimeout(this.taskWatchdogTimer);
      this.taskWatchdogTimer = null;
    }
  }

  public getActionLabel(tool: string, params: Record<string, unknown>, lang = this.userUiLanguage): string {
    const isAr = lang === "ar";
    switch (tool) {
      case "click":
        return isAr ? `نقر: ${params.ref || ""}` : `Clicking: ${params.ref || ""}`;
      case "type":
        return isAr ? `كتابة: ${String(params.text || "").slice(0, 20)}` : `Typing: ${String(params.text || "").slice(0, 20)}`;
      case "press_key":
        return isAr ? `ضغط: ${params.keys}` : `Pressing: ${params.keys}`;
      case "scroll":
        return isAr ? `تمرير ${params.direction || "أسفل"}` : `Scrolling ${params.direction || "down"}`;
      case "scroll_to":
        return isAr ? `تمرير إلى: ${params.ref || ""}` : `Scrolling to: ${params.ref || ""}`;
      case "navigate":
        return isAr ? `الانتقال إلى: ${String(params.url || "").slice(0, 25)}` : `Navigating: ${String(params.url || "").slice(0, 25)}`;
      case "read_page":
        return isAr ? `قراءة محتوى الصفحة` : `Reading page`;
      case "screenshot":
        return isAr ? `التقاط صورة` : `Screenshot`;
      case "hover":
        return isAr ? `تأشير على: ${params.ref || ""}` : `Hovering: ${params.ref || ""}`;
      case "drag":
        return isAr ? `سحب وإفلات` : `Dragging`;
      case "upload_file":
        return isAr ? `رفع ملف` : `Uploading file`;
      case "wait":
        return isAr ? `انتظار...` : `Waiting...`;
      case "handle_dialog":
        return isAr ? `نافذة حوار` : `Handling dialog`;
      default:
        return tool;
    }
  }

  // Listening State
  public isListening(): boolean {
    return this.isListeningCurrently;
  }

  public isUserStopped(): boolean {
    return this.isStopped;
  }

  // Chat Tool Handlers
  public async waitForUserMessage(timeoutSeconds: number): Promise<UserChatMessage | null> {
    this.pendingWaitCalls++;
    if (this.listeningTimer) {
      clearTimeout(this.listeningTimer);
      this.listeningTimer = null;
    }
    if (!this.isListeningCurrently) {
      this.isListeningCurrently = true;
      this.broadcast({ type: "listening_state", listening: true });
    }

    const deliver = (userMsg: UserChatMessage | null) => {
      this.pendingWaitCalls = Math.max(0, this.pendingWaitCalls - 1);
      if (this.pendingWaitCalls === 0) {
        if (this.listeningTimer) clearTimeout(this.listeningTimer);
        this.listeningTimer = setTimeout(() => {
          if (this.pendingWaitCalls === 0) {
            this.isListeningCurrently = false;
            this.broadcast({ type: "listening_state", listening: false });
          }
        }, 10000);
      }

      if (userMsg) {
        this.deliverMessages([userMsg]);
      }
      this.broadcastStatus();
      return userMsg;
    };

    if (this.messageQueue.length > 0) {
      return deliver(this.messageQueue.shift()!);
    }

    // The agent is idling in the legacy loop: it is not "working".
    if (this.turnActive && this.turnFinalSent) {
      this.endTurn("legacy wait after final reply");
    }

    return new Promise<UserChatMessage | null>((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      const resolver = (msg: UserChatMessage | null) => {
        if (timer) clearTimeout(timer);
        resolve(deliver(msg));
      };

      this.waitResolvers.push(resolver);
      this.broadcastStatus();

      timer = setTimeout(() => {
        const idx = this.waitResolvers.indexOf(resolver);
        if (idx !== -1) {
          this.waitResolvers.splice(idx, 1);
        }
        resolve(deliver(null));
      }, timeoutSeconds * 1000);
    });
  }

  public sendReply(text: string, kind: "progress" | "final"): void {
    this.markAgentActive();
    this.broadcast({
      type: "agent_reply",
      text,
      kind,
      replyId: `reply_${Date.now()}`,
      turnId: this.turnId,
    });

    if (kind === "progress") {
      this.resetTaskWatchdog();
    } else if (kind === "final") {
      this.turnFinalSent = true;
      this.clearTaskWatchdog();
      const doneLabel = this.userUiLanguage === "ar" ? "خلص" : "Done";
      this.broadcastTaskState("done", this.activeTabId, doneLabel);
      const t = setTimeout(() => {
        // Without a confirmed Stop hook we cannot see the real end of the turn,
        // so treat the final reply as the end.
        if (!this.hooksConfirmed() && this.turnActive && this.messageQueue.length === 0) {
          this.endTurn("final reply");
        } else {
          this.broadcastTaskState("idle", this.activeTabId);
        }
      }, 800);
      t.unref?.();
    }
  }


  public broadcastActivity(event: ToolActivityEvent): void {
    this.broadcast({
      type: "activity_event",
      event: { ...event, turnId: this.turnId },
    });
  }

  /** update_plan: a short checklist the panel pins above the composer while the agent works. */
  public updatePlan(steps: PlanStep[]): void {
    this.markAgentActive();
    this.turnPlan = steps.map((s) => ({ title: String(s.title).slice(0, 160), status: s.status }));
    const done = this.turnPlan.filter((s) => s.status === "done").length;
    this.logger.info(`[Plan ${this.turnId}] ${done}/${this.turnPlan.length} done.`);
    this.broadcast({ type: "plan_update", turnId: this.turnId, steps: this.turnPlan });
  }

  public async askUser(question: string, options?: string[], timeoutSeconds = 120): Promise<string> {
    this.markAgentActive();
    const correlationId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isWaitingForUser = true;
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    const waitLabel = this.userUiLanguage === "ar" ? "في انتظار إجابتك..." : "Waiting for input...";
    this.broadcastTaskState("waiting", this.activeTabId, waitLabel);

    this.broadcast({
      type: "ask_user",
      correlationId,
      question,
      options,
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.isWaitingForUser = false;
        this.pendingQuestions.delete(correlationId);
        this.resetInactivityTimer();
        reject(new Error("User did not answer within timeout"));
      }, timeoutSeconds * 1000);

      this.pendingQuestions.set(correlationId, {
        resolve: (res) => {
          this.isWaitingForUser = false;
          this.resetInactivityTimer();
          if (this.turnActive) this.broadcastTaskState("thinking", this.activeTabId, this.thinkingLabel());
          resolve(res.answer || "");
        },
        timer,
      });
    });
  }

  public async requestConfirmation(summary: string, timeoutSeconds = 120): Promise<boolean> {
    this.markAgentActive();
    const correlationId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isWaitingForUser = true;
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    const waitLabel = this.userUiLanguage === "ar" ? "في انتظار تأكيد الإجراء..." : "Waiting for confirmation...";
    this.broadcastTaskState("waiting", this.activeTabId, waitLabel);

    this.broadcast({
      type: "request_confirmation",
      correlationId,
      summary,
    });

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.isWaitingForUser = false;
        this.pendingQuestions.delete(correlationId);
        this.resetInactivityTimer();
        resolve(false);
      }, timeoutSeconds * 1000);

      this.pendingQuestions.set(correlationId, {
        resolve: (res) => {
          this.isWaitingForUser = false;
          this.resetInactivityTimer();
          if (this.turnActive) this.broadcastTaskState("thinking", this.activeTabId, this.thinkingLabel());
          resolve(Boolean(res.approved));
        },
        timer,
      });
    });
  }

  // Browser Remote Command Dispatcher
  public async executeBrowserCommand(
    tool: string,
    params: Record<string, unknown>,
    timeoutMs = 35000,
    intent?: string
  ): Promise<unknown> {
    if (this.isStopped) {
      throw new Error(
        "stopped_by_user: the user pressed Stop in the side panel. Do not call more browser tools. Send one short reply_to_user(kind='final') and end your turn."
      );
    }

    if (!this.activeSocket || this.activeSocket.readyState !== WebSocket.OPEN) {
      throw new Error("Chrome extension is not connected. Make sure Chrome is open with the extension enabled.");
    }

    this.markAgentActive();
    this.resetTaskWatchdog();

    if (tool === "wait" || tool === "navigate") {
      const requestedSec = (params.timeout_seconds as number) || (params.timeout as number) || 0;
      timeoutMs = Math.max(35000, requestedSec * 1000 + 5000);
    }

    const effectiveIntent = intent || (typeof params.intent === "string" ? params.intent : undefined);
    const targetTabId = (params.tabId as number) || this.activeTabId;
    const actionLabel = effectiveIntent || this.getActionLabel(tool, params, this.userUiLanguage);
    this.broadcastTaskState("acting", targetTabId, actionLabel);
    this.resetInactivityTimer();

    const correlationId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const eventId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    this.turnTools += 1;

    this.broadcastActivity({
      id: eventId,
      correlationId,
      tool,
      args: params,
      status: "running",
      intent: effectiveIntent,
      timestamp: startedAt,
    });

    const afterCommand = () => {
      this.lastActivityAt = Date.now();
      if (this.turnActive && !this.isStopped && !this.isWaitingForUser) {
        this.broadcastTaskState("thinking", targetTabId, this.thinkingLabel());
      }
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(correlationId);
        this.turnErrors += 1;
        this.broadcastActivity({
          id: eventId,
          correlationId,
          tool,
          args: params,
          status: "error",
          intent: effectiveIntent,
          error: "Command timed out",
          durationMs: Date.now() - startedAt,
          timestamp: Date.now(),
        });
        afterCommand();
        reject(new Error(`Command ${tool} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingCommands.set(correlationId, {
        resolve: (result) => {
          this.broadcastActivity({
            id: eventId,
            correlationId,
            tool,
            args: params,
            status: "success",
            intent: effectiveIntent,
            resultSummary: summarizeResult(result),
            result: lightResult(result),
            durationMs: Date.now() - startedAt,
            timestamp: Date.now(),
          });
          afterCommand();
          resolve(result);
        },
        reject: (err) => {
          this.turnErrors += 1;
          this.broadcastActivity({
            id: eventId,
            correlationId,
            tool,
            args: params,
            status: "error",
            intent: effectiveIntent,
            error: err.message,
            durationMs: Date.now() - startedAt,
            timestamp: Date.now(),
          });
          afterCommand();
          reject(err);
        },
        timer,
      });

      this.send(this.activeSocket!, {
        type: "browser_command",
        correlationId,
        tool,
        params,
      });
    });
  }


  public async stop(): Promise<void> {
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    if (this.taskStateTimer) clearTimeout(this.taskStateTimer);
    if (this.statusTicker) clearInterval(this.statusTicker);
    this.statusTicker = null;
    if (this.turnSafetyTimer) clearTimeout(this.turnSafetyTimer);
    this.clearTaskWatchdog();
    if (this.heldStop) {
      clearTimeout(this.heldStop.timer);
      this.heldStop.resolve({ decision: "stop" });
      this.heldStop = null;
    }
    for (const w of this.wakerWaiters) {
      clearTimeout(w.timer);
      if (!w.res.writableEnded) {
        w.res.writeHead(204);
        w.res.end();
      }
    }
    this.wakerWaiters = [];
    for (const [, p] of this.pendingWakeJobs) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: "Server stopped" });
    }
    this.pendingWakeJobs.clear();

    for (const [, cmd] of this.pendingCommands) {
      clearTimeout(cmd.timer);
      cmd.reject(new Error("Server stopped"));
    }
    this.pendingCommands.clear();

    for (const [, q] of this.pendingQuestions) {
      clearTimeout(q.timer);
    }
    this.pendingQuestions.clear();

    if (this.activeSocket) {
      try {
        this.activeSocket.close();
      } catch {}
      this.activeSocket = null;
    }
    if (this.wss) {
      await new Promise<void>((res) => this.wss!.close(() => res()));
      this.wss = null;
    }
    if (this.httpServer) {
      await new Promise<void>((res) => this.httpServer!.close(() => res()));
      this.httpServer = null;
    }
    this.logger.info("[WS] Server gracefully stopped.");
  }
}
