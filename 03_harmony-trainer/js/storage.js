const HISTORY_KEY = "hamolab-history-v1";
const SETTINGS_KEY = "hamolab-settings-v1";

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? []; } catch (_) { return []; }
}

export function saveSession(session) {
  const history = loadHistory();
  history.unshift({ id: crypto.randomUUID?.() ?? String(Date.now()), date: new Date().toISOString(), ...session });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

export function getHistorySummary(history = loadHistory()) {
  const recent = history.slice(0, 10);
  if (!recent.length) return { average: null, best: null, pulled: 0 };
  return {
    average: Math.round(recent.reduce((sum, item) => sum + item.score, 0) / recent.length),
    best: Math.max(...history.map((item) => item.score)),
    pulled: recent.reduce((sum, item) => sum + (item.pulled ?? 0), 0)
  };
}

export function loadSettings() {
  try { return { noteNames: "both", range: "mid", ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch (_) { return { noteNames: "both", range: "mid" }; }
}

export function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
