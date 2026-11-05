const IDLE_SECONDS = 60;
const LOG_KEY = "activityLog";
const SETTINGS_KEY = "settings";
const SESSION_STARTED_AT = Date.now();

const DEFAULT_SETTINGS = {
  // Edit these in the dashboard. A specific domain wins over the generic defaults.
  rules: {
    productive: ["docs.google.com", "notion.so", "github.com", "stackoverflow.com", "developer.mozilla.org"],
    distracting: ["youtube.com", "netflix.com", "instagram.com", "facebook.com", "reddit.com", "x.com", "twitter.com", "tiktok.com"],
    neutral: ["google.com", "wikipedia.org"]
  },
  limits: {},
  theme: "system"
};

let active = null;
let browserFocused = true;
let idle = false;

function domainFor(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
}

function categoryFor(domain, settings) {
  for (const category of ["productive", "distracting", "neutral"]) {
    if ((settings.rules[category] || []).some(rule => domain === rule || domain.endsWith(`.${rule}`))) return category;
  }
  return "neutral";
}

async function settings() {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const saved = stored[SETTINGS_KEY] || {};
  return { ...DEFAULT_SETTINGS, ...saved, rules: { ...DEFAULT_SETTINGS.rules, ...(saved.rules || {}) }, limits: saved.limits || {} };
}

function eligible(tab) {
  return browserFocused && !idle && tab && tab.url && /^https?:/.test(tab.url) && !tab.incognito;
}

async function closeActive() {
  if (!active) return;
  const end = Date.now();
  const durationMs = end - active.startedAt;
  if (durationMs >= 1000) {
    const stored = await browser.storage.local.get(LOG_KEY);
    const log = stored[LOG_KEY] || [];
    log.push({ ...active, endedAt: end, durationMs });
    // Keep at most two weeks; logs contain only domain/title/category/timestamps, never page content.
    const cutoff = end - 14 * 24 * 60 * 60 * 1000;
    await browser.storage.local.set({ [LOG_KEY]: log.filter(item => item.endedAt >= cutoff) });
    await checkLimit(active.domain, durationMs);
  }
  active = null;
}

function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date.getTime(); }
async function checkLimit(domain, addedMs) {
  const cfg = await settings();
  const limitMinutes = Number(cfg.limits[domain] || 0);
  if (!limitMinutes) return;
  const stored = await browser.storage.local.get(LOG_KEY);
  const spent = (stored[LOG_KEY] || []).filter(item => item.domain === domain && item.endedAt >= startOfToday()).reduce((sum, item) => sum + item.durationMs, 0);
  const limitMs = limitMinutes * 60000;
  if (spent >= limitMs && spent - addedMs < limitMs) {
    await browser.notifications.create(`limit:${domain}`, {
      type: "basic", iconUrl: "icon.svg", title: "Daily limit reached", message: `${domain} reached its ${limitMinutes}-minute limit.`, buttons: [{ title: "Add 15 minutes" }, { title: "Remove limit" }]
    });
  }
}

browser.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith("limit:")) return;
  const domain = notificationId.slice(6), cfg = await settings();
  if (buttonIndex === 0) cfg.limits[domain] = Number(cfg.limits[domain] || 0) + 15;
  if (buttonIndex === 1) delete cfg.limits[domain];
  await browser.storage.local.set({ [SETTINGS_KEY]: cfg });
  await browser.notifications.clear(notificationId);
});

async function startFor(tab) {
  await closeActive();
  if (!eligible(tab)) return;
  const cfg = await settings();
  const domain = domainFor(tab.url);
  if (!domain) return;
  active = { startedAt: Date.now(), domain, title: (tab.title || "").slice(0, 160), category: categoryFor(domain, cfg) };
}

async function refreshActiveTab() {
  if (!browserFocused || idle) return closeActive();
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  await startFor(tab);
}

browser.tabs.onActivated.addListener(() => refreshActiveTab());
browser.tabs.onUpdated.addListener((tabId, changes, tab) => {
  if (tab.active && (changes.url || changes.title || changes.status === "complete")) refreshActiveTab();
});
browser.windows.onFocusChanged.addListener(windowId => {
  browserFocused = windowId !== browser.windows.WINDOW_ID_NONE;
  refreshActiveTab();
});
browser.idle.setDetectionInterval(IDLE_SECONDS);
browser.idle.onStateChanged.addListener(state => {
  idle = state !== "active";
  refreshActiveTab();
});
browser.runtime.onStartup.addListener(refreshActiveTab);
browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) await browser.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  refreshActiveTab();
});

browser.runtime.onMessage.addListener(async message => {
  if (message.type === "getLog") {
    const stored = await browser.storage.local.get([LOG_KEY, SETTINGS_KEY]);
    const current = active ? [{ ...active, endedAt: Date.now(), durationMs: Date.now() - active.startedAt }] : [];
    return { log: [...(stored[LOG_KEY] || []), ...current], settings: await settings(), sessionStartedAt: SESSION_STARTED_AT };
  }
  if (message.type === "saveSettings") {
    await browser.storage.local.set({ [SETTINGS_KEY]: message.settings });
    await refreshActiveTab();
  }
  if (message.type === "setCurrentCategory") {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const domain = domainFor(tab && tab.url);
    if (!domain) return { error: "This page cannot be classified." };
    const cfg = await settings();
    for (const category of ["productive", "distracting", "neutral"]) cfg.rules[category] = (cfg.rules[category] || []).filter(rule => rule !== domain);
    cfg.rules[message.category].push(domain);
    await browser.storage.local.set({ [SETTINGS_KEY]: cfg });
    await refreshActiveTab();
    return { domain, category: message.category };
  }
  if (message.type === "getCurrentSite") {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const domain = domainFor(tab && tab.url);
    if (!domain) return { error: "This page cannot be tracked." };
    const cfg = await settings(), stored = await browser.storage.local.get(LOG_KEY);
    const savedToday = (stored[LOG_KEY] || []).filter(item => item.domain === domain && item.endedAt >= startOfToday()).reduce((sum, item) => sum + item.durationMs, 0);
    const activeToday = active && active.domain === domain ? Date.now() - active.startedAt : 0;
    return { domain, category: categoryFor(domain, cfg), limitMinutes: Number(cfg.limits[domain] || 0), spentMs: savedToday + activeToday };
  }
  if (message.type === "setCurrentSiteLimit") {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const domain = domainFor(tab && tab.url);
    if (!domain) return { error: "This page cannot be tracked." };
    const cfg = await settings(), minutes = Number(message.minutes || 0);
    if (minutes > 0) cfg.limits[domain] = Math.min(minutes, 1440); else delete cfg.limits[domain];
    await browser.storage.local.set({ [SETTINGS_KEY]: cfg });
    return { domain, limitMinutes: Number(cfg.limits[domain] || 0) };
  }
  if (message.type === "clearLog") await browser.storage.local.set({ [LOG_KEY]: [] });
});
