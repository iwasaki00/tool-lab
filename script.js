"use strict";

const STORAGE_KEY = "ticket-simulator-settings-v2";
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const PATTERNS = [
  { id: "RTT", label: "往復乗車券", months: 0, days: 1, useId: "use-rtt", fareId: "fare-one-way" },
  { id: "CMT1M", label: "1ヶ月定期券", months: 1, days: 0, useId: "use-cmt1m", fareId: "fare-cmt1m" },
  { id: "CMT3M", label: "3ヶ月定期券", months: 3, days: 0, useId: "use-cmt3m", fareId: "fare-cmt3m" },
  { id: "CMT6M", label: "6ヶ月定期券", months: 6, days: 0, useId: "use-cmt6m", fareId: "fare-cmt6m" }
];

const HOLIDAYS = {
  "2026-01-01": "元日", "2026-01-12": "成人の日", "2026-02-11": "建国記念の日", "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日", "2026-04-29": "昭和の日", "2026-05-03": "憲法記念日", "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日", "2026-05-06": "振替休日", "2026-07-20": "海の日", "2026-08-11": "山の日",
  "2026-09-21": "敬老の日", "2026-09-22": "国民の休日", "2026-09-23": "秋分の日", "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日", "2026-11-23": "勤労感謝の日",
  "2027-01-01": "元日", "2027-01-11": "成人の日", "2027-02-11": "建国記念の日", "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日", "2027-03-22": "振替休日", "2027-04-29": "昭和の日", "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日", "2027-05-05": "こどもの日", "2027-07-19": "海の日", "2027-08-11": "山の日",
  "2027-09-20": "敬老の日", "2027-09-23": "秋分の日", "2027-10-11": "スポーツの日", "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日"
};

let dateNodes = [];
let exclusionPeriods = [];
let lastResult = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindNavigation();
  setDefaultDates();
  loadSettings();
  bindEvents();
  generateDateList();
  renderExclusionPeriods();
  renderRoute();
}

function bindNavigation() {
  window.addEventListener("hashchange", renderRoute);
}

function renderRoute() {
  const isTicketSimulator = location.hash === "#ticket-simulator";
  const menu = document.getElementById("top-menu-screen");
  const simulator = document.getElementById("ticket-simulator-screen");
  menu.classList.toggle("is-active", !isTicketSimulator);
  simulator.classList.toggle("is-active", isTicketSimulator);
  menu.setAttribute("aria-hidden", String(isTicketSimulator));
  simulator.setAttribute("aria-hidden", String(!isTicketSimulator));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function bindEvents() {
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", handleSettingChanged);
  });
  document.getElementById("generate-dates").addEventListener("click", regenerateByCurrentConditions);
  document.getElementById("refresh-from-exclusion").addEventListener("click", regenerateByCurrentConditions);
  document.getElementById("add-exclusion").addEventListener("click", addExclusionPeriod);
  document.getElementById("simulate-button").addEventListener("click", simulate);
  document.getElementById("download-csv").addEventListener("click", downloadCsv);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
}

function handleSettingChanged(event) {
  if (event.target.classList.contains("date-enabled")) return;
  saveSettings();
  if (event.target.type === "date" || event.target.name === "weekday" || event.target.id.startsWith("exclude-")) {
    regenerateByCurrentConditions();
  }
}

function regenerateByCurrentConditions() {
  saveSettings(false);
  generateDateList({ keepOverrides: false });
}

function setDefaultDates() {
  const today = new Date();
  document.getElementById("start-date").value = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
  document.getElementById("end-date").value = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    Object.entries(settings.values || {}).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.type === "checkbox" ? element.checked = Boolean(value) : element.value = value;
    });
    document.querySelectorAll("input[name='weekday']").forEach((checkbox) => {
      checkbox.checked = settings.weekdays?.includes(Number(checkbox.value)) || false;
    });
    exclusionPeriods = Array.isArray(settings.exclusionPeriods) ? settings.exclusionPeriods : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSettings(keepDateOverrides = true) {
  const values = {};
  [
    "fare-one-way", "fare-cmt1m", "fare-cmt3m", "fare-cmt6m",
    "use-rtt", "use-cmt1m", "use-cmt3m", "use-cmt6m",
    "start-date", "end-date", "exclude-weekend", "exclude-holiday"
  ].forEach((id) => {
    const element = document.getElementById(id);
    values[id] = element.type === "checkbox" ? element.checked : element.value;
  });

  const overrides = {};
  if (keepDateOverrides) {
    dateNodes.forEach((node) => {
      if (node.enabled !== node.defaultEnabled) overrides[node.date] = node.enabled;
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    values,
    weekdays: getSelectedWeekdays(),
    exclusionPeriods,
    overrides
  }));
}

