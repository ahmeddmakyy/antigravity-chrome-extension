import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  MODES,
  DEFAULT_SETTINGS,
  hostOf,
  PROTECTED_HOST_SUFFIXES,
  PROTECTED_LABEL_PATTERNS,
  isProtectedHost,
  isUserBlocked,
  RISKY_NAME_PATTERNS,
  isRiskyName,
  evaluateAction,
  redactTabs,
  KNOWN_TOOLS,
  NO_PAGE_TOOLS,
  NO_PAGE_ACCESS,
} from "../../extension/shared/policy.js";

test("policy: exports and defaults", () => {
  assert.equal(MODES.MANUAL, "manual");
  assert.equal(MODES.AUTO, "auto");
  assert.equal(DEFAULT_SETTINGS.approvalMode, "manual");
  assert.equal(DEFAULT_SETTINGS.protectSensitiveSites, true);
  assert.ok(Array.isArray(PROTECTED_HOST_SUFFIXES));
  assert.ok(PROTECTED_HOST_SUFFIXES.length > 30);
  assert.ok(Array.isArray(PROTECTED_LABEL_PATTERNS));
  assert.ok(RISKY_NAME_PATTERNS);
  assert.ok(Array.isArray(RISKY_NAME_PATTERNS));
  assert.ok(Array.isArray(RISKY_NAME_PATTERNS.english));
  assert.ok(Array.isArray(RISKY_NAME_PATTERNS.arabic));
});

test("hostOf: extraction and edge cases", () => {
  // Standard http / https
  assert.equal(hostOf("https://example.com/foo"), "example.com");
  assert.equal(hostOf("http://example.com:8080/path"), "example.com");
  assert.equal(hostOf("https://sub.domain.co.uk/test?a=1"), "sub.domain.co.uk");

  // Uppercase and trailing dots
  assert.equal(hostOf("https://EXAMPLE.COM/foo"), "example.com");
  assert.equal(hostOf("https://EXAMPLE.COM./foo"), "example.com");
  assert.equal(hostOf("http://sub.EXAMPLE.COM.../"), "sub.example.com");

  // Non-http schemes and blank
  assert.equal(hostOf("about:blank"), null);
  assert.equal(hostOf("chrome://settings"), null);
  assert.equal(hostOf("chrome-extension://xyz/options.html"), null);
  assert.equal(hostOf("javascript:alert(1)"), null);
  assert.equal(hostOf("file:///c:/test.txt"), null);
  assert.equal(hostOf("data:text/html,test"), null);

  // Robustness against garbage and malformed input
  assert.equal(hostOf(""), null);
  assert.equal(hostOf("   "), null);
  assert.equal(hostOf("not a url"), null);
  assert.equal(hostOf(null), null);
  assert.equal(hostOf(undefined), null);
  assert.equal(hostOf(12345), null);
  assert.equal(hostOf({ url: "https://example.com" }), null);
});

