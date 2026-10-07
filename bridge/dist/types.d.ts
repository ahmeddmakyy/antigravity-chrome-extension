export interface TabInfo {
    id: number;
    url: string;
    title: string;
    groupId?: number;
    active?: boolean;
}
export interface UserChatMessage {
    messageId: number;
    clientMsgId?: string;
    text: string;
    tab: TabInfo;
    screenshot?: string;
    ui_language?: string;
    timestamp: number;
}
export interface ToolActivityEvent {
    id: string;
    /** Matches the browser_command sent to the extension, so screenshots can be attached to the step. */
    correlationId?: string;
    turnId?: string;
    tool: string;
    args: Record<string, unknown>;
    status: "running" | "success" | "error";
    intent?: string;
    /** Short text version of the result (images replaced by a size note). */
    resultSummary?: string;
    /** Small structured fields the panel uses to label a step (for example the clicked element's name). */
    result?: Record<string, unknown>;
    durationMs?: number;
    error?: string;
    timestamp: number;
}
export type PlanStepStatus = "pending" | "in_progress" | "done";
export interface PlanStep {
    title: string;
    status: PlanStepStatus;
}
export interface TurnSummary {
    turnId: string;
    reason: string;
    finalSent: boolean;
    stoppedByUser: boolean;
    tools: number;
    errors: number;
    durationMs: number;
    /** Time from the start of the turn to the first tool call or reply. Long values mean the agent was slow to start. */
    firstActivityMs: number | null;
}
export type TaskStateType = "thinking" | "acting" | "waiting" | "done" | "idle";
/**
 * How the agent gets woken up when the user writes in the side panel.
 * - push:   a sidecar ("waker") delivers each message into the linked Antigravity
 *           conversation with `agentapi send-message`. Zero polling, zero idle tokens.
 * - hold:   no waker, but the Stop hook is installed. The hook keeps the finished
 *           turn parked (no model calls) until the next message arrives.
 * - legacy: the agent is inside a wait_for_user_message long-poll loop.
 * - none:   nothing can wake the agent right now. Messages are queued.
 */
export type WakeMode = "push" | "hold" | "legacy" | "none";
export interface AgentStatus {
    linked: boolean;
    linkPending: boolean;
    waker: boolean;
    hooks: boolean;
    setupDone: boolean;
    busy: boolean;
    mode: WakeMode;
    queued: number;
}
export type WSClientMessage = {
    type: "auth";
    token: string;
    extensionId?: string;
    extensionVersion?: string;
} | {
    type: "chat_message";
    text: string;
    tab: TabInfo;
    screenshot?: string;
    ui_language?: string;
    clientMsgId?: string;
} | {
    type: "command_result";
    correlationId: string;
    success: boolean;
    result?: unknown;
    error?: string;
} | {
    type: "browser_command_result";
    correlationId: string;
    result?: unknown;
    error?: string;
} | {
    type: "user_action";
    action: "stop" | "approve" | "deny" | "answer";
    correlationId?: string;
    value?: unknown;
} | {
    type: "client_event";
    name: string;
    data?: Record<string, unknown>;
} | {
    type: "ui_language";
    lang: string;
} | {
    type: "get_bridge_log";
} | {
    type: "ping";
};
export type WSServerMessage = {
    type: "auth_ok";
    listening: boolean;
    bridgeVersion?: string;
} | {
    type: "auth_error";
    error: string;
} | {
    type: "listening_state";
    listening: boolean;
} | {
    type: "agent_reply";
    text: string;
    kind: "progress" | "final";
    replyId: string;
    turnId?: string;
} | {
    type: "turn_started";
    turnId: string;
    fromUser: boolean;
    startedAt: number;
} | {
    type: "turn_ended";
    summary: TurnSummary;
} | {
    type: "plan_update";
    turnId?: string;
    steps: PlanStep[];
} | {
    type: "activity_event";
    event: ToolActivityEvent;
} | {
    type: "task_state";
    state: TaskStateType;
    tabId?: number;
    label?: string;
} | {
    type: "message_ack";
    clientMsgId: string;
} | {
    type: "task_incomplete";
} | {
    type: "bridge_log";
    lines: string[];
} | {
    type: "bridge_log_event";
    level: string;
    message: string;
    data?: unknown;
    timestamp: number;
} | {
    type: "ask_user";
    correlationId: string;
    question: string;
    options?: string[];
} | {
    type: "request_confirmation";
    correlationId: string;
    summary: string;
} | {
    type: "browser_command";
    correlationId: string;
    tool: string;
    params: Record<string, unknown>;
} | {
    type: "agent_status";
    status: AgentStatus;
} | {
    type: "delivery_error";
    error: string;
    clientMsgIds: string[];
} | {
    type: "system_note";
    code: string;
    text?: string;
} | {
    type: "pong";
};
