// shared/turn-model.js
// One agent turn as data. The background worker keeps the live turn (so a panel opened mid-task
// can replay it) and stores finished turns in the chat history. The side panel uses the same
// reducer to update its own copy while it animates the UI.
//
// Turn shape:
// { id, turnId, startedAt, endedAt, userCmid, phase, segments: [Note | Group], plan, final, outcome }
// Note:  { kind: "note", id, text, at }
// Group: { kind: "group", id, steps: [Step] }
// Step:  { id, correlationId, tool, intent, args, status, start, end, error, result, summary, shot }

export const TURN_MODEL_VERSION = 4;

const MAX_STR = 300;

function clip(v, n = MAX_STR) {
  if (typeof v !== "string") return v;
  return v.length > n ? v.slice(0, n - 1) + "…" : v;
}

/** Keep arguments small: they are shown as "Request" and stored in history. */
export function lightArgs(tool, args) {
  if (!args || typeof args !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "intent") continue;
    if (typeof v === "string") out[k] = clip(v, k === "code" ? 600 : MAX_STR);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 8).map((x) => (typeof x === "string" ? clip(x, 120) : x));
    else if (typeof v === "object") out[k] = JSON.parse(JSON.stringify(v));
  }
  return out;
}

export function createTurn({ id, startedAt = Date.now(), userCmid = null, turnId = null } = {}) {
  return {
    v: TURN_MODEL_VERSION,
    id: id || `L${startedAt}_${Math.random().toString(36).slice(2, 6)}`,
    turnId,
    startedAt,
    endedAt: null,
    userCmid,
    phase: "sending",
    phaseLabel: "",
    lastEventAt: startedAt,
    segments: [],
    plan: null,
    final: null,
    outcome: null,
  };
}

export function findStep(turn, stepId) {
  for (const seg of turn.segments) {
    if (seg.kind !== "group") continue;
    const s = seg.steps.find((x) => x.id === stepId);
    if (s) return { step: s, group: seg };
  }
  return null;
}

export function findStepByCorrelation(turn, correlationId) {
  if (!correlationId) return null;
  for (const seg of turn.segments) {
    if (seg.kind !== "group") continue;
    const s = seg.steps.find((x) => x.correlationId === correlationId);
    if (s) return { step: s, group: seg };
  }
  return null;
}

/** Add or update a tool step. A new step joins the last group, or opens a new one after a note. */
export function applyActivity(turn, ev, now = Date.now()) {
  turn.lastEventAt = now;
  const hit = findStep(turn, ev.id);
  if (hit) {
    const s = hit.step;
    s.status = ev.status;
    if (ev.intent) s.intent = clip(ev.intent, 200);
    if (ev.status !== "running") {
      s.end = now;
      if (typeof ev.durationMs === "number") s.ms = ev.durationMs;
      s.error = ev.error ? clip(String(ev.error), 300) : null;
      s.result = ev.result || null;
      s.summary = ev.resultSummary ? clip(ev.resultSummary, 1500) : null;
    }
    turn.phase = ev.status === "running" ? "working" : "thinking";
    return { step: s, group: hit.group, isNew: false, newGroup: false };
  }
  let group = turn.segments[turn.segments.length - 1];
  let newGroup = false;
  if (!group || group.kind !== "group") {
    group = { kind: "group", id: `g_${ev.id}`, steps: [] };
    turn.segments.push(group);
    newGroup = true;
  }
  const step = {
    id: ev.id,
    correlationId: ev.correlationId || null,
    tool: ev.tool,
    intent: ev.intent ? clip(ev.intent, 200) : "",
    args: lightArgs(ev.tool, ev.args),
    status: ev.status,
    start: now,
    end: ev.status === "running" ? null : now,
    ms: typeof ev.durationMs === "number" ? ev.durationMs : null,
    error: ev.error ? clip(String(ev.error), 300) : null,
    result: ev.result || null,
    summary: ev.resultSummary ? clip(ev.resultSummary, 1500) : null,
    shot: ev.tool === "screenshot",
  };
  group.steps.push(step);
  turn.phase = ev.status === "running" ? "working" : "thinking";
  return { step, group, isNew: true, newGroup };
}

