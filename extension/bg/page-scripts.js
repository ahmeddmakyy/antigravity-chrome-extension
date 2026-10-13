// bg/page-scripts.js
// Functions injected into the page with chrome.scripting.executeScript. Each one must be
// self-contained: it is serialized and runs in the page, not in the service worker.

/** Accessibility-style list of elements with stable refs (e1, e2...). Unchanged from v3. */
export const readPageScript = (filterMode) => {
  const win = window;
  win.__antigravityRefs = win.__antigravityRefs || { elemToRef: new WeakMap(), refToElem: new Map(), counter: 1 };
  const store = win.__antigravityRefs;

  // Remove old data-antigravity-ref attributes to avoid collisions
  document.querySelectorAll("[data-antigravity-ref]").forEach(el => el.removeAttribute("data-antigravity-ref"));

  const interactiveRoles = new Set([
    "button", "link", "checkbox", "menuitem", "option", "radio", "tab",
    "switch", "textbox", "combobox", "searchbox", "slider", "spinbutton"
  ]);

  const elements = [];
  const maxElements = 400;
  let isTruncated = false;

  function isVisible(el) {
    try {
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({ checkVisibilityCSS: true });
      }
      const rects = el.getClientRects();
      return rects && rects.length > 0;
    } catch {
      return true;
    }
  }

  function getAccessibleName(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      (el.innerText || "").trim()
    ).slice(0, 80);
  }

  function walk(root) {
    if (!root || elements.length >= maxElements) return;
    const nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];

    for (const el of nodes) {
      if (elements.length >= maxElements) {
        isTruncated = true;
        break;
      }
      if (!isVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || tag;
      const hasOnClick = Boolean(el.onclick) || el.hasAttribute("onclick");
      const isPointer = win.getComputedStyle(el).cursor === "pointer";
      const isTabFocusable = el.tabIndex >= 0;
      const isContentEditable = el.isContentEditable;

      const isInteractive =
        ["a", "button", "input", "select", "textarea", "summary"].includes(tag) ||
        interactiveRoles.has(role) ||
        hasOnClick ||
        isPointer ||
        isTabFocusable ||
        isContentEditable;

      const rect = el.getBoundingClientRect();
      const inViewport = (
        rect.top < win.innerHeight &&
        rect.bottom > 0 &&
        rect.left < win.innerWidth &&
        rect.right > 0
      );

      if (filterMode === "viewport" && !inViewport) continue;
      if (filterMode === "interactive" && !isInteractive) continue;

      let ref = store.elemToRef.get(el);
      if (!ref) {
        ref = `e${store.counter++}`;
        store.elemToRef.set(el, ref);
        store.refToElem.set(ref, el);
      }
      el.setAttribute("data-antigravity-ref", ref);

      elements.push({
        ref,
        role,
        name: getAccessibleName(el),
        value: el.value !== undefined ? String(el.value).slice(0, 50) : undefined,
        checked: el.checked !== undefined ? el.checked : undefined,
        disabled: el.disabled !== undefined ? el.disabled : undefined,
        expanded: el.getAttribute("aria-expanded") === "true",
        inViewport,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });

      // Walk open shadow root
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  }

  walk(document.body);

  return {
    header: {
      url: location.href,
      title: document.title,
      scrollY: Math.round(win.scrollY),
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      viewport: { width: win.innerWidth, height: win.innerHeight },
    },
    elements,
    truncated: isTruncated,
  };
};

/** Find elements whose text or label matches the query. Returns the most specific matches only. */
export const findScript = (q) => {
  const win = window;
  win.__antigravityRefs = win.__antigravityRefs || { elemToRef: new WeakMap(), refToElem: new Map(), counter: 1 };
  const store = win.__antigravityRefs;
  const query = String(q || "").toLowerCase().trim();
  if (!query) return [];
  const label = (el) => (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || "").toLowerCase();
  const own = (el) => (label(el) || (el.innerText || "").toLowerCase());
  const visible = (el) => {
    try { return typeof el.checkVisibility === "function" ? el.checkVisibility({ checkVisibilityCSS: true }) : el.getClientRects().length > 0; } catch { return true; }
  };
  const hits = [];
  for (const el of document.querySelectorAll("body *")) {
    if (hits.length >= 200) break;
    if (!visible(el)) continue;
    if (!own(el).includes(query)) continue;
    // Keep the deepest match: skip if a child element also matches by its own text.
    let childMatches = false;
    for (const c of el.children) { if (own(c).includes(query)) { childMatches = true; break; } }
    if (childMatches && !label(el).includes(query)) continue;
    hits.push(el);
  }
  return hits.slice(0, 25).map((el) => {
    let ref = store.elemToRef.get(el);
    if (!ref) { ref = `e${store.counter++}`; store.elemToRef.set(el, ref); store.refToElem.set(ref, el); }
    el.setAttribute("data-antigravity-ref", ref);
    const r = el.getBoundingClientRect();
    return {
      ref,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || undefined,
      text: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 100),
      inViewport: r.bottom > 0 && r.top < innerHeight,
      bounds: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
    };
  });
};