test("isProtectedHost: boundary cases and suffixes", () => {
  const settings = { protectSensitiveSites: true };

  // Starter suffixes
  assert.equal(isProtectedHost("paypal.com", settings), true);
  assert.equal(isProtectedHost("www.paypal.com", settings), true);
  assert.equal(isProtectedHost("notpaypal.com", settings), false);
  assert.equal(isProtectedHost("paypal.com.evil.com", settings), false);

  assert.equal(isProtectedHost("stripe.com", settings), true);
  assert.equal(isProtectedHost("dashboard.stripe.com", settings), true);
  assert.equal(isProtectedHost("accounts.google.com", settings), true);
  assert.equal(isProtectedHost("myaccount.google.com", settings), true);
  assert.equal(isProtectedHost("login.microsoftonline.com", settings), true);
  assert.equal(isProtectedHost("coinbase.com", settings), true);
  assert.equal(isProtectedHost("nbe.com.eg", settings), true);
  assert.equal(isProtectedHost("cibeg.com", settings), true);

  // Label patterns
  assert.equal(isProtectedHost("onlinebanking.example.com", settings), true);
  assert.equal(isProtectedHost("bank.example.com", settings), true);
  assert.equal(isProtectedHost("ebanking.mycorp.org", settings), true);
  assert.equal(isProtectedHost("wallet.example.com", settings), true);
  assert.equal(isProtectedHost("ewallet.foo.com", settings), true);
  assert.equal(isProtectedHost("mybank.com", settings), true); // >5 chars, ends with bank
  assert.equal(isProtectedHost("testbank.org", settings), true); // >5 chars, ends with bank
  assert.equal(isProtectedHost("abank.com", settings), false); // 5 chars, not > 5
  assert.equal(isProtectedHost("example.com", settings), false);

  // Disabled protectSensitiveSites
  assert.equal(isProtectedHost("paypal.com", { protectSensitiveSites: false }), false);
  assert.equal(isProtectedHost("onlinebanking.example.com", { protectSensitiveSites: false }), false);

  // Allowed protected hosts override
  assert.equal(
    isProtectedHost("paypal.com", { protectSensitiveSites: true, allowedProtectedHosts: ["paypal.com"] }),
    false
  );
  assert.equal(
    isProtectedHost("www.paypal.com", { protectSensitiveSites: true, allowedProtectedHosts: ["paypal.com"] }),
    false
  );
  assert.equal(
    isProtectedHost("stripe.com", { protectSensitiveSites: true, allowedProtectedHosts: ["paypal.com"] }),
    true
  );

  // Malformed input
  assert.equal(isProtectedHost("", settings), false);
  assert.equal(isProtectedHost(null, settings), false);
  assert.equal(isProtectedHost(undefined, settings), false);
});

test("isUserBlocked: domain matching and protectSensitiveSites override", () => {
  const settings = {
    protectSensitiveSites: false,
    userBlocklist: ["blocked.com", "evil.org"],
  };

  assert.equal(isUserBlocked("blocked.com", settings), true);
  assert.equal(isUserBlocked("sub.blocked.com", settings), true);
  assert.equal(isUserBlocked("notblocked.com", settings), false);
  assert.equal(isUserBlocked("evil.org", settings), true);
  assert.equal(isUserBlocked("good.com", settings), false);

  // Case insensitivity and trailing dots
  assert.equal(isUserBlocked("BLOCKED.COM.", settings), true);

  // Empty or missing settings
  assert.equal(isUserBlocked("blocked.com", {}), false);
  assert.equal(isUserBlocked(null, settings), false);
  assert.equal(isUserBlocked(undefined, settings), false);
});

test("isRiskyName: English and Arabic keywords", () => {
  // English risky names (word boundaries)
  assert.equal(isRiskyName("Place order"), true);
  assert.equal(isRiskyName("Pay now"), true);
  assert.equal(isRiskyName("Delete account"), true);
  assert.equal(isRiskyName("Send"), true);
  assert.equal(isRiskyName("Log in"), true);
  assert.equal(isRiskyName("Sign in"), true);
  assert.equal(isRiskyName("Submit"), true);
  assert.equal(isRiskyName("Confirm transaction"), true);
  assert.equal(isRiskyName("Close account"), true);
  assert.equal(isRiskyName("Subscribe to plan"), true);
  assert.equal(isRiskyName("Donate $5"), true);

  // English non-risky
  assert.equal(isRiskyName("Next"), false);
  assert.equal(isRiskyName("Read more"), false);
  assert.equal(isRiskyName("Company"), false); // contains "pay" inside word
  assert.equal(isRiskyName("Back to home"), false);
  assert.equal(isRiskyName("Search"), false);

  // Arabic risky names (substring)
  assert.equal(isRiskyName("إرسال"), true);
  assert.equal(isRiskyName("ارسال"), true);
  assert.equal(isRiskyName("تأكيد الطلب"), true);
  assert.equal(isRiskyName("حذف الحساب"), true);
  assert.equal(isRiskyName("ادفع الآن"), true);
  assert.equal(isRiskyName("شراء"), true);
  assert.equal(isRiskyName("تسجيل الدخول"), true);
  assert.equal(isRiskyName("موافق"), true);
  assert.equal(isRiskyName("إلغاء"), true);

  // Arabic non-risky
  assert.equal(isRiskyName("التالي"), false);
  assert.equal(isRiskyName("الرئيسية"), false);
  assert.equal(isRiskyName("معلومات عنا"), false);

  // Malformed input
  assert.equal(isRiskyName(""), false);
  assert.equal(isRiskyName(null), false);
  assert.equal(isRiskyName(undefined), false);
  assert.equal(isRiskyName(123), false);
});

