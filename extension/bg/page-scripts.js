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

export const typeSafetyScript = (ref) => {
  const el = document.querySelector(`[data-antigravity-ref="${ref}"]`);
  if (!el) return { found: false };
  el.focus();
  const isPassword = el.type === "password";
  const auto = (el.getAttribute("autocomplete") || "").toLowerCase();
  const isCreditCard = auto.startsWith("cc-");
  const name = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "").slice(0, 60);
  return { found: true, isSensitive: isPassword || isCreditCard, name };
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