/** Readable text: prefer the main content region over menus and footers. */
export const pageTextScript = (offset) => {
  const pick = () => {
    const body = document.body;
    if (!body) return { el: null, source: "none" };
    const bodyLen = (body.innerText || "").length;
    const candidates = [...document.querySelectorAll("main, [role='main'], article")]
      .map((el) => ({ el, len: (el.innerText || "").length }))
      .sort((a, b) => b.len - a.len);
    const best = candidates[0];
    if (best && best.len > 400 && best.len > bodyLen * 0.25) return { el: best.el, source: best.el.tagName.toLowerCase() === "article" ? "article" : "main" };
    return { el: body, source: "body" };
  };
  const { el, source } = pick();
  const raw = el ? el.innerText || "" : "";
  const full = raw.replace(/\n{3,}/g, "\n\n").trim();
  const off = Math.max(0, offset || 0);
  const chunk = full.slice(off, off + 8000);
  return {
    url: location.href,
    title: document.title,
    source,
    text: chunk,
    offset: off,
    total: full.length,
    truncated: off + 8000 < full.length,
    nextOffset: off + 8000 < full.length ? off + 8000 : null,
  };
};

/** Resolve a ref for a click: scroll it into view, check what is on top, return its center and name. */
export const resolveClickScript = async (ref) => {
  const win = window;
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`) || (win.__antigravityRefs && win.__antigravityRefs.refToElem.get(ref));
  if (!el) return { error: `Element with ref '${ref}' not found. Call read_page or find again: refs change when the page changes.` };
  el.scrollIntoView({ block: "center", inline: "center" });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const hitEl = document.elementFromPoint(cx, cy);
  if (!hitEl) return { error: "The element is outside the visible area." };
  if (hitEl !== el && !el.contains(hitEl) && !hitEl.contains(el)) {
    const cls = typeof hitEl.className === "string" ? hitEl.className.slice(0, 60) : "";
    return { error: `The element is covered by <${hitEl.tagName.toLowerCase()} class="${cls}">. Close the popup or scroll first.` };
  }
  return { x: cx, y: cy, name, tag: el.tagName.toLowerCase() };
};

/** Center of a ref (hover, scroll on an element). */
export const refCenterScript = (ref) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
};

/**
 * Scroll probe. Finds the element that really scrolls under a point (many apps scroll an inner
 * container, not the window) and reports its position. With delta it also scrolls it directly,
 * which is the fallback when the page ignores wheel events.
 */
export const scrollProbeScript = (x, y, axis, delta) => {
  const vertical = axis !== "x";
  const canScroll = (el) => {
    if (!el || el === document.documentElement || el === document.body) return false;
    const cs = getComputedStyle(el);
    const ov = vertical ? cs.overflowY : cs.overflowX;
    if (!/(auto|scroll|overlay)/.test(ov)) return false;
    return vertical ? el.scrollHeight > el.clientHeight + 2 : el.scrollWidth > el.clientWidth + 2;
  };
  let el = document.elementFromPoint(x, y);
  while (el && !canScroll(el)) el = el.parentElement;
  const page = document.scrollingElement || document.documentElement;
  const pageScrolls = vertical ? page.scrollHeight > innerHeight + 2 : page.scrollWidth > innerWidth + 2;
  let target = el;
  if (!target) {
    if (pageScrolls) target = page;
    else {
      // The window does not scroll: use the largest scrollable element on the page.
      let best = null;
      let bestArea = 0;
      for (const c of document.querySelectorAll("body *")) {
        if (!canScroll(c)) continue;
        const r = c.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea) { best = c; bestArea = area; }
      }
      target = best || page;
    }
  }
  if (delta) {
    if (vertical) target.scrollBy({ top: delta, behavior: "instant" });
    else target.scrollBy({ left: delta, behavior: "instant" });
  }
  const isPage = target === page;
  const pos = vertical ? target.scrollTop : target.scrollLeft;
  const max = vertical ? target.scrollHeight - target.clientHeight : target.scrollWidth - target.clientWidth;
  let desc = "page";
  if (!isPage) {
    desc = target.tagName.toLowerCase();
    if (target.id) desc += `#${target.id}`;
    else if (typeof target.className === "string" && target.className.trim()) desc += "." + target.className.trim().split(/\s+/)[0];
  }
  return { container: desc, position: Math.round(pos), max: Math.max(0, Math.round(max)), viewport: { width: innerWidth, height: innerHeight } };
};