test("evaluateAction: protected site hard blocks in both modes", () => {
  // Manual mode click on protected site
  const res1 = evaluateAction({
    tool: "click",
    mode: "manual",
    tab: { id: 1, url: "https://www.paypal.com" },
  });
  assert.equal(res1.decision, "block");
  assert.equal(res1.code, "protected_site");
  assert.equal(res1.host, "www.paypal.com");

  // Auto mode click on protected site
  const res2 = evaluateAction({
    tool: "click",
    mode: "auto",
    tab: { id: 1, url: "https://www.paypal.com" },
  });
  assert.equal(res2.decision, "block");
  assert.equal(res2.code, "protected_site");

  // Navigation from granted site to protected site
  const res3 = evaluateAction({
    tool: "navigate",
    params: { url: "https://paypal.com/login" },
    mode: "manual",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
  });
  assert.equal(res3.decision, "block");
  assert.equal(res3.code, "protected_site");
  assert.equal(res3.host, "paypal.com");

  // Navigation back on a protected tab
  const res4 = evaluateAction({
    tool: "navigate",
    params: { url: "back" },
    mode: "auto",
    tab: { id: 1, url: "https://stripe.com/checkout" },
  });
  assert.equal(res4.decision, "block");
  assert.equal(res4.code, "protected_site");

  // User blocked host blocked even when protectSensitiveSites is false
  const res5 = evaluateAction({
    tool: "click",
    mode: "auto",
    tab: { id: 1, url: "https://evil.example.com" },
    settings: { protectSensitiveSites: false, userBlocklist: ["evil.example.com"] },
  });
  assert.equal(res5.decision, "block");
  assert.equal(res5.code, "protected_site");

  // Allowed protected host override allows the action
  const res6 = evaluateAction({
    tool: "navigate",
    params: { url: "https://paypal.com" },
    mode: "auto",
    settings: { allowedProtectedHosts: ["paypal.com"] },
  });
  assert.equal(res6.decision, "allow");
  assert.equal(res6.code, "auto");
});

test("evaluateAction: sensitive field hard blocks for typing tools in both modes", () => {
  const tools = ["type", "form_input", "press_key"];
  const modes = ["manual", "auto"];

  for (const tool of tools) {
    for (const mode of modes) {
      const res = evaluateAction({
        tool,
        mode,
        tab: { id: 1, url: "https://example.com" },
        grants: { session: ["example.com"] },
        element: { isSensitiveField: true, name: "Password" },
      });
      assert.equal(res.decision, "block", `${tool} in ${mode} must block sensitive field`);
      assert.equal(res.code, "sensitive_field");
    }
  }

  // Non-sensitive field on granted site is not blocked
  const resAllowed = evaluateAction({
    tool: "type",
    mode: "manual",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
    element: { isSensitiveField: false, name: "Username" },
  });
  assert.equal(resAllowed.decision, "allow");
  assert.equal(resAllowed.code, "ok");
});

test("evaluateAction: site_access workflow in manual mode", () => {
  // Ungranted site -> ask site_access
  const ungranted = evaluateAction({
    tool: "click",
    mode: "manual",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: [], always: [] },
    element: { name: "Next" },
  });
  assert.equal(ungranted.decision, "ask");
  assert.equal(ungranted.code, "site_access");
  assert.equal(ungranted.host, "example.com");

  // Granted via grants.session -> allowed
  const sessionGranted = evaluateAction({
    tool: "click",
    mode: "manual",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
    element: { name: "Next" },
  });
  assert.equal(sessionGranted.decision, "allow");
  assert.equal(sessionGranted.code, "ok");

  // Granted via grants.always -> allowed
  const alwaysGranted = evaluateAction({
    tool: "click",
    mode: "manual",
    tab: { id: 1, url: "https://sub.example.com" },
    grants: { always: ["example.com"] },
    element: { name: "Next" },
  });
  assert.equal(alwaysGranted.decision, "allow");
  assert.equal(alwaysGranted.code, "ok");

  // Destination host checked for tabs_create
  const createUngranted = evaluateAction({
    tool: "tabs_create",
    params: { url: "https://another.org" },
    mode: "manual",
  });
  assert.equal(createUngranted.decision, "ask");
  assert.equal(createUngranted.code, "site_access");
  assert.equal(createUngranted.host, "another.org");

  // No-page-access tools do not require site_access
  for (const tool of ["tabs_list", "tabs_activate", "wait"]) {
    const noAccess = evaluateAction({
      tool,
      mode: "manual",
      tab: { id: 1, url: "https://example.com" },
    });
    assert.equal(noAccess.decision, "allow", `${tool} should not require site_access`);
    assert.equal(noAccess.code, "ok");
  }
});