function generateDateList(options = {}) {
  const keepOverrides = options.keepOverrides !== false;
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const tbody = document.getElementById("date-list-body");

  if (!start || !end || compareDateString(start, end) > 0) {
    dateNodes = [];
    tbody.innerHTML = '<tr><td colspan="5">開始日と終了日を確認してください。</td></tr>';
    refreshDateViews();
    return;
  }

  const previousOverrides = keepOverrides ? getStoredOverrides() : {};
  const selectedWeekdays = getSelectedWeekdays();
  const excludeWeekend = document.getElementById("exclude-weekend").checked;
  const excludeHoliday = document.getElementById("exclude-holiday").checked;
  const nodes = [];

  for (let current = parseDate(start); compareDateString(formatDate(current), end) <= 0; current = addDays(current, 1)) {
    const date = formatDate(current);
    const weekday = current.getDay();
    const holidayName = getHolidayName(date);
    const exclusionReason = getExclusionReason(date);
    let enabled = selectedWeekdays.includes(weekday);

    if (excludeWeekend && (weekday === 0 || weekday === 6)) enabled = false;
    if (excludeHoliday && holidayName) enabled = false;
    if (exclusionReason) enabled = false;

    const defaultEnabled = enabled;
    if (Object.prototype.hasOwnProperty.call(previousOverrides, date)) enabled = Boolean(previousOverrides[date]);
    nodes.push({ date, weekday, holidayName, exclusionReason, enabled, defaultEnabled });
  }

  dateNodes = nodes;
  refreshDateViews();
  saveSettings();
}