export const scrollToRefScript = (ref) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
};

export const describeRefScript = (ref) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) {
    return {
      found: false,
      name: "",
      role: "",
      tag: "",
      type: "",
      href: "",
      isSubmit: false,
      isSensitiveField: false,
      inForm: false,
      formSubmitName: "",
      formHasSensitive: false,
    };
  }
  let name = "";
  const ariaLabel = (el.getAttribute("aria-label") || "").trim();
  if (ariaLabel) {
    name = ariaLabel;
  } else {
    const labelledBy = (el.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/).filter(Boolean);
      const text = ids
        .map((id) => (document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) name = text;
    }
  }
  if (!name) {
    const it = (el.innerText || el.textContent || "").trim();
    if (it) name = it.slice(0, 80);
  }
  const tag = (el.tagName || "").toLowerCase();
  const attrType = (el.getAttribute("type") || "").toLowerCase();
  const domType = (el.type || "").toLowerCase();
  if (!name && (tag === "button" || tag === "input") && el.value && String(el.value).trim()) {
    name = String(el.value).trim();
  }
  if (!name) {
    const title = (el.getAttribute("title") || "").trim();
    if (title) name = title;
  }
  if (!name) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    if (ph) name = ph;
  }
  if (!name) {
    const alt = (el.getAttribute("alt") || "").trim();
    if (alt) name = alt;
  }

  const role = (el.getAttribute("role") || "").toLowerCase();
  const type = attrType || domType || "";
  const href = el.getAttribute("href") || el.href || "";

  const form = el.closest ? el.closest("form") : null;
  const inForm = Boolean(form);
  let isSubmit = false;
  if (tag === "button") {
    if (attrType === "submit") isSubmit = true;
    else if (!attrType && inForm) isSubmit = true;
    else if (domType === "submit" && (inForm || attrType === "submit")) isSubmit = true;
  } else if (tag === "input") {
    if (domType === "submit" || domType === "image" || attrType === "submit" || attrType === "image") isSubmit = true;
  } else if (role === "button") {
    if (inForm && (attrType === "submit" || domType === "submit")) isSubmit = true;
  }

  function checkSensitive(target) {
    if (!target) return false;
    const dType = (target.type || "").toLowerCase();
    const aType = (target.getAttribute("type") || "").toLowerCase();
    if (dType === "password" || aType === "password") {
      return true;
    }
    const auto = (target.getAttribute("autocomplete") || "").toLowerCase().trim();
    const sensitiveAutos = [
      "cc-number",
      "cc-csc",
      "cc-exp",
      "cc-exp-month",
      "cc-exp-year",
      "cc-name",
      "one-time-code",
      "new-password",
      "current-password",
    ];
    const autoTokens = auto.split(/\s+/);
    if (sensitiveAutos.some((v) => autoTokens.includes(v) || auto.includes(v))) {
      return true;
    }
    const elName = (target.getAttribute("name") || "").toLowerCase();
    const elId = (target.id || target.getAttribute("id") || "").toLowerCase();
    const elPh = (target.getAttribute("placeholder") || "").toLowerCase();
    const textFields = `${elName} ${elId} ${elPh}`;
    const normText = textFields.replace(/[-_]/g, " ").toLowerCase();
    const englishMatch =
      /\b(card\s*number|cvv|cvc|security\s*code|iban|otp|pin\s*code)\b/i.test(normText) ||
      /cardnumber|pincode|securitycode/i.test(textFields);
    if (englishMatch) {
      return true;
    }
    const arNorm = textFields
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه");
    const arabicMatch =
      arNorm.includes("كلمه المرور") ||
      arNorm.includes("كلمه السر") ||
      arNorm.includes("باسورد") ||
      arNorm.includes("باسوورد") ||
      arNorm.includes("رقم البطاقه") ||
      arNorm.includes("رقم الكارت") ||
      arNorm.includes("الرقم السري") ||
      arNorm.includes("رمز الامان");
    return Boolean(arabicMatch);
  }

  const isSensitiveField = checkSensitive(el);

  let formSubmitName = "";
  let formHasSensitive = false;

  if (form) {
    const fields = form.querySelectorAll("input, select, textarea");
    for (const f of fields) {
      if (checkSensitive(f)) {
        formHasSensitive = true;
        break;
      }
    }

    const candidates = form.querySelectorAll("button, input, [role='button']");
    for (const btn of candidates) {
      const bTag = (btn.tagName || "").toLowerCase();
      const bAttrType = (btn.getAttribute("type") || "").toLowerCase();
      const bDomType = (btn.type || "").toLowerCase();
      const bRole = (btn.getAttribute("role") || "").toLowerCase();
      let isSub = false;
      if (bTag === "button") {
        if (bAttrType === "submit") isSub = true;
        else if (!bAttrType && bDomType !== "button" && bDomType !== "reset") isSub = true;
        else if (bDomType === "submit") isSub = true;
      } else if (bTag === "input") {
        if (bDomType === "submit" || bDomType === "image" || bAttrType === "submit" || bAttrType === "image") isSub = true;
      } else if (bRole === "button") {
        if (bAttrType === "submit" || bDomType === "submit") isSub = true;
      }
      if (isSub) {
        let bName = "";
        const bAria = (btn.getAttribute("aria-label") || "").trim();
        if (bAria) {
          bName = bAria;
        } else {
          const bLabelled = (btn.getAttribute("aria-labelledby") || "").trim();
          if (bLabelled) {
            const ids = bLabelled.split(/\s+/).filter(Boolean);
            const bDoc = btn.ownerDocument || document;
            const text = ids
              .map((id) => (bDoc.getElementById(id)?.innerText || bDoc.getElementById(id)?.textContent || "").trim())
              .filter(Boolean)
              .join(" ")
              .trim();
            if (text) bName = text;
          }
        }
        if (!bName) {
          const it = (btn.innerText || btn.textContent || "").trim();
          if (it) bName = it.slice(0, 80);
        }
        if (!bName && (bTag === "button" || bTag === "input") && btn.value && String(btn.value).trim()) {
          bName = String(btn.value).trim();
        }
        if (!bName) {
          const title = (btn.getAttribute("title") || "").trim();
          if (title) bName = title;
        }
        if (!bName) {
          const ph = (btn.getAttribute("placeholder") || "").trim();
          if (ph) bName = ph;
        }
        if (!bName) {
          const alt = (btn.getAttribute("alt") || "").trim();
          if (alt) bName = alt;
        }
        formSubmitName = (bName || "").slice(0, 80);
        break;
      }
    }
  }

  return {
    found: true,
    name,
    role,
    tag,
    type,
    href,
    isSubmit,
    isSensitiveField,
    inForm,
    formSubmitName,
    formHasSensitive,
  };
};