test("evaluateAction: manual vs auto risky actions matrix", () => {
  const tab = { id: 1, url: "https://example.com", isAgentTab: false };
  const grants = { session: ["example.com"] };

  const riskyClickNames = [
    "Place order",
    "Pay now",
    "Delete account",
    "Send",
    "Log in",
    "إرسال",
    "تأكيد الطلب",
    "حذف الحساب",
  ];

  for (const name of riskyClickNames) {
    // Manual mode asks risky_click
    const manRes = evaluateAction({
      tool: "click",
      mode: "manual",
      tab,
      grants,
      element: { name },
    });
    assert.equal(manRes.decision, "ask", `Manual mode click '${name}' must ask`);
    assert.equal(manRes.code, "risky_click");

    // Auto mode allows
    const autoRes = evaluateAction({
      tool: "click",
      mode: "auto",
      tab,
      grants,
      element: { name },
    });
    assert.equal(autoRes.decision, "allow", `Auto mode click '${name}' must allow`);
    assert.equal(autoRes.code, "auto");
  }

  // isSubmit = true triggers risky_click
  const submitRes = evaluateAction({
    tool: "click",
    mode: "manual",
    tab,
    grants,
    element: { isSubmit: true, name: "Continue" },
  });
  assert.equal(submitRes.decision, "ask");
  assert.equal(submitRes.code, "risky_click");

  // Safe clicks allowed in manual mode on granted site
  for (const name of ["Next", "Read more"]) {
    const safeRes = evaluateAction({
      tool: "click",
      mode: "manual",
      tab,
      grants,
      element: { name },
    });
    assert.equal(safeRes.decision, "allow");
    assert.equal(safeRes.code, "ok");
  }

  // execute_javascript
  const jsManual = evaluateAction({
    tool: "execute_javascript",
    mode: "manual",
    tab,
    grants,
  });
  assert.equal(jsManual.decision, "ask");
  assert.equal(jsManual.code, "run_script");

  const jsAuto = evaluateAction({
    tool: "execute_javascript",
    mode: "auto",
    tab,
    grants,
  });
  assert.equal(jsAuto.decision, "allow");
  assert.equal(jsAuto.code, "auto");

  // upload_file
  const uploadManual = evaluateAction({
    tool: "upload_file",
    mode: "manual",
    tab,
    grants,
  });
  assert.equal(uploadManual.decision, "ask");
  assert.equal(uploadManual.code, "upload");

  const uploadAuto = evaluateAction({
    tool: "upload_file",
    mode: "auto",
    tab,
    grants,
  });
  assert.equal(uploadAuto.decision, "allow");
  assert.equal(uploadAuto.code, "auto");

  // tabs_close
  const closeNonAgentManual = evaluateAction({
    tool: "tabs_close",
    mode: "manual",
    tab: { id: 1, isAgentTab: false, url: "https://example.com" },
    grants,
  });
  assert.equal(closeNonAgentManual.decision, "ask");
  assert.equal(closeNonAgentManual.code, "close_tab");

  const closeAgentManual = evaluateAction({
    tool: "tabs_close",
    mode: "manual",
    tab: { id: 1, isAgentTab: true, url: "https://example.com" },
    grants,
  });
  assert.equal(closeAgentManual.decision, "allow");
  assert.equal(closeAgentManual.code, "ok");

  const closeNonAgentAuto = evaluateAction({
    tool: "tabs_close",
    mode: "auto",
    tab: { id: 1, isAgentTab: false, url: "https://example.com" },
    grants,
  });
  assert.equal(closeNonAgentAuto.decision, "allow");
  assert.equal(closeNonAgentAuto.code, "auto");
});

