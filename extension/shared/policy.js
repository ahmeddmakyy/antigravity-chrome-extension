// shared/policy.js
// Approval policy engine for browser commands.
// Evaluates every browser command against safety rules, approval modes,
// sensitive site protections, and form field safety. Pure ES module with no DOM or Chrome APIs.

/**
 * Approval modes supported by the extension.
 * @type {{ readonly MANUAL: "manual", readonly AUTO: "auto" }}
 */
export const MODES = Object.freeze({
  MANUAL: "manual",
  AUTO: "auto",
});

/**
 * Default settings for the policy engine.
 * @type {{ readonly approvalMode: "manual", readonly protectSensitiveSites: true }}
 */
export const DEFAULT_SETTINGS = Object.freeze({
  approvalMode: "manual",
  protectSensitiveSites: true,
});

/**
 * Known browser tools implemented by MyChrome.
 * @type {ReadonlySet<string>}
 */
export const KNOWN_TOOLS = Object.freeze(
  new Set([
    "click",
    "drag",
    "execute_javascript",
    "find",
    "form_input",
    "get_page_text",
    "handle_dialog",
    "hover",
    "navigate",
    "press_key",
    "read_console",
    "read_network",
    "read_page",
    "screenshot",
    "scroll",
    "scroll_to",
    "tabs_activate",
    "tabs_close",
    "tabs_create",
    "tabs_list",
    "type",
    "upload_file",
    "wait",
  ])
);

/**
 * Tools that operate without needing page/DOM content access.
 * @type {ReadonlyArray<string>}
 */
export const NO_PAGE_TOOLS = Object.freeze([
  "tabs_list",
  "tabs_close",
  "tabs_activate",
  "wait",
]);
export const NO_PAGE_ACCESS = NO_PAGE_TOOLS;

/**
 * Checks whether the key parameter for press_key is Enter or NumpadEnter.
 * @param {Record<string, any>} [params]
 * @returns {boolean}
 */
function isEnterKey(params) {
  const candidates = [params?.keys, params?.key, params?.text];
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      const lower = trimmed.toLowerCase();
      if (lower === "enter" || lower === "numpadenter") return true;
      const parts = trimmed.split("+").map((p) => p.trim()).filter(Boolean);
      const main = (parts.pop() || "").toLowerCase();
      if (main === "enter" || main === "numpadenter") return true;
    }
  }
  return false;
}

/**
 * Extract lowercased hostname without trailing dot from an http or https URL.
 * Returns null if the URL is not http/https, is about:blank, empty, or unparseable.
 * @param {string} [url]
 * @returns {string|null}
 */
export function hostOf(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "about:blank") return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    return host || null;
  } catch {
    return null;
  }
}

// Starter list of sensitive domains; users extend it through the blocklist setting.
export const PROTECTED_HOST_SUFFIXES = Object.freeze([
  // Payment providers
  "paypal.com",
  "stripe.com",
  "wise.com",
  "revolut.com",
  "payoneer.com",
  "venmo.com",
  "cash.app",
  "klarna.com",
  "alipay.com",
  "pay.google.com",

  // Password managers and identity providers
  "1password.com",
  "bitwarden.com",
  "lastpass.com",
  "dashlane.com",
  "keepersecurity.com",
  "nordpass.com",
  "accounts.google.com",
  "myaccount.google.com",
  "login.microsoftonline.com",
  "account.microsoft.com",
  "appleid.apple.com",
  "login.live.com",

  // Crypto exchanges and wallets
  "coinbase.com",
  "binance.com",
  "kraken.com",
  "metamask.io",
  "bybit.com",
  "okx.com",

  // Brokers
  "fidelity.com",
  "schwab.com",
  "robinhood.com",
  "interactivebrokers.com",
  "vanguard.com",

  // Well known banks
  "chase.com",
  "bankofamerica.com",
  "wellsfargo.com",
  "citi.com",
  "hsbc.com",
  "barclays.co.uk",
  "nbe.com.eg",
  "cibeg.com",
  "banquemisr.com",
  "qnb.com.eg",
  "alexbank.com",
]);

/**
 * Rules on single hostname labels (split on dots) that also count as protected.
 * @type {ReadonlyArray<RegExp>}
 */