// Same description as describeRefScript, for the element under a viewport coordinate (click and hover by x,y).
export const describePointScript = (x, y) => {
  const el = document.elementFromPoint(x, y);
  if (!el) {
    return {
      found: false,
      name: "",
      role: "",
      tag: "",
      type: "",
      href: "",
      isSubmit: false,
      isSensitiveField: false,
      inForm: false,
      formSubmitName: "",
      formHasSensitive: false,
    };
  }
  let name = "";
  const ariaLabel = (el.getAttribute("aria-label") || "").trim();
  if (ariaLabel) {
    name = ariaLabel;
  } else {
    const labelledBy = (el.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/).filter(Boolean);
      const text = ids
        .map((id) => (document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) name = text;
    }
  }
  if (!name) {
    const it = (el.innerText || el.textContent || "").trim();
    if (it) name = it.slice(0, 80);
  }
  const tag = (el.tagName || "").toLowerCase();
  const attrType = (el.getAttribute("type") || "").toLowerCase();
  const domType = (el.type || "").toLowerCase();
  if (!name && (tag === "button" || tag === "input") && el.value && String(el.value).trim()) {
    name = String(el.value).trim();
  }
  if (!name) {
    const title = (el.getAttribute("title") || "").trim();
    if (title) name = title;
  }
  if (!name) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    if (ph) name = ph;
  }
  if (!name) {
    const alt = (el.getAttribute("alt") || "").trim();
    if (alt) name = alt;
  }

  const role = (el.getAttribute("role") || "").toLowerCase();
  const type = attrType || domType || "";
  const href = el.getAttribute("href") || el.href || "";

  const form = el.closest ? el.closest("form") : null;
  const inForm = Boolean(form);
  let isSubmit = false;
  if (tag === "button") {
    if (attrType === "submit") isSubmit = true;
    else if (!attrType && inForm) isSubmit = true;
    else if (domType === "submit" && (inForm || attrType === "submit")) isSubmit = true;
  } else if (tag === "input") {
    if (domType === "submit" || domType === "image" || attrType === "submit" || attrType === "image") isSubmit = true;
  } else if (role === "button") {
    if (inForm && (attrType === "submit" || domType === "submit")) isSubmit = true;
  }

  function checkSensitive(target) {
    if (!target) return false;
    const dType = (target.type || "").toLowerCase();
    const aType = (target.getAttribute("type") || "").toLowerCase();
    if (dType === "password" || aType === "password") {
      return true;
    }
    const auto = (target.getAttribute("autocomplete") || "").toLowerCase().trim();
    const sensitiveAutos = [
      "cc-number",
      "cc-csc",
      "cc-exp",
      "cc-exp-month",
      "cc-exp-year",
      "cc-name",
      "one-time-code",
      "new-password",
      "current-password",
    ];
    const autoTokens = auto.split(/\s+/);
    if (sensitiveAutos.some((v) => autoTokens.includes(v) || auto.includes(v))) {
      return true;
    }
    const elName = (target.getAttribute("name") || "").toLowerCase();
    const elId = (target.id || target.getAttribute("id") || "").toLowerCase();
    const elPh = (target.getAttribute("placeholder") || "").toLowerCase();
    const textFields = `${elName} ${elId} ${elPh}`;
    const normText = textFields.replace(/[-_]/g, " ").toLowerCase();
    const englishMatch =
      /\b(card\s*number|cvv|cvc|security\s*code|iban|otp|pin\s*code)\b/i.test(normText) ||
      /cardnumber|pincode|securitycode/i.test(textFields);
    if (englishMatch) {
      return true;
    }
    const arNorm = textFields
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه");
    const arabicMatch =
      arNorm.includes("كلمه المرور") ||
      arNorm.includes("كلمه السر") ||
      arNorm.includes("باسورد") ||
      arNorm.includes("باسوورد") ||
      arNorm.includes("رقم البطاقه") ||
      arNorm.includes("رقم الكارت") ||
      arNorm.includes("الرقم السري") ||
      arNorm.includes("رمز الامان");
    return Boolean(arabicMatch);
  }

  const isSensitiveField = checkSensitive(el);

  let formSubmitName = "";
  let formHasSensitive = false;

  if (form) {
    const fields = form.querySelectorAll("input, select, textarea");
    for (const f of fields) {
      if (checkSensitive(f)) {
        formHasSensitive = true;
        break;
      }
    }

    const candidates = form.querySelectorAll("button, input, [role='button']");
    for (const btn of candidates) {
      const bTag = (btn.tagName || "").toLowerCase();
      const bAttrType = (btn.getAttribute("type") || "").toLowerCase();
      const bDomType = (btn.type || "").toLowerCase();
      const bRole = (btn.getAttribute("role") || "").toLowerCase();
      let isSub = false;
      if (bTag === "button") {
        if (bAttrType === "submit") isSub = true;
        else if (!bAttrType && bDomType !== "button" && bDomType !== "reset") isSub = true;
        else if (bDomType === "submit") isSub = true;
      } else if (bTag === "input") {
        if (bDomType === "submit" || bDomType === "image" || bAttrType === "submit" || bAttrType === "image") isSub = true;
      } else if (bRole === "button") {
        if (bAttrType === "submit" || bDomType === "submit") isSub = true;
      }
      if (isSub) {
        let bName = "";
        const bAria = (btn.getAttribute("aria-label") || "").trim();
        if (bAria) {
          bName = bAria;
        } else {
          const bLabelled = (btn.getAttribute("aria-labelledby") || "").trim();
          if (bLabelled) {
            const ids = bLabelled.split(/\s+/).filter(Boolean);
            const bDoc = btn.ownerDocument || document;
            const text = ids
              .map((id) => (bDoc.getElementById(id)?.innerText || bDoc.getElementById(id)?.textContent || "").trim())
              .filter(Boolean)
              .join(" ")
              .trim();
            if (text) bName = text;
          }
        }
        if (!bName) {
          const it = (btn.innerText || btn.textContent || "").trim();
          if (it) bName = it.slice(0, 80);
        }
        if (!bName && (bTag === "button" || bTag === "input") && btn.value && String(btn.value).trim()) {
          bName = String(btn.value).trim();
        }
        if (!bName) {
          const title = (btn.getAttribute("title") || "").trim();
          if (title) bName = title;
        }
        if (!bName) {
          const ph = (btn.getAttribute("placeholder") || "").trim();
          if (ph) bName = ph;
        }
        if (!bName) {
          const alt = (btn.getAttribute("alt") || "").trim();
          if (alt) bName = alt;
        }
        formSubmitName = (bName || "").slice(0, 80);
        break;
      }
    }
  }

  return {
    found: true,
    name,
    role,
    tag,
    type,
    href,
    isSubmit,
    isSensitiveField,
    inForm,
    formSubmitName,
    formHasSensitive,
  };
};