test("evaluateAction: robustness and missing inputs", () => {
  assert.doesNotThrow(() => {
    const r1 = evaluateAction();
    assert.equal(r1.decision, "block");
    assert.equal(r1.code, "unknown_tool");
    assert.equal(r1.host, null);

    const r2 = evaluateAction({});
    assert.equal(r2.decision, "block");
    assert.equal(r2.code, "unknown_tool");

    const r3 = evaluateAction({ tool: null, params: null, settings: null });
    assert.equal(r3.decision, "block");
    assert.equal(r3.code, "unknown_tool");

    const r4 = evaluateAction({ tool: "click", element: "not an object" });
    assert.equal(r4.decision, "allow");
  });
});

test("redactTabs: behavior in manual and auto modes without mutation", () => {
  const originalTabs = [
    { id: 1, active: true, inMyChromeGroup: false, hasSidePanel: false, url: "https://paypal.com", title: "PayPal" },
    { id: 2, active: false, inMyChromeGroup: false, hasSidePanel: false, url: "https://blocked.com", title: "Blocked" },
    { id: 3, active: false, inMyChromeGroup: false, hasSidePanel: false, url: "https://ungranted.com", title: "Ungranted" },
    { id: 4, active: false, inMyChromeGroup: true, hasSidePanel: false, url: "https://ungranted.com", title: "Agent tab" },
    { id: 5, active: false, inMyChromeGroup: false, hasSidePanel: true, url: "https://ungranted.com", title: "Panel tab" },
    { id: 6, active: false, inMyChromeGroup: false, hasSidePanel: false, url: "https://granted.com", title: "Granted tab" },
    { id: 7, active: false, inMyChromeGroup: false, hasSidePanel: false, url: "about:blank", title: "Blank tab" },
  ];

  // Deep snapshot to test non-mutation
  const snapshot = JSON.stringify(originalTabs);

  // Manual mode
  const manualCtx = {
    mode: "manual",
    settings: { protectSensitiveSites: true, userBlocklist: ["blocked.com"] },
    grants: { session: ["granted.com"] },
  };

  const manualRedacted = redactTabs(originalTabs, manualCtx);

  // Input must not be mutated
  assert.equal(JSON.stringify(originalTabs), snapshot, "Input tabs must not be mutated");
  assert.notEqual(manualRedacted, originalTabs, "Must return a new array");

  // Tab 1 (paypal): restricted in manual mode
  assert.deepEqual(manualRedacted[0], {
    id: 1,
    active: true,
    inMyChromeGroup: false,
    hasSidePanel: false,
    restricted: true,
  });

  // Tab 2 (blocked): restricted in manual mode
  assert.deepEqual(manualRedacted[1], {
    id: 2,
    active: false,
    inMyChromeGroup: false,
    hasSidePanel: false,
    restricted: true,
  });

  // Tab 3 (ungranted, not agent, not panel): restricted in manual mode
  assert.deepEqual(manualRedacted[2], {
    id: 3,
    active: false,
    inMyChromeGroup: false,
    hasSidePanel: false,
    restricted: true,
  });

  // Tab 4 (inMyChromeGroup = true): returned unchanged
  assert.equal(manualRedacted[3], originalTabs[3]);

  // Tab 5 (hasSidePanel = true): returned unchanged
  assert.equal(manualRedacted[4], originalTabs[4]);

  // Tab 6 (granted site): returned unchanged
  assert.equal(manualRedacted[5], originalTabs[5]);

  // Tab 7 (about:blank): returned unchanged
  assert.equal(manualRedacted[6], originalTabs[6]);

  // Auto mode
  const autoCtx = {
    mode: "auto",
    settings: { protectSensitiveSites: true, userBlocklist: ["blocked.com"] },
    grants: { session: [] },
  };

  const autoRedacted = redactTabs(originalTabs, autoCtx);

  // Tab 1 & 2 still restricted in auto mode (protected / user blocked)
  assert.deepEqual(autoRedacted[0], {
    id: 1,
    active: true,
    inMyChromeGroup: false,
    hasSidePanel: false,
    restricted: true,
  });
  assert.deepEqual(autoRedacted[1], {
    id: 2,
    active: false,
    inMyChromeGroup: false,
    hasSidePanel: false,
    restricted: true,
  });

  // Tab 3 (ungranted) is allowed in auto mode
  assert.equal(autoRedacted[2], originalTabs[2]);

  // Malformed inputs to redactTabs
  assert.deepEqual(redactTabs(null), []);
  assert.deepEqual(redactTabs(undefined), []);
  assert.deepEqual(redactTabs("not an array"), []);
});