export function applyProgress(turn, text, now = Date.now()) {
  turn.lastEventAt = now;
  const note = { kind: "note", id: `n_${now}_${Math.random().toString(36).slice(2, 5)}`, text: String(text || ""), at: now };
  turn.segments.push(note);
  turn.phase = "thinking";
  return note;
}

export function applyPlan(turn, steps, now = Date.now()) {
  turn.lastEventAt = now;
  turn.plan = (steps || []).map((s) => ({ title: clip(String(s.title || ""), 160), status: s.status }));
  return turn.plan;
}

export function applyFinal(turn, text, now = Date.now()) {
  turn.lastEventAt = now;
  turn.final = String(text || "");
  turn.phase = "writing";
  turn.outcome = "final";
  return turn;
}

/** Steps still "running" when a turn ends did not finish. */
export function closeTurn(turn, outcome, now = Date.now()) {
  turn.endedAt = now;
  if (!turn.outcome || outcome === "stopped") turn.outcome = turn.final ? "final" : outcome;
  if (outcome === "stopped" && !turn.final) turn.outcome = "stopped";
  for (const seg of turn.segments) {
    if (seg.kind !== "group") continue;
    for (const s of seg.steps) {
      if (s.status === "running") {
        s.status = "error";
        s.end = now;
        s.error = s.error || (outcome === "stopped" ? "stopped_by_user" : "did not finish");
      }
    }
  }
  turn.phase = "done";
  return turn;
}

export function countSteps(turn) {
  let n = 0;
  let shots = 0;
  let errors = 0;
  for (const seg of turn.segments) {
    if (seg.kind !== "group") continue;
    for (const s of seg.steps) {
      n += 1;
      if (s.shot && s.status === "success") shots += 1;
      if (s.status === "error") errors += 1;
    }
  }
  return { n, shots, errors };
}

/** Compact copy for chrome.storage (no images, shorter summaries). */
export function toHistoryEntry(turn) {
  const segments = turn.segments.map((seg) => {
    if (seg.kind === "note") return { kind: "note", id: seg.id, text: clip(seg.text, 2000), at: seg.at };
    const starts = seg.steps.map((s) => s.start).filter(Boolean);
    const ends = seg.steps.map((s) => s.end).filter(Boolean);
    return {
      kind: "group",
      id: seg.id,
      ms: starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : null,
      steps: seg.steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        intent: s.intent,
        args: s.args,
        status: s.status,
        ms: s.ms ?? (s.end && s.start ? s.end - s.start : null),
        error: s.error,
        result: s.result,
        summary: s.summary ? clip(s.summary, 400) : null,
        shot: s.shot,
      })),
    };
  });
  return {
    sender: "agent",
    v: TURN_MODEL_VERSION,
    id: turn.id,
    turnId: turn.turnId,
    userCmid: turn.userCmid,
    text: turn.final || "",
    outcome: turn.outcome || (turn.final ? "final" : "no_reply"),
    timestamp: turn.endedAt || Date.now(),
    startedAt: turn.startedAt,
    seconds: Math.max(1, Math.round(((turn.endedAt || Date.now()) - turn.startedAt) / 1000)),
    segments,
    plan: turn.plan,
  };
}

/** v3 history entries stored only { steps: [{ tool, intent, status, ms }] }. Show them as one group. */
export function fromLegacyEntry(item) {
  if (item.segments) return item;
  const steps = (item.steps || []).map((s, i) => ({ id: `h${i}`, tool: s.tool, intent: s.intent, status: s.status, ms: s.ms, args: {}, shot: s.tool === "screenshot" }));
  return { ...item, v: TURN_MODEL_VERSION, outcome: "final", segments: steps.length ? [{ kind: "group", id: "g0", steps }] : [] };
}
