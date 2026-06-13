"use strict";

const STORAGE_KEY = "ticket-simulator-settings-v1";
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const PATTERNS = [
  { id: "RTT", label: "往復乗車券", months: 0, days: 1, useId: "use-rtt", fareId: "fare-one-way" },
  { id: "CMT1M", label: "1ヶ月定期券", months: 1, days: 0, useId: "use-cmt1m", fareId: "fare-cmt1m" },
  { id: "CMT3M", label: "3ヶ月定期券", months: 3, days: 0, useId: "use-cmt3m", fareId: "fare-cmt3m" },
  { id: "CMT6M", label: "6ヶ月定期券", months: 6, days: 0, useId: "use-cmt6m", fareId: "fare-cmt6m" }
];

const HOLIDAYS = {
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-03-22": "振替休日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日"
};

let dateItems = [];
let lastResult = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  setDefaultDates();
  loadSettings();
  bindEvents();
  generateDateList();
}

function bindEvents() {
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", handleSettingChanged);
  });

  document.getElementById("generate-dates").addEventListener("click", () => {
    saveSettings();
    generateDateList();
  });

  document.getElementById("simulate-button").addEventListener("click", simulate);
  document.getElementById("download-csv").addEventListener("click", downloadCsv);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
}

function handleSettingChanged(event) {
  if (event.target.classList.contains("date-enabled")) return;
  saveSettings();
  if (event.target.type === "date" || event.target.name === "weekday" || event.target.id.startsWith("exclude-")) {
    generateDateList();
  }
}

function setDefaultDates() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  document.getElementById("start-date").value = formatDate(first);
  document.getElementById("end-date").value = formatDate(last);
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const settings = JSON.parse(raw);
    Object.entries(settings.values || {}).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value;
      }
    });

    document.querySelectorAll("input[name='weekday']").forEach((checkbox) => {
      checkbox.checked = settings.weekdays?.includes(Number(checkbox.value)) || false;
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSettings() {
  const values = {};
  [
    "fare-one-way",
    "fare-cmt1m",
    "fare-cmt3m",
    "fare-cmt6m",
    "use-rtt",
    "use-cmt1m",
    "use-cmt3m",
    "use-cmt6m",
    "start-date",
    "end-date",
    "exclude-weekend",
    "exclude-holiday"
  ].forEach((id) => {
    const element = document.getElementById(id);
    values[id] = element.type === "checkbox" ? element.checked : element.value;
  });

  const overrides = {};
  dateItems.forEach((item) => {
    if (item.enabled !== item.defaultEnabled) {
      overrides[item.date] = item.enabled;
    }
  });

  const settings = {
    values,
    weekdays: getSelectedWeekdays(),
    overrides
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function generateDateList() {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  const tbody = document.getElementById("date-list-body");

  if (!start || !end || compareDateString(start, end) > 0) {
    dateItems = [];
    tbody.innerHTML = '<tr><td colspan="4">開始日と終了日を確認してください。</td></tr>';
    updateDateSummary();
    return;
  }

  const previousOverrides = getStoredOverrides();
  const selectedWeekdays = getSelectedWeekdays();
  const excludeWeekend = document.getElementById("exclude-weekend").checked;
  const excludeHoliday = document.getElementById("exclude-holiday").checked;
  const items = [];

  for (let current = parseDate(start); compareDateString(formatDate(current), end) <= 0; current = addDays(current, 1)) {
    const date = formatDate(current);
    const weekday = current.getDay();
    const holidayName = getHolidayName(date);
    let enabled = selectedWeekdays.includes(weekday);

    if (excludeWeekend && (weekday === 0 || weekday === 6)) enabled = false;
    if (excludeHoliday && holidayName) enabled = false;

    const defaultEnabled = enabled;
    if (Object.prototype.hasOwnProperty.call(previousOverrides, date)) {
      enabled = Boolean(previousOverrides[date]);
    }

    items.push({ date, weekday, holidayName, enabled, defaultEnabled });
  }

  dateItems = items;
  renderDateList();
  saveSettings();
}

function renderDateList() {
  const tbody = document.getElementById("date-list-body");
  if (dateItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">日付がありません。</td></tr>';
    updateDateSummary();
    return;
  }

  tbody.innerHTML = dateItems.map((item, index) => `
    <tr class="${item.enabled ? "" : "is-disabled"}">
      <td><input class="date-enabled" type="checkbox" data-index="${index}" ${item.enabled ? "checked" : ""} aria-label="${item.date}を有効にする"></td>
      <td>${item.date}</td>
      <td>${WEEKDAY_LABELS[item.weekday]}</td>
      <td>${item.holidayName || ""}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".date-enabled").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.index);
      dateItems[index].enabled = event.target.checked;
      renderDateList();
      saveSettings();
    });
  });

  updateDateSummary();
}

function simulate() {
  saveSettings();
  const activeDates = dateItems.filter((item) => item.enabled).map((item) => item.date);
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
  const bestRoutes = new Map();
  bestRoutes.set(0, { cost: 0, flow: [] });

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
  const nextDate = pattern.months > 0
    ? addMonthsSafe(currentDate, pattern.months)
    : formatDate(addDays(parseDate(currentDate), pattern.days));

  if (compareDateString(nextDate, activeDates[activeDates.length - 1]) > 0) {
    return activeDates.length;
  }

  for (let index = currentIndex + 1; index < activeDates.length; index += 1) {
    if (compareDateString(activeDates[index], nextDate) >= 0) return index;
  }

  return activeDates.length;
}

function addMonthsSafe(dateString, months) {
  const date = parseDate(dateString);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetFirst = new Date(year, month + months, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  targetFirst.setDate(Math.min(day, lastDay));
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
        <thead>
          <tr>
            <th>日付</th>
            <th>曜日</th>
            <th>購入タイプ</th>
          </tr>
        </thead>
        <tbody>
          ${result.flow.map((row) => {
            const weekday = parseDate(row.date).getDay();
            return `<tr><td>${row.date}</td><td>${WEEKDAY_LABELS[weekday]}</td><td>${row.patternId}：${row.patternLabel}</td></tr>`;
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
    const weekday = WEEKDAY_LABELS[parseDate(row.date).getDay()];
    lines.push([row.date, weekday, `${row.patternId}:${row.patternLabel}`]);
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
  return `
    <div class="summary-card ${best ? "best" : ""}">
      <span class="summary-label">${label}</span>
      <span class="summary-value">${display}</span>
    </div>
  `;
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
  const activeCount = dateItems.filter((item) => item.enabled).length;
  document.getElementById("date-summary").textContent = `有効日 ${activeCount} 日 / 全 ${dateItems.length} 日`;
}

function resetSettings() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
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