test("policy: scheme-less destinations are judged like https destinations", () => {
  const base = { settings: { protectSensitiveSites: true, userBlocklist: [], allowedProtectedHosts: [] }, grants: { always: [], session: [] }, tab: { id: 1, url: "https://example.com/", isAgentTab: true } };
  for (const mode of ["manual", "auto"]) {
    for (const url of ["paypal.com", "PayPal.com/login", "//paypal.com", "https://paypal.com", "www.paypal.com:443/x", "myaccount.google.com"]) {
      for (const tool of ["navigate", "tabs_create"]) {
        const r = evaluateAction({ ...base, mode, tool, params: { url } });
        assert.equal(r.decision, "block", mode + " " + tool + " " + url);
        assert.equal(r.code, "protected_site", mode + " " + tool + " " + url);
      }
    }
  }
  const ok = evaluateAction({ ...base, mode: "manual", tool: "navigate", params: { url: "example.org" }, grants: { always: ["example.org"], session: [] } });
  assert.equal(ok.decision, "allow");
  const ask = evaluateAction({ ...base, mode: "manual", tool: "navigate", params: { url: "example.org" } });
  assert.equal(ask.code, "site_access");
  assert.equal(ask.host, "example.org");
});

test("policy: non-web schemes and unparsable destinations are blocked in both modes", () => {
  const base = { settings: {}, grants: { always: ["example.com"], session: [] }, tab: { id: 1, url: "https://example.com/" } };
  for (const mode of ["manual", "auto"]) {
    for (const url of ["javascript:alert(1)", "data:text/html,hi", "file:///C:/Windows/win.ini", "ftp://example.com/x", "blob:https://example.com/abc", "chrome://settings", "view-source:https://example.com", "https://"]) {
      const r = evaluateAction({ ...base, mode, tool: "navigate", params: { url } });
      assert.equal(r.decision, "block", mode + " " + url);
      assert.equal(r.code, "unsupported_url", mode + " " + url);
    }
  }
  assert.equal(evaluateAction({ ...base, mode: "manual", tool: "tabs_create", params: {} }).decision, "allow");
  assert.equal(evaluateAction({ ...base, mode: "manual", tool: "tabs_create", params: { url: "about:blank" } }).decision, "allow");
  assert.equal(evaluateAction({ ...base, mode: "manual", tool: "navigate", params: { url: "back" } }).decision, "allow");
  assert.equal(evaluateAction({ ...base, mode: "manual", tool: "navigate", params: { url: "localhost:3000" } }).code, "site_access");
});

test("policy: redactTabs hides file and chrome tabs in manual mode only", () => {
  const tabs = [
    { id: 1, url: "file:///C:/Users/me/passwords.txt", title: "passwords", active: false },
    { id: 2, url: "chrome://settings/", title: "Settings", active: false },
    { id: 3, url: "about:blank", title: "", active: false },
    { id: 4, url: "chrome://newtab/", title: "New Tab", active: true, hasSidePanel: true },
  ];
  const manual = redactTabs(tabs, { mode: "manual", settings: {}, grants: {} });
  assert.equal(manual[0].restricted, true);
  assert.equal(manual[0].url, undefined);
  assert.equal(manual[1].restricted, true);
  assert.equal(manual[2].restricted, undefined);
  assert.equal(manual[3].restricted, undefined);
  const auto = redactTabs(tabs, { mode: "auto", settings: {}, grants: {} });
  assert.equal(auto[0].url, tabs[0].url);
});

test("policy: NO_PAGE tools list and KNOWN_TOOLS agree", () => {
  assert.equal(KNOWN_TOOLS.size, 23);
  assert.ok(Array.isArray(NO_PAGE_TOOLS));
  for (const tool of NO_PAGE_TOOLS) {
    assert.ok(KNOWN_TOOLS.has(tool), `NO_PAGE tool "${tool}" must be in KNOWN_TOOLS`);
  }
  for (const tool of NO_PAGE_ACCESS) {
    assert.ok(KNOWN_TOOLS.has(tool), `NO_PAGE_ACCESS tool "${tool}" must be in KNOWN_TOOLS`);
  }
});