export const activeElementScript = () => {
  let el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return {
      found: false,
      name: "",
      role: "",
      tag: "",
      type: "",
      href: "",
      isSubmit: false,
      isSensitiveField: false,
      inForm: false,
      formSubmitName: "",
      formHasSensitive: false,
    };
  }

  let depth = 0;
  while (depth < 4) {
    const t = (el.tagName || "").toLowerCase();
    if (t !== "iframe" && t !== "frame") {
      break;
    }
    let nextDoc = null;
    try {
      nextDoc = el.contentDocument;
    } catch {
      return {
        found: true,
        name: "embedded frame",
        role: "",
        tag: "iframe",
        type: "",
        href: "",
        isSubmit: false,
        isSensitiveField: false,
        inForm: false,
        formSubmitName: "",
        formHasSensitive: false,
        uninspectable: true,
      };
    }
    if (!nextDoc) {
      return {
        found: true,
        name: "embedded frame",
        role: "",
        tag: "iframe",
        type: "",
        href: "",
        isSubmit: false,
        isSensitiveField: false,
        inForm: false,
        formSubmitName: "",
        formHasSensitive: false,
        uninspectable: true,
      };
    }
    const innerActive = nextDoc.activeElement;
    if (!innerActive || innerActive === nextDoc.body || innerActive === nextDoc.documentElement) {
      el = innerActive || nextDoc.documentElement;
      break;
    }
    el = innerActive;
    depth++;
  }

  const finalTag = (el.tagName || "").toLowerCase();
  if (finalTag === "iframe" || finalTag === "frame") {
    return {
      found: true,
      name: "embedded frame",
      role: "",
      tag: "iframe",
      type: "",
      href: "",
      isSubmit: false,
      isSensitiveField: false,
      inForm: false,
      formSubmitName: "",
      formHasSensitive: false,
      uninspectable: true,
    };
  }

  const doc = el.ownerDocument || document;
  if (!el || el === doc.body || el === doc.documentElement) {
    return {
      found: false,
      name: "",
      role: "",
      tag: "",
      type: "",
      href: "",
      isSubmit: false,
      isSensitiveField: false,
      inForm: false,
      formSubmitName: "",
      formHasSensitive: false,
    };
  }

  let name = "";
  const ariaLabel = (el.getAttribute("aria-label") || "").trim();
  if (ariaLabel) {
    name = ariaLabel;
  } else {
    const labelledBy = (el.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/).filter(Boolean);
      const text = ids
        .map((id) => (doc.getElementById(id)?.innerText || doc.getElementById(id)?.textContent || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) name = text;
    }
  }
  if (!name) {
    const it = (el.innerText || el.textContent || "").trim();
    if (it) name = it.slice(0, 80);
  }
  const tag = (el.tagName || "").toLowerCase();
  const attrType = (el.getAttribute("type") || "").toLowerCase();
  const domType = (el.type || "").toLowerCase();
  if (!name && (tag === "button" || tag === "input") && el.value && String(el.value).trim()) {
    name = String(el.value).trim();
  }
  if (!name) {
    const title = (el.getAttribute("title") || "").trim();
    if (title) name = title;
  }
  if (!name) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    if (ph) name = ph;
  }
  if (!name) {
    const alt = (el.getAttribute("alt") || "").trim();
    if (alt) name = alt;
  }

  const role = (el.getAttribute("role") || "").toLowerCase();
  const type = attrType || domType || "";
  const href = el.getAttribute("href") || el.href || "";

  const form = el.closest ? el.closest("form") : null;
  const inForm = Boolean(form);
  let isSubmit = false;
  if (tag === "button") {
    if (attrType === "submit") isSubmit = true;
    else if (!attrType && inForm) isSubmit = true;
    else if (domType === "submit" && (inForm || attrType === "submit")) isSubmit = true;
  } else if (tag === "input") {
    if (domType === "submit" || domType === "image" || attrType === "submit" || attrType === "image") isSubmit = true;
  } else if (role === "button") {
    if (inForm && (attrType === "submit" || domType === "submit")) isSubmit = true;
  }

  function checkSensitive(target) {
    if (!target) return false;
    const dType = (target.type || "").toLowerCase();
    const aType = (target.getAttribute("type") || "").toLowerCase();
    if (dType === "password" || aType === "password") {
      return true;
    }
    const auto = (target.getAttribute("autocomplete") || "").toLowerCase().trim();
    const sensitiveAutos = [
      "cc-number",
      "cc-csc",
      "cc-exp",
      "cc-exp-month",
      "cc-exp-year",
      "cc-name",
      "one-time-code",
      "new-password",
      "current-password",
    ];
    const autoTokens = auto.split(/\s+/);
    if (sensitiveAutos.some((v) => autoTokens.includes(v) || auto.includes(v))) {
      return true;
    }
    const elName = (target.getAttribute("name") || "").toLowerCase();
    const elId = (target.id || target.getAttribute("id") || "").toLowerCase();
    const elPh = (target.getAttribute("placeholder") || "").toLowerCase();
    const textFields = `${elName} ${elId} ${elPh}`;
    const normText = textFields.replace(/[-_]/g, " ").toLowerCase();
    const englishMatch =
      /\b(card\s*number|cvv|cvc|security\s*code|iban|otp|pin\s*code)\b/i.test(normText) ||
      /cardnumber|pincode|securitycode/i.test(textFields);
    if (englishMatch) {
      return true;
    }
    const arNorm = textFields
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه");
    const arabicMatch =
      arNorm.includes("كلمه المرور") ||
      arNorm.includes("كلمه السر") ||
      arNorm.includes("باسورد") ||
      arNorm.includes("باسوورد") ||
      arNorm.includes("رقم البطاقه") ||
      arNorm.includes("رقم الكارت") ||
      arNorm.includes("الرقم السري") ||
      arNorm.includes("رمز الامان");
    return Boolean(arabicMatch);
  }

  const isSensitiveField = checkSensitive(el);

  let formSubmitName = "";
  let formHasSensitive = false;

  if (form) {
    const fields = form.querySelectorAll("input, select, textarea");
    for (const f of fields) {
      if (checkSensitive(f)) {
        formHasSensitive = true;
        break;
      }
    }

    const candidates = form.querySelectorAll("button, input, [role='button']");
    for (const btn of candidates) {
      const bTag = (btn.tagName || "").toLowerCase();
      const bAttrType = (btn.getAttribute("type") || "").toLowerCase();
      const bDomType = (btn.type || "").toLowerCase();
      const bRole = (btn.getAttribute("role") || "").toLowerCase();
      let isSub = false;
      if (bTag === "button") {
        if (bAttrType === "submit") isSub = true;
        else if (!bAttrType && bDomType !== "button" && bDomType !== "reset") isSub = true;
        else if (bDomType === "submit") isSub = true;
      } else if (bTag === "input") {
        if (bDomType === "submit" || bDomType === "image" || bAttrType === "submit" || bAttrType === "image") isSub = true;
      } else if (bRole === "button") {
        if (bAttrType === "submit" || bDomType === "submit") isSub = true;
      }
      if (isSub) {
        let bName = "";
        const bAria = (btn.getAttribute("aria-label") || "").trim();
        if (bAria) {
          bName = bAria;
        } else {
          const bLabelled = (btn.getAttribute("aria-labelledby") || "").trim();
          if (bLabelled) {
            const ids = bLabelled.split(/\s+/).filter(Boolean);
            const bDoc = btn.ownerDocument || document;
            const text = ids
              .map((id) => (bDoc.getElementById(id)?.innerText || bDoc.getElementById(id)?.textContent || "").trim())
              .filter(Boolean)
              .join(" ")
              .trim();
            if (text) bName = text;
          }
        }
        if (!bName) {
          const it = (btn.innerText || btn.textContent || "").trim();
          if (it) bName = it.slice(0, 80);
        }
        if (!bName && (bTag === "button" || bTag === "input") && btn.value && String(btn.value).trim()) {
          bName = String(btn.value).trim();
        }
        if (!bName) {
          const title = (btn.getAttribute("title") || "").trim();
          if (title) bName = title;
        }
        if (!bName) {
          const ph = (btn.getAttribute("placeholder") || "").trim();
          if (ph) bName = ph;
        }
        if (!bName) {
          const alt = (btn.getAttribute("alt") || "").trim();
          if (alt) bName = alt;
        }
        formSubmitName = (bName || "").slice(0, 80);
        break;
      }
    }
  }

  return {
    found: true,
    name,
    role,
    tag,
    type,
    href,
    isSubmit,
    isSensitiveField,
    inForm,
    formSubmitName,
    formHasSensitive,
  };
};

