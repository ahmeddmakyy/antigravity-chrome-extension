import http from "http";
import { Logger } from "./logger.js";
import { UserChatMessage, ToolActivityEvent, TaskStateType, WSServerMessage, AgentStatus, WakeMode, PlanStep, TurnSummary } from "./types.js";
export interface BridgeOptions {
    /** Folder where .session.json is kept (linked conversation, setup flags). */
    stateDir?: string;
    /** How long the Stop hook may park a finished turn when no waker is online. 0 disables. */
    holdSeconds?: number;
    /** Without a Stop hook, a turn with no agent activity for this long is presumed idle (tests shorten it). */
    presumedIdleMs?: number;
}
export interface StopHookOutput {
    decision: "continue" | "stop";
    reason?: string;
}
/** Replace data URLs and very long strings so results stay readable in the panel and the logs. */
export declare function summarizeResult(result: unknown, max?: number): string;
/** Keep only small top-level fields of a result: they let the panel write labels like "Clicked Save". */
export declare function lightResult(result: unknown): Record<string, unknown> | undefined;
export declare class BridgeWSServer {
    private wss;
    private httpServer;
    private activeSocket;
    private pairingToken;
    private logger;
    private port;
    private monotonicMessageId;
    private messageQueue;
    private waitResolvers;
    private pendingCommands;
    private pendingQuestions;
    private isStopped;
    private activeTabId;
    private userUiLanguage;
    private taskStateTimer;
    private taskWatchdogTimer;
    private isWaitingForUser;
    private pendingWaitCalls;
    private listeningTimer;
    private isListeningCurrently;
    private stateDir;
    private holdSeconds;
    private linkedConversationId;
    private linkPendingSince;
    private setupDone;
    private hooksSeenAt;
    private wakerLastSeen;
    private wakerWaiters;
    private wakerJobs;
    private pendingWakeJobs;
    private wakeInFlight;
    private heldStop;
    private attachments;
    private lastDeliveredBatch;
    private turnSeq;
    private turnId;
    private turnStartedAt;
    private turnFirstActivityAt;
    private lastActivityAt;
    private turnTools;
    private turnErrors;
    private turnPlan;
    private hookSelfTestAt;
    private extensionVersion;
    private presumedIdleMs;
    private pendingLanguageNote;
    private turnActive;
    private turnHadUserMessage;
    private turnFinalSent;
    private turnNudged;
    private turnStoppedByUser;
    private turnSafetyTimer;
    private lastStatusJson;
    private statusTicker;
    constructor(port: number, pairingToken: string, logger: Logger, options?: BridgeOptions);
    start(): Promise<void>;
    private handleClientMessage;
    private send;
    broadcast(msg: WSServerMessage): void;
    private sessionFile;
    private loadSessionState;
    private saveSessionState;
    private isWakerOnline;
    private hooksConfirmed;
    private isLinkPending;
    getWakeMode(): WakeMode;
    getAgentStatus(): AgentStatus & {
        version: string;
    };
    /** True when the agent can safely end its turn and still be woken up by the next panel message. */
    canEndTurnSafely(): boolean;
    broadcastStatus(): void;
    private routeUserMessage;
    /** Format one or more panel messages as plain text for the agent. */
    formatMessagesForAgent(msgs: UserChatMessage[], intro?: string): string;
    /** Mark messages as handed to the agent: ack them in the panel and start (or extend) a turn. */
    private deliverMessages;
    private beginTurn;
    /** Called on any agent tool call: the agent is clearly running. */
    private markAgentActive;
    getTurnSummary(reason: string): TurnSummary;
    private endTurn;
    /** If the Stop hook never arrives (not installed or broken), do not stay "busy" forever. */
    private armTurnSafety;
    /**
     * Messages that arrived while the agent was working. They are attached to the next
     * tool result so the agent sees them without ending its turn.
     */
    takeInterrupts(includeLanguageNote?: boolean): string | null;
    /** Used by read_panel_messages: queued messages first, otherwise the last delivered batch. */
    readPanelMessages(messageId?: number): {
        messages: UserChatMessage[];
        screenshots: Map<number, string>;
    };
    /** connect_side_panel: link this conversation and hand over anything already waiting. */
    connectPanel(conversationId?: string): {
        linked: boolean;
        linkPending: boolean;
        mode: WakeMode;
        canEndTurn: boolean;
        queued: UserChatMessage[];
    };
    private setLinkedConversation;
    private dispatchWake;
    private enqueueWakeJob;
    private handleControlRequest;
    private handleWakerNext;
    /**
     * Stop hook: Antigravity calls this every time an agent turn ends (any conversation).
     * - Links the conversation right after connect_side_panel.
     * - Makes sure the final answer went to the panel (one nudge).
     * - Hands over messages that arrived during the turn.
     * - With no waker online, parks the finished turn until the next message (hold mode).
     */
    handleStopHook(body: Record<string, unknown>, res?: http.ServerResponse): Promise<StopHookOutput>;
    /** Park the finished turn: no model calls happen while this request is open. */
    private holdStop;
    private releaseHeldStop;
    private readJsonBody;
    private sendJson;
    broadcastTaskState(state: TaskStateType, tabId?: number, label?: string): void;
    /**
     * v4: the panel and the page overlay stay in "working" for the whole turn. Between tool calls the
     * agent is thinking, so we say that instead of flipping to idle (which made the glow blink and
     * produced false "task incomplete" notes). Idle only comes from the end of the turn.
     */
    private resetInactivityTimer;
    private thinkingLabel;
    /** Kept for the watchdog API used by older code paths. It no longer ends turns on its own. */
    private startTaskWatchdog;
    private resetTaskWatchdog;
    private clearTaskWatchdog;
    getActionLabel(tool: string, params: Record<string, unknown>, lang?: string): string;
    isListening(): boolean;
    isUserStopped(): boolean;
    waitForUserMessage(timeoutSeconds: number): Promise<UserChatMessage | null>;
    sendReply(text: string, kind: "progress" | "final"): void;
    broadcastActivity(event: ToolActivityEvent): void;
    /** update_plan: a short checklist the panel pins above the composer while the agent works. */
    updatePlan(steps: PlanStep[]): void;
    askUser(question: string, options?: string[], timeoutSeconds?: number): Promise<string>;
    requestConfirmation(summary: string, timeoutSeconds?: number): Promise<boolean>;
    executeBrowserCommand(tool: string, params: Record<string, unknown>, timeoutMs?: number, intent?: string): Promise<unknown>;
    stop(): Promise<void>;
}