export const PROTECTED_LABEL_PATTERNS = Object.freeze([
  /^bank$/i,
  /^banking$/i,
  /^ebanking$/i,
  /^netbanking$/i,
  /^onlinebanking$/i,
  /^mobilebanking$/i,
  /^wallet$/i,
  /^ewallet$/i,
  /^.{2,}bank$/i, // longer than 5 characters ending in bank
]);

/**
 * Checks whether a host is protected.
 * True when settings.protectSensitiveSites is not false and the host equals a suffix
 * or ends with "." plus a suffix, or a label matches label patterns, and the host is
 * NOT listed in settings.allowedProtectedHosts.
 * @param {string} host
 * @param {{ protectSensitiveSites?: boolean, allowedProtectedHosts?: string[] }} [settings]
 * @returns {boolean}
 */
export function isProtectedHost(host, settings) {
  if (!host || typeof host !== "string") return false;
  if (settings && settings.protectSensitiveSites === false) return false;

  const h = host.toLowerCase().replace(/\.+$/, "");
  if (!h) return false;

  const allowed = Array.isArray(settings?.allowedProtectedHosts)
    ? settings.allowedProtectedHosts
    : [];
  for (const item of allowed) {
    if (typeof item === "string") {
      const a = item.toLowerCase().replace(/\.+$/, "");
      if (a && (h === a || h.endsWith("." + a))) {
        return false;
      }
    }
  }

  for (const suffix of PROTECTED_HOST_SUFFIXES) {
    if (h === suffix || h.endsWith("." + suffix)) {
      return true;
    }
  }

  const labels = h.split(".");
  for (const label of labels) {
    for (const pat of PROTECTED_LABEL_PATTERNS) {
      if (pat instanceof RegExp ? pat.test(label) : pat === label) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a host is user blocked.
 * Applies even when settings.protectSensitiveSites is false.
 * @param {string} host
 * @param {{ userBlocklist?: string[] }} [settings]
 * @returns {boolean}
 */
export function isUserBlocked(host, settings) {
  if (!host || typeof host !== "string") return false;
  const h = host.toLowerCase().replace(/\.+$/, "");
  if (!h) return false;

  const blocklist = Array.isArray(settings?.userBlocklist) ? settings.userBlocklist : [];
  for (const entry of blocklist) {
    if (typeof entry === "string") {
      const b = entry.toLowerCase().replace(/\.+$/, "");
      if (b && (h === b || h.endsWith("." + b))) {
        return true;
      }
    }
  }

  return false;
}

const ENGLISH_RISKY_TERMS = [
  "pay",
  "payment",
  "buy",
  "purchase",
  "order",
  "place order",
  "checkout",
  "subscribe",
  "donate",
  "transfer",
  "withdraw",
  "deposit",
  "send",
  "post",
  "publish",
  "reply",
  "share",
  "delete",
  "remove",
  "cancel",
  "close account",
  "deactivate",
  "unsubscribe",
  "confirm",
  "submit",
  "apply",
  "sign in",
  "log in",
  "login",
  "sign up",
  "register",
  "authorize",
  "agree",
];

const ARABIC_RISKY_TERMS = [
  "دفع",
  "ادفع",
  "شراء",
  "اشتر",
  "اطلب",
  "تأكيد",
  "إرسال",
  "ارسل",
  "نشر",
  "حذف",
  "احذف",
  "إلغاء",
  "تحويل",
  "سحب",
  "اشتراك",
  "تسجيل الدخول",
  "تسجيل",
  "موافق",
  "إتمام",
];

const ENGLISH_PATTERNS = ENGLISH_RISKY_TERMS.map(
  (term) => new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i")
);

const ARABIC_PATTERNS = ARABIC_RISKY_TERMS.map((term) => new RegExp(term));

/**
 * English patterns (word boundaries) and Arabic patterns for accessible names.
 */
export const RISKY_NAME_PATTERNS = Object.freeze(
  Object.assign([...ENGLISH_PATTERNS, ...ARABIC_PATTERNS], {
    english: ENGLISH_PATTERNS,
    arabic: ARABIC_RISKY_TERMS,
  })
);

/**
 * Checks whether an element's accessible name indicates a risky action.
 * @param {string} [name]
 * @returns {boolean}
 */
export function isRiskyName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  for (const pat of ENGLISH_PATTERNS) {
    if (pat.test(trimmed)) return true;
  }

  const normTrimmed = trimmed.replace(/[\u064B-\u065F]/g, "").replace(/[إأآ]/g, "ا");
  for (const term of ARABIC_RISKY_TERMS) {
    if (trimmed.includes(term)) return true;
    const normTerm = term.replace(/[\u064B-\u065F]/g, "").replace(/[إأآ]/g, "ا");
    if (normTrimmed.includes(normTerm)) return true;
  }

  return false;
}

/**
 * Checks whether a host has been granted by the user.
 * @param {string} host
 * @param {{ always?: string[], session?: string[] }} [grants]
 * @returns {boolean}
 */
function isGrantedHost(host, grants) {
  if (!host || !grants || typeof host !== "string") return false;
  const h = host.toLowerCase().replace(/\.+$/, "");
  const list = [
    ...(Array.isArray(grants.always) ? grants.always : []),
    ...(Array.isArray(grants.session) ? grants.session : []),
  ];
  for (const entry of list) {
    if (typeof entry === "string") {
      const g = entry.toLowerCase().replace(/\.+$/, "");
      if (g && (h === g || h.endsWith("." + g))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolves the host a navigation or new tab would load, the way the extension does:
 * a URL without a scheme gets https:// in front of it. Anything that is not http, https
 * or about:blank, and anything that cannot be parsed, is reported as not ok (fail closed).
 * @param {string} raw
 * @returns {{ ok: true, host: string } | { ok: false }}
 */
function destinationHost(raw) {
  const looksLikeHostPort = /^[^/:?#\s]+:\d+(?:[/?#]|$)/.test(raw);
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !looksLikeHostPort;
  if (hasScheme && !/^https?:/i.test(raw)) return { ok: false };
  const host = hostOf(hasScheme ? raw : "https://" + raw);
  return host ? { ok: true, host } : { ok: false };
}

/**
 * Evaluates an agent action against safety policy.
 * @param {{
 *   tool?: string,
 *   params?: Record<string, any>,
 *   mode?: "manual" | "auto",
 *   settings?: {
 *     protectSensitiveSites?: boolean,
 *     userBlocklist?: string[],
 *     allowedProtectedHosts?: string[],
 *     approvalMode?: "manual" | "auto"
 *   },
 *   grants?: { always?: string[], session?: string[] },
 *   tab?: { id?: number, url?: string, isAgentTab?: boolean, isPanelTab?: boolean } | null,
 *   element?: { name?: string, role?: string, tag?: string, type?: string, isSubmit?: boolean, isSensitiveField?: boolean, inForm?: boolean, formSubmitName?: string, formHasSensitive?: boolean, uninspectable?: boolean } | null
 * }} [input]
 * @returns {{ decision: "allow" | "ask" | "block", code: string, host: string | null, reason: string }}
 */
export function evaluateAction(input) {
  try {
    const tool = input?.tool;
    const params = input?.params || {};
    const settings = input?.settings || {};
    const grants = input?.grants || {};
    const tab = input?.tab || null;
    const element = input?.element || null;
    const mode = input?.mode || settings?.approvalMode || MODES.MANUAL;

    // Target host resolution
    let targetHost = null;
    if (tool === "tabs_create" || tool === "navigate") {
      const rawUrl = typeof params.url === "string" ? params.url.trim() : "";
      const keyword = rawUrl.toLowerCase();
      if (tool === "navigate" && (keyword === "back" || keyword === "forward" || keyword === "reload")) {
        targetHost = hostOf(tab?.url);
      } else if (tool === "tabs_create" && (!rawUrl || rawUrl === "about:blank")) {
        targetHost = null;
      } else {
        const dest = destinationHost(rawUrl);
        if (!dest.ok) {
          return {
            decision: "block",
            code: "unsupported_url",
            host: null,
            reason: "Only http and https addresses can be opened by the agent.",
          };
        }
        targetHost = dest.host;
      }
    } else {
      targetHost = hostOf(tab?.url);
    }

    // Unknown tools blocked in both modes
    if (typeof tool !== "string" || !KNOWN_TOOLS.has(tool)) {
      return {
        decision: "block",
        code: "unknown_tool",
        host: targetHost,
        reason: "This tool is not supported by this version of MyChrome.",
      };
    }

    // 1. HARD BLOCK in both modes: user blocked or protected site
    if (targetHost && (isUserBlocked(targetHost, settings) || isProtectedHost(targetHost, settings))) {
      return {
        decision: "block",
        code: "protected_site",
        host: targetHost,
        reason: `Access to protected or blocked site "${targetHost}" is blocked.`,
      };
    }

    // 2. HARD BLOCK in both modes: sensitive password or card field, or uninspectable frame
    const sensitiveTools = ["type", "form_input", "press_key"];
    if (sensitiveTools.includes(tool) && element?.isSensitiveField === true) {
      return {
        decision: "block",
        code: "sensitive_field",
        host: targetHost,
        reason: "Interacting with sensitive field (password or card) is blocked.",
      };
    }

    if (sensitiveTools.includes(tool) && element?.uninspectable === true) {
      return {
        decision: "block",
        code: "uninspectable_frame",
        host: targetHost,
        reason: "Keys cannot be sent into an embedded frame that MyChrome cannot inspect, it may hold a password or card field. Ask the user to fill it.",
      };
    }

    // 3. Auto mode: allow
    if (mode === MODES.AUTO) {
      return {
        decision: "allow",
        code: "auto",
        host: targetHost,
        reason: "Action allowed in auto mode.",
      };
    }

    // 4. Manual mode: site access required for tools accessing page content
    if (!NO_PAGE_TOOLS.includes(tool) && targetHost && !isGrantedHost(targetHost, grants)) {
      return {
        decision: "ask",
        code: "site_access",
        host: targetHost,
        reason: `Approval required to access "${targetHost}".`,
      };
    }

    // 5. Manual mode: risky actions even on a granted site
    if (tool === "click" && (element?.isSubmit === true || isRiskyName(element?.name))) {
      return {
        decision: "ask",
        code: "risky_click",
        host: targetHost,
        reason: `Approval required for risky click on "${element?.name || "submit button"}".`,
      };
    }

    if (
      tool === "press_key" &&
      isEnterKey(params) &&
      element?.inForm === true &&
      (isRiskyName(element?.formSubmitName) || element?.formHasSensitive === true)
    ) {
      return {
        decision: "ask",
        code: "risky_click",
        host: targetHost,
        reason: "Approval required: pressing Enter may submit a form.",
      };
    }

    if (tool === "execute_javascript") {
      return {
        decision: "ask",
        code: "run_script",
        host: targetHost,
        reason: "Approval required to execute custom JavaScript.",
      };
    }

    if (tool === "upload_file") {
      return {
        decision: "ask",
        code: "upload",
        host: targetHost,
        reason: "Approval required to upload file.",
      };
    }

    if (tool === "tabs_close" && tab?.isAgentTab !== true) {
      return {
        decision: "ask",
        code: "close_tab",
        host: targetHost,
        reason: "Approval required to close non-agent tab.",
      };
    }

    // 6. Otherwise allow
    return {
      decision: "allow",
      code: "ok",
      host: targetHost,
      reason: "Action allowed.",
    };
  } catch {
    return {
      decision: "block",
      code: "error",
      host: null,
      reason: "Unexpected error during policy evaluation.",
    };
  }
}

/**
 * Redacts restricted tabs based on policy.
 * Returns a new array without mutating the input tabs.
 * @param {Array<object>} tabs
 * @param {{ mode?: "manual" | "auto", settings?: object, grants?: object }} [ctx]
 * @returns {Array<object>}
 */
export function redactTabs(tabs, ctx) {
  if (!Array.isArray(tabs)) return [];
  const settings = ctx?.settings || {};
  const grants = ctx?.grants || {};
  const mode = ctx?.mode || settings?.approvalMode || MODES.MANUAL;

  return tabs.map((tab) => {
    if (!tab || typeof tab !== "object") return tab;

    const host = hostOf(tab.url);
    let restricted = false;

    const tabUrl = typeof tab.url === "string" ? tab.url.trim() : "";
    if (host && (isUserBlocked(host, settings) || isProtectedHost(host, settings))) {
      restricted = true;
    } else if (mode !== MODES.AUTO && !host && tabUrl && tabUrl !== "about:blank" && !tab.inMyChromeGroup && !tab.hasSidePanel) {
      // file://, chrome:// and extension pages reveal local information through their url and title
      restricted = true;
    } else if (mode !== MODES.AUTO && host && !isGrantedHost(host, grants)) {
      if (!tab.inMyChromeGroup && !tab.hasSidePanel) {
        restricted = true;
      }
    }

    if (restricted) {
      return {
        id: tab.id,
        active: Boolean(tab.active),
        inMyChromeGroup: Boolean(tab.inMyChromeGroup),
        hasSidePanel: Boolean(tab.hasSidePanel),
        restricted: true,
      };
    }

    return tab;
  });
}