export const typeSafetyScript = (ref) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) return { found: false };
  el.focus();
  let name = "";
  const ariaLabel = (el.getAttribute("aria-label") || "").trim();
  if (ariaLabel) {
    name = ariaLabel;
  } else {
    const labelledBy = (el.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/).filter(Boolean);
      const text = ids
        .map((id) => (document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) name = text;
    }
  }
  if (!name) {
    const it = (el.innerText || el.textContent || "").trim();
    if (it) name = it.slice(0, 80);
  }
  const tag = (el.tagName || "").toLowerCase();
  const attrType = (el.getAttribute("type") || "").toLowerCase();
  const domType = (el.type || "").toLowerCase();
  if (!name && (tag === "button" || tag === "input") && el.value && String(el.value).trim()) {
    name = String(el.value).trim();
  }
  if (!name) {
    const title = (el.getAttribute("title") || "").trim();
    if (title) name = title;
  }
  if (!name) {
    const ph = (el.getAttribute("placeholder") || "").trim();
    if (ph) name = ph;
  }
  if (!name) {
    const alt = (el.getAttribute("alt") || "").trim();
    if (alt) name = alt;
  }

  let isSensitive = false;
  if (domType === "password" || attrType === "password") {
    isSensitive = true;
  } else {
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase().trim();
    const sensitiveAutos = [
      "cc-number",
      "cc-csc",
      "cc-exp",
      "cc-exp-month",
      "cc-exp-year",
      "cc-name",
      "one-time-code",
      "new-password",
      "current-password",
    ];
    const autoTokens = auto.split(/\s+/);
    if (sensitiveAutos.some((v) => autoTokens.includes(v) || auto.includes(v))) {
      isSensitive = true;
    } else {
      const elName = (el.getAttribute("name") || "").toLowerCase();
      const elId = (el.id || el.getAttribute("id") || "").toLowerCase();
      const elPh = (el.getAttribute("placeholder") || "").toLowerCase();
      const textFields = `${elName} ${elId} ${elPh}`;
      const normText = textFields.replace(/[-_]/g, " ").toLowerCase();
      const englishMatch =
        /\b(card\s*number|cvv|cvc|security\s*code|iban|otp|pin\s*code)\b/i.test(normText) ||
        /cardnumber|pincode|securitycode/i.test(textFields);
      if (englishMatch) {
        isSensitive = true;
      } else {
        const arNorm = textFields
          .replace(/[\u064B-\u065F]/g, "")
          .replace(/[إأآ]/g, "ا")
          .replace(/ة/g, "ه");
        const arabicMatch =
          arNorm.includes("كلمه المرور") ||
          arNorm.includes("كلمه السر") ||
          arNorm.includes("باسورد") ||
          arNorm.includes("باسوورد") ||
          arNorm.includes("رقم البطاقه") ||
          arNorm.includes("رقم الكارت") ||
          arNorm.includes("الرقم السري") ||
          arNorm.includes("رمز الامان");
        if (arabicMatch) {
          isSensitive = true;
        }
      }
    }
  }

  return { found: true, isSensitive, name };
};

export const formInputScript = (ref, val) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) return false;
  if (el.type === "checkbox" || el.type === "radio") el.checked = Boolean(val);
  else {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, String(val));
    else el.value = String(val);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

export const selectorExistsScript = (sel) => Boolean(document.querySelector(sel));