test("policy: unknown tool blocked in both modes on granted and ungranted sites", () => {
  const grantedSite = {
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
  };
  const ungrantedSite = {
    tab: { id: 1, url: "https://example.com" },
    grants: { session: [] },
  };

  const unknownTools = ["unknown_tool_xyz", "eval", "exec", "destroy", ""];

  for (const tool of unknownTools) {
    // Granted site in manual mode
    const r1 = evaluateAction({ ...grantedSite, mode: "manual", tool });
    assert.equal(r1.decision, "block");
    assert.equal(r1.code, "unknown_tool");
    assert.equal(r1.reason, "This tool is not supported by this version of MyChrome.");
    assert.equal(r1.host, "example.com");

    // Granted site in auto mode
    const r2 = evaluateAction({ ...grantedSite, mode: "auto", tool });
    assert.equal(r2.decision, "block");
    assert.equal(r2.code, "unknown_tool");
    assert.equal(r2.reason, "This tool is not supported by this version of MyChrome.");

    // Ungranted site in manual mode
    const r3 = evaluateAction({ ...ungrantedSite, mode: "manual", tool });
    assert.equal(r3.decision, "block");
    assert.equal(r3.code, "unknown_tool");

    // Ungranted site in auto mode
    const r4 = evaluateAction({ ...ungrantedSite, mode: "auto", tool });
    assert.equal(r4.decision, "block");
    assert.equal(r4.code, "unknown_tool");
  }

  // Object prototype pollution / property lookups and undefined
  for (const tool of ["constructor", "__proto__", undefined]) {
    for (const mode of ["manual", "auto"]) {
      const res = evaluateAction({ ...grantedSite, mode, tool });
      assert.equal(res.decision, "block");
      assert.equal(res.code, "unknown_tool");
      assert.equal(res.reason, "This tool is not supported by this version of MyChrome.");
    }
  }
});

test("policy: every known tool still behaves as before", () => {
  const base = {
    mode: "auto",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
    params: { url: "https://example.com" },
  };
  for (const tool of KNOWN_TOOLS) {
    const res = evaluateAction({ ...base, tool });
    assert.notEqual(res.code, "unknown_tool", `Tool "${tool}" should be recognized as a known tool`);
    assert.equal(res.decision, "allow");
    assert.equal(res.code, "auto");
  }
});