function renderDateList() {
  const tbody = document.getElementById("date-list-body");
  if (dateNodes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">日付がありません。</td></tr>';
    updateDateSummary();
    return;
  }

  tbody.innerHTML = dateNodes.map((node) => `
    <tr class="${node.enabled ? "" : "is-disabled"}">
      <td data-label="有効"><input class="date-enabled" type="checkbox" data-date="${node.date}" ${node.enabled ? "checked" : ""} aria-label="${node.date}を有効にする"></td>
      <td data-label="日付">${node.date}</td>
      <td data-label="曜日">${WEEKDAY_LABELS[node.weekday]}</td>
      <td data-label="祝日名">${node.holidayName || ""}</td>
      <td data-label="除外理由">${node.exclusionReason || ""}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".date-enabled").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => toggleDateValid(event.target.dataset.date, event.target.checked));
  });
  updateDateSummary();
}

function addExclusionPeriod() {
  const start = document.getElementById("exclusion-start").value;
  const end = document.getElementById("exclusion-end").value;
  const reason = document.getElementById("exclusion-reason").value.trim();
  const error = document.getElementById("exclusion-error");
  error.textContent = "";

  if (!start || !end) {
    error.textContent = "除外期間の開始日と終了日を入力してください。";
    return;
  }
  if (compareDateString(start, end) > 0) {
    error.textContent = "除外期間の開始日は終了日以前にしてください。";
    return;
  }

  exclusionPeriods.push({ id: String(Date.now()), start, end, reason });
  document.getElementById("exclusion-start").value = "";
  document.getElementById("exclusion-end").value = "";
  document.getElementById("exclusion-reason").value = "";
  renderExclusionPeriods();
  generateDateList({ keepOverrides: false });
}

function removeExclusionPeriod(id) {
  exclusionPeriods = exclusionPeriods.filter((period) => period.id !== id);
  renderExclusionPeriods();
  generateDateList({ keepOverrides: false });
}

function isInExclusionPeriod(date) {
  return exclusionPeriods.some((period) => compareDateString(period.start, date) <= 0 && compareDateString(date, period.end) <= 0);
}

function getExclusionReason(date) {
  return exclusionPeriods
    .filter((period) => compareDateString(period.start, date) <= 0 && compareDateString(date, period.end) <= 0)
    .map((period) => period.reason || "除外期間")
    .join(" / ");
}

function renderExclusionPeriods() {
  const list = document.getElementById("exclusion-list");
  if (exclusionPeriods.length === 0) {
    list.innerHTML = '<p class="note">登録済みの除外期間はありません。</p>';
    return;
  }
  list.innerHTML = exclusionPeriods.map((period) => `
    <div class="exclusion-item">
      <div>
        <strong>${period.start} から ${period.end}</strong>
        <div class="exclusion-meta">${period.reason || "理由なし"}</div>
      </div>
      <button class="danger-button" type="button" data-remove-exclusion="${period.id}">削除</button>
    </div>
  `).join("");
  list.querySelectorAll("[data-remove-exclusion]").forEach((button) => {
    button.addEventListener("click", () => removeExclusionPeriod(button.dataset.removeExclusion));
  });
}

function renderCalendar() {
  const area = document.getElementById("calendar-area");
  if (dateNodes.length === 0) {
    area.innerHTML = '<p class="note">カレンダーに表示する日付がありません。</p>';
    return;
  }

  const byDate = new Map(dateNodes.map((node) => [node.date, node]));
  const months = getMonthsInRange(dateNodes[0].date, dateNodes[dateNodes.length - 1].date);
  const today = formatDate(new Date());

  area.innerHTML = months.map((monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const blanks = Array.from({ length: first.getDay() }, () => '<button class="calendar-day blank" type="button" disabled></button>');
    const days = [];

    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const node = byDate.get(date);
      if (!node) {
        days.push('<button class="calendar-day blank" type="button" disabled></button>');
        continue;
      }
      const classes = [
        "calendar-day",
        node.enabled ? "is-active" : "is-disabled",
        node.weekday === 0 || node.weekday === 6 ? "is-weekend" : "",
        node.holidayName ? "is-holiday" : "",
        node.exclusionReason ? "is-excluded" : "",
        date === today ? "is-today" : ""
      ].filter(Boolean).join(" ");
      const note = node.exclusionReason || node.holidayName || "";
      days.push(`
        <button class="${classes}" type="button" data-date="${date}">
          <span class="day-number">${day}</span>
          <span class="day-note">${note}</span>
        </button>
      `);
    }

    return `
      <section class="calendar-month" aria-label="${year}年${month}月">
        <div class="calendar-title">${year}年${month}月</div>
        <div class="calendar-weekdays">${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}</div>
        <div class="calendar-days">${blanks.concat(days).join("")}</div>
      </section>
    `;
  }).join("");

  area.querySelectorAll(".calendar-day[data-date]").forEach((button) => {
    button.addEventListener("click", () => toggleDateValid(button.dataset.date));
  });
}

function toggleDateValid(dateKey, forcedValue) {
  const node = dateNodes.find((item) => item.date === dateKey);
  if (!node) return;
  node.enabled = typeof forcedValue === "boolean" ? forcedValue : !node.enabled;
  refreshDateViews();
  saveSettings();
}

function refreshDateViews() {
  renderDateList();
  renderCalendar();
  updateDateSummary();
}

function simulate() {
  saveSettings();
  const activeDates = dateNodes.filter((item) => item.enabled).map((item) => item.date);
  if (activeDates.length === 0) {
    lastResult = null;
    renderResult({ error: "有効な日付がありません。" });
    return;
  }

  const patterns = getEnabledPatterns();
  if (patterns.length === 0) {
    lastResult = null;
    renderResult({ error: "使用する購入方法を1つ以上選択してください。" });
    return;
  }

  const nodeCount = activeDates.length;
  const bestRoutes = new Map([[0, { cost: 0, flow: [] }]]);

  for (let index = 0; index < nodeCount; index += 1) {
    const current = bestRoutes.get(index);
    if (!current) continue;
    patterns.forEach((pattern) => {
      const nextIndex = getNextNodeIndex(activeDates, index, pattern);
      const nextCost = current.cost + getPatternCost(pattern);
      const currentBest = bestRoutes.get(nextIndex);
      if (!currentBest || nextCost < currentBest.cost) {
        bestRoutes.set(nextIndex, {
          cost: nextCost,
          flow: current.flow.concat([{ date: activeDates[index], patternId: pattern.id, patternLabel: pattern.label }])
        });
      }
    });
  }

  const best = bestRoutes.get(nodeCount);
  if (!best) {
    lastResult = null;
    renderResult({ error: "最終有効日へ到達する購入ルートがありません。" });
    return;
  }

  lastResult = {
    activeDates,
    bestCost: best.cost,
    flow: best.flow,
    patternOnlyCosts: {
      RTT: getPatternOnlyCost(activeDates, "RTT"),
      CMT1M: getPatternOnlyCost(activeDates, "CMT1M"),
      CMT3M: getPatternOnlyCost(activeDates, "CMT3M"),
      CMT6M: getPatternOnlyCost(activeDates, "CMT6M")
    }
  };
  renderResult(lastResult);
}

function getNextNodeIndex(activeDates, currentIndex, pattern) {
  const currentDate = activeDates[currentIndex];
  const nextDate = pattern.months > 0 ? addMonthsSafe(currentDate, pattern.months) : formatDate(addDays(parseDate(currentDate), pattern.days));
  if (compareDateString(nextDate, activeDates[activeDates.length - 1]) > 0) return activeDates.length;
  for (let index = currentIndex + 1; index < activeDates.length; index += 1) {
    if (compareDateString(activeDates[index], nextDate) >= 0) return index;
  }
  return activeDates.length;
}

function addMonthsSafe(dateString, months) {
  const date = parseDate(dateString);
  const targetFirst = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  targetFirst.setDate(Math.min(date.getDate(), lastDay));
  return formatDate(targetFirst);
}

function getPatternOnlyCost(activeDates, patternId) {
  const pattern = PATTERNS.find((item) => item.id === patternId);
  if (!pattern || activeDates.length === 0) return null;
  let index = 0;
  let cost = 0;
  while (index < activeDates.length) {
    cost += getPatternCost(pattern);
    index = getNextNodeIndex(activeDates, index, pattern);
  }
  return cost;
}

function renderResult(result) {
  const area = document.getElementById("result-area");
  const csvButton = document.getElementById("download-csv");
  if (result.error) {
    area.innerHTML = `<div class="warning">${result.error}</div>`;
    csvButton.disabled = true;
    return;
  }

  csvButton.disabled = false;
  area.innerHTML = `
    <div class="summary-grid">
      ${renderSummaryCard("最安金額", result.bestCost, true)}
      ${renderSummaryCard("乗車券のみ", result.patternOnlyCosts.RTT)}
      ${renderSummaryCard("1ヶ月定期券のみ", result.patternOnlyCosts.CMT1M)}
      ${renderSummaryCard("3ヶ月定期券のみ", result.patternOnlyCosts.CMT3M)}
      ${renderSummaryCard("6ヶ月定期券のみ", result.patternOnlyCosts.CMT6M)}
      ${renderSummaryCard("有効日数", `${result.activeDates.length}日`)}
    </div>
    <h3>購入フロー</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>日付</th><th>曜日</th><th>購入タイプ</th></tr></thead>
        <tbody>
          ${result.flow.map((row) => {
            const weekday = parseDate(row.date).getDay();
            return `<tr><td data-label="日付">${row.date}</td><td data-label="曜日">${WEEKDAY_LABELS[weekday]}</td><td data-label="購入タイプ">${row.patternId}：${row.patternLabel}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function downloadCsv() {
  if (!lastResult) return;
  const lines = [
    ["種別", "値"],
    ["最安金額", lastResult.bestCost],
    ["乗車券のみ", lastResult.patternOnlyCosts.RTT],
    ["1ヶ月定期券のみ", lastResult.patternOnlyCosts.CMT1M],
    ["3ヶ月定期券のみ", lastResult.patternOnlyCosts.CMT3M],
    ["6ヶ月定期券のみ", lastResult.patternOnlyCosts.CMT6M],
    [],
    ["日付", "曜日", "購入タイプ"]
  ];
  lastResult.flow.forEach((row) => {
    lines.push([row.date, WEEKDAY_LABELS[parseDate(row.date).getDay()], `${row.patternId}:${row.patternLabel}`]);
  });
  const csv = lines.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-simulation-${formatDate(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderSummaryCard(label, value, best = false) {
  const display = typeof value === "number" ? formatCurrency(value) : value;
  return `<div class="summary-card ${best ? "best" : ""}"><span class="summary-label">${label}</span><span class="summary-value">${display}</span></div>`;
}

function getEnabledPatterns() {
  return PATTERNS.filter((pattern) => document.getElementById(pattern.useId).checked);
}

function getPatternCost(pattern) {
  const value = Number(document.getElementById(pattern.fareId).value || 0);
  return pattern.id === "RTT" ? value * 2 : value;
}

function getSelectedWeekdays() {
  return [...document.querySelectorAll("input[name='weekday']:checked")].map((input) => Number(input.value));
}

function getStoredOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").overrides || {};
  } catch {
    return {};
  }
}

function getHolidayName(dateString) {
  return HOLIDAYS[dateString] || "";
}

function updateDateSummary() {
  const activeCount = dateNodes.filter((item) => item.enabled).length;
  document.getElementById("date-summary").textContent = `有効日 ${activeCount} 日 / 全 ${dateNodes.length} 日`;
}

function resetSettings() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function getMonthsInRange(start, end) {
  const months = [];
  const cursor = new Date(parseDate(start).getFullYear(), parseDate(start).getMonth(), 1);
  const endDate = parseDate(end);
  while (cursor <= endDate) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function compareDateString(left, right) {
  return left.localeCompare(right);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

function escapeCsvValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