test("policy: Enter in a form with risky submit name or sensitive field asks in manual and is allowed in auto", () => {
  const base = {
    tool: "press_key",
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
  };

  // 1. Enter in a form with risky submit name -> asks in manual, allowed in auto
  const riskyFormManual = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "Enter" },
    element: { inForm: true, formSubmitName: "Pay now", formHasSensitive: false },
  });
  assert.equal(riskyFormManual.decision, "ask");
  assert.equal(riskyFormManual.code, "risky_click");
  assert.ok(riskyFormManual.reason.includes("pressing Enter may submit a form"));

  const riskyFormAuto = evaluateAction({
    ...base,
    mode: "auto",
    params: { keys: "Enter" },
    element: { inForm: true, formSubmitName: "Pay now", formHasSensitive: false },
  });
  assert.equal(riskyFormAuto.decision, "allow");
  assert.equal(riskyFormAuto.code, "auto");

  // Key variants: NumpadEnter, case-insensitive enter, params.key, params.text
  const numpadRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "NumpadEnter" },
    element: { inForm: true, formSubmitName: "Delete", formHasSensitive: false },
  });
  assert.equal(numpadRes.decision, "ask");
  assert.equal(numpadRes.code, "risky_click");

  const lowerEnterRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "enter" },
    element: { inForm: true, formSubmitName: "Submit", formHasSensitive: false },
  });
  assert.equal(lowerEnterRes.decision, "ask");
  assert.equal(lowerEnterRes.code, "risky_click");

  const paramKeyRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { key: "Enter" },
    element: { inForm: true, formSubmitName: "Confirm", formHasSensitive: false },
  });
  assert.equal(paramKeyRes.decision, "ask");
  assert.equal(paramKeyRes.code, "risky_click");

  const paramTextRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { text: "Enter" },
    element: { inForm: true, formSubmitName: "Send", formHasSensitive: false },
  });
  assert.equal(paramTextRes.decision, "ask");
  assert.equal(paramTextRes.code, "risky_click");

  // 2. Enter in a form with sensitive field -> asks in manual, allowed in auto
  const sensitiveFormManual = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "Enter" },
    element: { inForm: true, formSubmitName: "Search", formHasSensitive: true },
  });
  assert.equal(sensitiveFormManual.decision, "ask");
  assert.equal(sensitiveFormManual.code, "risky_click");
  assert.ok(sensitiveFormManual.reason.includes("pressing Enter may submit a form"));

  const sensitiveFormAuto = evaluateAction({
    ...base,
    mode: "auto",
    params: { keys: "Enter" },
    element: { inForm: true, formSubmitName: "Search", formHasSensitive: true },
  });
  assert.equal(sensitiveFormAuto.decision, "allow");
  assert.equal(sensitiveFormAuto.code, "auto");

  // 3. Enter in a plain search form (no risky name, no sensitive field) -> allowed
  const plainSearchRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "Enter" },
    element: { inForm: true, formSubmitName: "Search", formHasSensitive: false },
  });
  assert.equal(plainSearchRes.decision, "allow");
  assert.equal(plainSearchRes.code, "ok");

  // 4. Enter outside a form -> allowed
  const outsideFormRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "Enter" },
    element: { inForm: false, formSubmitName: "", formHasSensitive: false },
  });
  assert.equal(outsideFormRes.decision, "allow");
  assert.equal(outsideFormRes.code, "ok");

  // 5. Other keys (Tab, a letter) in a risky form -> allowed
  const tabRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "Tab" },
    element: { inForm: true, formSubmitName: "Pay now", formHasSensitive: true },
  });
  assert.equal(tabRes.decision, "allow");
  assert.equal(tabRes.code, "ok");

  const letterRes = evaluateAction({
    ...base,
    mode: "manual",
    params: { keys: "a" },
    element: { inForm: true, formSubmitName: "Pay now", formHasSensitive: true },
  });
  assert.equal(letterRes.decision, "allow");
  assert.equal(letterRes.code, "ok");
});

test("policy: uninspectable frame blocks typing tools in both modes and allows click or read_page", () => {
  const base = {
    tab: { id: 1, url: "https://example.com" },
    grants: { session: ["example.com"] },
    element: { uninspectable: true },
  };

  const expectedReason = "Keys cannot be sent into an embedded frame that MyChrome cannot inspect, it may hold a password or card field. Ask the user to fill it.";

  // type, form_input, press_key blocked in both modes
  for (const tool of ["type", "form_input", "press_key"]) {
    for (const mode of ["manual", "auto"]) {
      const res = evaluateAction({ ...base, tool, mode });
      assert.equal(res.decision, "block", `${tool} in ${mode} must block uninspectable frame`);
      assert.equal(res.code, "uninspectable_frame");
      assert.equal(res.reason, expectedReason);
      assert.equal(res.host, "example.com");
    }
  }

  // click is not blocked
  const clickRes = evaluateAction({
    ...base,
    tool: "click",
    mode: "manual",
    element: { uninspectable: true, name: "Frame element" },
  });
  assert.equal(clickRes.decision, "allow");
  assert.equal(clickRes.code, "ok");

  // read_page is not blocked
  const readRes = evaluateAction({
    ...base,
    tool: "read_page",
    mode: "manual",
  });
  assert.equal(readRes.decision, "allow");
  assert.equal(readRes.code, "ok");

  // sensitive field inside same-origin frame (element.isSensitiveField true) blocked as sensitive_field
  for (const tool of ["type", "form_input", "press_key"]) {
    for (const mode of ["manual", "auto"]) {
      const sameOriginRes = evaluateAction({
        ...base,
        tool,
        mode,
        element: { isSensitiveField: true, uninspectable: false },
      });
      assert.equal(sameOriginRes.decision, "block");
      assert.equal(sameOriginRes.code, "sensitive_field");
    }
  }
});
