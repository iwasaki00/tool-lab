"use strict";

const STORAGE_KEY = "ticket-simulator-settings-v2";
const SETTINGS_VERSION = 5;
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
let flowViewMode = "calendar";
let sampleSession = null;
const SAMPLE_SESSION_KEY = "ticket-simulator-sample-v110";

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindNavigation();
  setDefaultDates();
  loadSettings();
  bindEvents();
  generateDateList();
  renderExclusionPeriods();
  renderRoute();
  initSamples();
}

function bindNavigation() {
  window.addEventListener("hashchange", renderRoute);
}

function renderRoute() {
  const isTicketSimulator = location.hash !== "#menu";
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
  document.getElementById("download-pdf").addEventListener("click", downloadPdf);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
}

function handleSettingChanged(event) {
  invalidateSimulation();
  if (event.target.classList.contains("date-enabled")) return;
  saveSettings();
  if (event.target.type === "date" || event.target.name === "weekday" || event.target.id.startsWith("exclude-")) {
    regenerateByCurrentConditions();
  }
}

function regenerateByCurrentConditions() {
  invalidateSimulation();
  saveSettings(false);
  generateDateList({ keepOverrides: false });
}

function setDefaultDates() {
  const today = new Date();
  const todayKey = formatDate(today);
  document.getElementById("start-date").value = todayKey;
  document.getElementById("end-date").value = formatDate(addDays(parseDate(addMonthsSafe(todayKey, 6)), -1));
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    if (settings.version !== SETTINGS_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
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
    version: SETTINGS_VERSION,
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

  if (!start || !end || compareDateString(start, end) > 0) {
    dateNodes = [];
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
  if (!tbody) {
    updateDateSummary();
    return;
  }
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

  invalidateSimulation();
  exclusionPeriods.push({ id: String(Date.now()), start, end, reason });
  document.getElementById("exclusion-start").value = "";
  document.getElementById("exclusion-end").value = "";
  document.getElementById("exclusion-reason").value = "";
  renderExclusionPeriods();
  generateDateList({ keepOverrides: false });
}

function removeExclusionPeriod(id) {
  invalidateSimulation();
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
        <button class="${classes}" type="button" data-date="${date}" aria-pressed="${node.enabled}">
          <span class="day-number">${day}</span>
          <span class="day-status">${node.enabled ? "有効" : "無効"}</span>
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
  invalidateSimulation();
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
    scrollToResult();
    return;
  }

  const patterns = getEnabledPatterns();
  if (patterns.length === 0) {
    lastResult = null;
    renderResult({ error: "使用する購入方法を1つ以上選択してください。" });
    scrollToResult();
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
          flow: current.flow.concat([createFlowStep(activeDates, index, nextIndex, pattern)])
        });
      }
    });
  }

  const best = bestRoutes.get(nodeCount);
  if (!best) {
    lastResult = null;
    renderResult({ error: "最終有効日へ到達する購入ルートがありません。" });
    scrollToResult();
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
  scrollToResult();
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

function createFlowStep(activeDates, currentIndex, nextIndex, pattern) {
  const startDate = activeDates[currentIndex];
  const endDate = getFlowEndDate(activeDates, currentIndex, nextIndex);
  return {
    date: startDate,
    startDate,
    endDate,
    patternId: pattern.id,
    patternLabel: pattern.label
  };
}

function getFlowEndDate(activeDates, currentIndex, nextIndex) {
  if (nextIndex >= activeDates.length) return activeDates[activeDates.length - 1];
  return activeDates[Math.max(currentIndex, nextIndex - 1)];
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
  const pdfButton = document.getElementById("download-pdf");
  if (result.error) {
    area.innerHTML = `<div class="warning">${result.error}</div>`;
    csvButton.disabled = true;
    pdfButton.disabled = true;
    return;
  }

  csvButton.disabled = false;
  pdfButton.disabled = false;
  area.innerHTML = `
    ${renderDiscovery(result)}
    <div class="summary-grid">
      ${renderSummaryCard("最安金額", result.bestCost, true)}
      ${renderSummaryCard("乗車券のみ", result.patternOnlyCosts.RTT)}
      ${renderSummaryCard("1ヶ月定期券のみ", result.patternOnlyCosts.CMT1M)}
      ${renderSummaryCard("3ヶ月定期券のみ", result.patternOnlyCosts.CMT3M)}
      ${renderSummaryCard("6ヶ月定期券のみ", result.patternOnlyCosts.CMT6M)}
      ${renderSummaryCard("有効日数", `${result.activeDates.length}日`)}
    </div>
    <div class="flow-head">
      <h3>購入フロー</h3>
      <div class="flow-view-toggle" aria-label="購入フロー表示切り替え">
        <button type="button" data-flow-view="calendar" class="${flowViewMode === "calendar" ? "is-active" : ""}">カレンダー</button>
        <button type="button" data-flow-view="gantt" class="${flowViewMode === "gantt" ? "is-active" : ""}">線表</button>
      </div>
    </div>
    <div id="flow-view-area">
      ${renderFlowView(result)}
    </div>
  `;
  bindFlowViewToggle(result);
}

function bindFlowViewToggle(result) {
  document.querySelectorAll("[data-flow-view]").forEach((button) => {
    button.addEventListener("click", () => {
      flowViewMode = button.dataset.flowView;
      document.querySelectorAll("[data-flow-view]").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.flowView === flowViewMode);
      });
      document.getElementById("flow-view-area").innerHTML = renderFlowView(result);
    });
  });
}

function renderFlowView(result) {
  return flowViewMode === "gantt" ? renderFlowGantt(result) : renderFlowCalendar(result);
}

function renderFlowCalendar(result) {
  const flowByDate = buildFlowDayMap(result.flow);
  const months = getMonthsInRange(result.activeDates[0], result.activeDates[result.activeDates.length - 1]);

  return `
    <div class="flow-legend" aria-label="購入フロー凡例">
      <span><i class="legend-dot ticket"></i>往復乗車券</span>
      <span><i class="legend-dot cmt1m"></i>1ヶ月定期券</span>
      <span><i class="legend-dot cmt3m"></i>3ヶ月定期券</span>
      <span><i class="legend-dot cmt6m"></i>6ヶ月定期券</span>
    </div>
    <div class="flow-calendar-grid">
      ${months.map((monthKey) => renderFlowMonth(monthKey, flowByDate)).join("")}
    </div>
  `;
}

function renderFlowMonth(monthKey, flowByDate) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const blanks = Array.from({ length: first.getDay() }, () => '<div class="flow-day blank"></div>');
  const days = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const step = flowByDate.get(date);
    const weekday = parseDate(date).getDay();
    const classes = [
      "flow-day",
      step ? "has-flow" : "",
      step ? getFlowTypeClass(step.patternId) : "",
      step?.startDate === date ? "is-start" : "",
      step?.endDate === date ? "is-end" : "",
      weekday === 0 || weekday === 6 ? "is-weekend" : ""
    ].filter(Boolean).join(" ");
    const label = step ? getFlowCalendarLabel(step, date) : "";
    days.push(`
      <div class="${classes}">
        <span class="flow-day-number">${day}</span>
        ${step ? `<span class="flow-day-label">${label}</span>` : ""}
      </div>
    `);
  }

  return `
    <section class="flow-month" aria-label="${year}年${month}月の購入フロー">
      <div class="flow-month-title">${year}年${month}月</div>
      <div class="flow-weekdays">${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}</div>
      <div class="flow-days">${blanks.concat(days).join("")}</div>
    </section>
  `;
}

function buildFlowDayMap(flow) {
  const flowByDate = new Map();
  flow.forEach((step) => {
    for (let current = parseDate(step.startDate); compareDateString(formatDate(current), step.endDate) <= 0; current = addDays(current, 1)) {
      flowByDate.set(formatDate(current), step);
    }
  });
  return flowByDate;
}

function renderFlowGantt(result) {
  const start = result.activeDates[0];
  const end = result.activeDates[result.activeDates.length - 1];
  const totalDays = Math.max(1, getDateDiffDays(start, end) + 1);
  const months = getMonthsInRange(start, end);
  const displayFlow = mergeConsecutiveTickets(result.flow);

  return `
    <div class="gantt-wrap">
      <div class="gantt-scale" aria-hidden="true">
        ${months.map((monthKey) => {
          const monthStart = `${monthKey}-01`;
          const [year, month] = monthKey.split("-").map(Number);
          const monthEnd = formatDate(new Date(year, month, 0));
          const visibleStart = compareDateString(monthStart, start) < 0 ? start : monthStart;
          const visibleEnd = compareDateString(monthEnd, end) > 0 ? end : monthEnd;
          const left = getPercent(getDateDiffDays(start, visibleStart), totalDays);
          const width = getPercent(getDateDiffDays(visibleStart, visibleEnd) + 1, totalDays);
          return `<span style="left:${left}%;width:${width}%">${year}/${month}</span>`;
        }).join("")}
      </div>
      <div class="gantt-list">
        ${displayFlow.map((step, index) => renderGanttRow(step, index, start, totalDays)).join("")}
      </div>
    </div>
  `;
}

function renderGanttRow(step, index, timelineStart, totalDays) {
  const offset = getDateDiffDays(timelineStart, step.startDate);
  const spanDays = getDateDiffDays(step.startDate, step.endDate) + 1;
  const left = getPercent(offset, totalDays);
  const width = Math.max(step.patternId === "RTT" ? 2.4 : 4, getPercent(spanDays, totalDays));
  const isTicket = step.patternId === "RTT";
  const range = step.startDate === step.endDate ? step.startDate : `${step.startDate} → ${step.endDate}`;

  return `
    <div class="gantt-row">
      <div class="gantt-row-label">
        <strong>${index + 1}. ${getFlowPlainLabel(step.patternId)}</strong>
        <span>${range}</span>
      </div>
      <div class="gantt-track">
        <div class="gantt-bar ${getFlowTypeClass(step.patternId)}" style="left:${left}%;width:${width}%">
          <span>${getFlowShortLabel(step.patternId)}</span>
        </div>
      </div>
    </div>
  `;
}

function mergeConsecutiveTickets(flow) {
  return flow.reduce((merged, step) => {
    const last = merged[merged.length - 1];
    if (last && last.patternId === "RTT" && step.patternId === "RTT") {
      last.endDate = step.endDate;
      return merged;
    }
    merged.push({ ...step });
    return merged;
  }, []);
}

function getFlowTypeClass(patternId) {
  if (patternId === "RTT") return "ticket";
  return patternId.toLowerCase();
}

function getFlowShortLabel(patternId) {
  if (patternId === "RTT") return "往復";
  if (patternId === "CMT1M") return "○1か月";
  if (patternId === "CMT3M") return "○3か月";
  if (patternId === "CMT6M") return "○6か月";
  return patternId;
}

function getFlowCalendarLabel(step, date) {
  if (step.patternId === "RTT") return "往復";
  const label = getFlowPlainLabel(step.patternId);
  return step.startDate === date ? `○${label}` : label;
}

function getFlowPlainLabel(patternId) {
  if (patternId === "RTT") return "往復";
  if (patternId === "CMT1M") return "1か月";
  if (patternId === "CMT3M") return "3か月";
  if (patternId === "CMT6M") return "6か月";
  return patternId;
}

function scrollToResult() {
  const resultPanel = document.querySelector(".result-panel");
  if (!resultPanel) return;
  window.requestAnimationFrame(() => {
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
    ["開始日", "終了日", "購入タイプ"]
  ];
  lastResult.flow.forEach((row) => {
    lines.push([row.startDate, row.endDate, `${row.patternId}:${row.patternLabel}`]);
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

function downloadPdf() {
  if (!lastResult) return;

  const lines = lastResult.flow.map((row) => `<tr><td>${row.startDate}</td><td>${row.endDate}</td><td>${row.patternId}：${row.patternLabel}</td></tr>`).join("");

  const html = `
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>乗車券購入シミュレーション結果</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif; color: #172124; margin: 24px; }
      h1 { font-size: 24px; margin: 0 0 16px; }
      h2 { font-size: 18px; margin: 24px 0 10px; }
      .summary { display: grid; gap: 8px; margin-bottom: 12px; }
      .item { border: 1px solid #dbe3e5; border-radius: 8px; padding: 10px; }
      .label { color: #66767a; font-size: 12px; font-weight: 700; }
      .value { display: block; margin-top: 4px; font-size: 18px; font-weight: 800; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #dbe3e5; padding: 8px; text-align: left; }
      th { background: #eef4f3; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>乗車券購入シミュレーション結果</h1>
    <div class="summary">
      <div class="item"><span class="label">最安金額</span><span class="value">${formatCurrency(lastResult.bestCost)}</span></div>
      <div class="item"><span class="label">乗車券のみ</span><span class="value">${formatCurrency(lastResult.patternOnlyCosts.RTT)}</span></div>
      <div class="item"><span class="label">1ヶ月定期券のみ</span><span class="value">${formatCurrency(lastResult.patternOnlyCosts.CMT1M)}</span></div>
      <div class="item"><span class="label">3ヶ月定期券のみ</span><span class="value">${formatCurrency(lastResult.patternOnlyCosts.CMT3M)}</span></div>
      <div class="item"><span class="label">6ヶ月定期券のみ</span><span class="value">${formatCurrency(lastResult.patternOnlyCosts.CMT6M)}</span></div>
      <div class="item"><span class="label">有効日数</span><span class="value">${lastResult.activeDates.length}日</span></div>
    </div>
    <h2>購入フロー</h2>
    <table>
      <thead><tr><th>開始日</th><th>終了日</th><th>購入タイプ</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));<\/script>
  </body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("PDFを作成するにはポップアップを許可してください。");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
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
  const year = Number(dateString.slice(0, 4));
  if (year >= 2028 && year <= 2099) return getFutureHolidays(year)[dateString] || "";
  return HOLIDAYS[dateString] || "";
}

function updateDateSummary() {
  const activeCount = dateNodes.filter((item) => item.enabled).length;
  document.getElementById("date-summary").textContent = `有効日 ${activeCount} 日 / 全 ${dateNodes.length} 日`;
}

function resetSettings() {
  if (sampleSession) { restoreOriginalSettings(); return; }
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

function getDateDiffDays(start, end) {
  const diff = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(diff / 86400000);
}

function getPercent(value, total) {
  return (value / total) * 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

function escapeCsvValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Samples use the existing date generator and simulate() without changing its route search.
function createSamples(today = new Date()) {
  const year = today.getFullYear() + (today >= new Date(today.getFullYear(), 7, 1) ? 1 : 0);
  const start = `${year}-08-01`;
  const end = `${year + 1}-01-31`;
  const fares = { "fare-one-way": 633, "fare-cmt1m": 22980, "fare-cmt3m": 65500, "fare-cmt6m": 124100 };
  const definitions = [
    ["01", "💼", "毎日通勤する会社員", "平日週5日、祝日を除いて6か月通勤。", "6か月定期券が本当に一番お得？", [1,2,3,4,5], "休暇を1週間追加して、最安プランの変化を見てみましょう。"],
    ["02", "🎓", "長期休暇のある学生", "平日通学。夏休みと冬休みを除外します。", "夏休み・冬休みで購入方法はどう変わる？", [1,2,3,4,5], "夏休みの終了日を前後させて比較してみましょう。"],
    ["03", "📅", "週3日出勤", "月・水・金に出勤し、祝日は休み。", "定期券を買うべき境界は？", [1,3,5], "火曜日も有効にして、週4日との違いを見てみましょう。"],
    ["04", "🏠", "週2日出勤", "火・木に出勤し、祝日は休み。", "定期券を買わない方がお得？", [2,4], "出勤日を週1日増やして、購入方法が変わるか試しましょう。"],
    ["05", "📊", "月によって出勤日数が変動", "8・9・12・1月は週5日、10・11月は月曜のみ。", "定期券と普通乗車券を組み合わせたら？", [1,2,3,4,5], "出勤の少ない月を1か月に短縮してみましょう。"],
    ["06", "🧳", "1か月の長期出張", "平日通勤の途中、10月の30日間は利用しません。", "定期券を買う日をずらすと？", [1,2,3,4,5], "出張の開始日を1週間ずらして再計算してみましょう。"],
    ["07", "🔄", "土日を含む勤務", "4日勤務・2日休みを基本に、追加勤務と休みを設定。", "不規則な勤務でも最安プランを比較できる？", [], "カレンダーで土日の勤務を数日変更してみましょう。"],
    ["08", "💻", "途中から在宅勤務", "前半3か月は平日週5日、後半3か月は火・木。", "6か月定期券を買う前に確認したいこと", [1,2,3,4,5], "在宅勤務に切り替える時期を早めて比較してみましょう。"]
  ];
  return definitions.map(([id, icon, name, description, highlight, weekdays, suggestion]) => {
    const sample = { id, icon, name, description, highlight, fares: { ...fares }, start, end, weekdays,
      excludeWeekend: false, excludeHoliday: id !== "07", overrides: {}, exclusions: [], suggestion,
      explanation: {
        "01": "平日通勤の有効日は{days}日です。定期券の期間と利用日数を、下の実計算の差額で比較できます。",
        "02": "夏休みと冬休みを除くと、有効日は{days}日です。休暇をまたぐ定期券と、必要な時期に分けて買う方法を比較できます。",
        "03": "月・水・金を基本にした有効日は{days}日です。この利用頻度での購入方法と、各券種のみの金額を比較できます。",
        "04": "火・木を基本にした有効日は{days}日です。定期券の割引率だけでなく、実際の利用日数も購入額に関係します。",
        "05": "月ごとの利用日数を変えた結果、有効日は{days}日です。購入フローで、利用の多い月と少ない月の券種を確認できます。",
        "06": "30日間の出張を除いた有効日は{days}日です。出張の前後にいつ何を買うか、購入フローで確認できます。",
        "07": "土日を含む不規則な有効日は{days}日です。曜日が不規則でも、設定した日付から同じエンジンで最安プランを計算しています。",
        "08": "後半を週2日に減らした有効日は{days}日です。在宅勤務に切り替わる前後で、購入フローの券種を確認できます。"
      }[id] };
    if (id === "02") sample.exclusions = [
      { id: "summer", start, end: `${year}-08-31`, reason: "夏休み（対象期間内の想定：8/1〜8/31）" },
      { id: "winter", start: `${year}-12-25`, end: `${year + 1}-01-07`, reason: "冬休み（想定：12/25〜1/7）" }
    ];
    if (id === "06") sample.exclusions = [{ id: "trip", start: `${year}-10-01`, end: `${year}-10-30`, reason: "長期出張（30日間）" }];
    let index = 0;
    for (let day = parseDate(start); formatDate(day) <= end; day = addDays(day, 1), index++) {
      const date = formatDate(day);
      const monthIndex = (day.getFullYear() - year) * 12 + day.getMonth() - 7;
      const weekday = day.getDay();
      if (id === "05" && [2,3].includes(monthIndex) && [2,3,4,5].includes(weekday)) sample.overrides[date] = false;
      if (id === "08" && monthIndex >= 3 && [1,3,5].includes(weekday)) sample.overrides[date] = false;
      if (id === "07") sample.overrides[date] = index % 6 < 4;
    }
    if (id === "07") {
      sample.overrides[formatDate(addDays(parseDate(start), 4))] = true;
      sample.overrides[formatDate(addDays(parseDate(start), 12))] = false;
    }
    return sample;
  });
}

function initSamples() {
  const samples = createSamples();
  document.getElementById("sample-cards").innerHTML = samples.map((sample) => `
    <button class="sample-card" type="button" data-sample="${sample.id}" aria-pressed="false">
      <span class="sample-icon" aria-hidden="true">${sample.icon}</span>
      <strong>${sample.id} ${sample.name}</strong>
      <span>${sample.highlight}</span><span class="sample-select">選んで計算 →</span>
    </button>`).join("");
  document.querySelectorAll("[data-sample]").forEach((button) => {
    button.addEventListener("click", () => applySample(samples.find((sample) => sample.id === button.dataset.sample)));
  });
  document.getElementById("restore-settings").addEventListener("click", restoreOriginalSettings);
  // Input edits invalidate results immediately, including before blur on mobile.
  document.querySelectorAll("input").forEach((input) => input.addEventListener("input", invalidateSimulation));
  try {
    const saved = JSON.parse(localStorage.getItem(SAMPLE_SESSION_KEY) || "null");
    if (saved?.original && saved?.sample && saved.version === 1) sampleSession = saved;
  } catch { /* A malformed session must not prevent manual simulation. */ }
  updateSampleStatus();
}

function captureInputState() {
  return {
    inputs: [...document.querySelectorAll("input:not(.date-enabled)")].map((input) => ({ id: input.id, name: input.name, value: input.value, checked: input.checked })),
    dates: structuredClone(dateNodes), exclusions: structuredClone(exclusionPeriods),
    result: structuredClone(lastResult), flowViewMode
  };
}

function persistSampleSession() {
  if (sampleSession) localStorage.setItem(SAMPLE_SESSION_KEY, JSON.stringify(sampleSession));
  else localStorage.removeItem(SAMPLE_SESSION_KEY);
}

function applySample(sample) {
  if (!sampleSession) sampleSession = { version: 1, original: captureInputState() };
  sampleSession.sample = structuredClone(sample);
  sampleSession.modified = false;
  persistSampleSession();
  Object.entries(sample.fares).forEach(([id, fare]) => { document.getElementById(id).value = fare; });
  PATTERNS.forEach((pattern) => { document.getElementById(pattern.useId).checked = true; });
  document.getElementById("start-date").value = sample.start;
  document.getElementById("end-date").value = sample.end;
  document.querySelectorAll("input[name='weekday']").forEach((input) => { input.checked = sample.weekdays.includes(Number(input.value)); });
  document.getElementById("exclude-weekend").checked = sample.excludeWeekend;
  document.getElementById("exclude-holiday").checked = sample.excludeHoliday;
  ["exclusion-start", "exclusion-end", "exclusion-reason"].forEach((id) => { document.getElementById(id).value = ""; });
  document.getElementById("exclusion-error").textContent = "";
  exclusionPeriods = structuredClone(sample.exclusions);
  generateDateList({ keepOverrides: false });
  dateNodes.forEach((node) => {
    if (Object.prototype.hasOwnProperty.call(sample.overrides, node.date)) node.enabled = sample.overrides[node.date];
  });
  refreshDateViews();
  renderExclusionPeriods();
  updateSampleStatus();
  simulate();
}

function restoreOriginalSettings() {
  if (!sampleSession) return;
  const original = sampleSession.original;
  original.inputs.forEach((saved) => {
    const input = saved.id ? document.getElementById(saved.id) : [...document.querySelectorAll("input[name='weekday']")].find((item) => item.value === saved.value);
    if (input) { input.value = saved.value; input.checked = saved.checked; }
  });
  dateNodes = structuredClone(original.dates);
  exclusionPeriods = structuredClone(original.exclusions);
  lastResult = structuredClone(original.result);
  flowViewMode = original.flowViewMode;
  sampleSession = null;
  persistSampleSession();
  saveSettings();
  refreshDateViews();
  renderExclusionPeriods();
  document.getElementById("exclusion-error").textContent = "";
  updateSampleStatus();
  if (lastResult) renderResult(lastResult);
  else clearSimulationResult();
}

function updateSampleStatus() {
  const sample = sampleSession?.sample;
  document.getElementById("sample-status").textContent = sample ? `現在のサンプル：${sample.name}${sampleSession.modified ? "（変更済み）" : ""}` : "ご自身の条件、またはサンプルでお試しください。";
  document.getElementById("restore-settings").hidden = !sampleSession;
  document.getElementById("reset-settings").textContent = sampleSession ? "元の設定に戻す" : "初期化";
  document.getElementById("sample-detail").textContent = sample ? `サンプルの初期条件：${sample.description} 対象期間：${sample.start}〜${sample.end}。片道633円、定期1か月22,980円／3か月65,500円／6か月124,100円（体験用）。${sampleSession.modified ? "現在の条件は下の入力欄・カレンダーをご確認ください。" : ""}` : "";
  document.querySelectorAll("[data-sample]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.sample === sample?.id)));
}

function clearSimulationResult() {
  lastResult = null;
  document.getElementById("result-area").textContent = "条件を設定して「シミュレート実行」を押してください。";
  document.getElementById("download-csv").disabled = true;
  document.getElementById("download-pdf").disabled = true;
}

function invalidateSimulation() {
  if (sampleSession) {
    sampleSession.modified = true;
    persistSampleSession();
    updateSampleStatus();
  }
  clearSimulationResult();
}

function getPurchaseMethod(result) {
  return PATTERNS.map((pattern) => {
    const count = result.flow.filter((step) => step.patternId === pattern.id).length;
    return count ? `${pattern.id === "RTT" ? "普通乗車券（往復）" : pattern.label} × ${count}${pattern.id === "RTT" ? "日" : "枚"}` : "";
  }).filter(Boolean).join(" ＋ ");
}

function renderDiscovery(result) {
  if (!sampleSession) return "";
  const method = getPurchaseMethod(result);
  const onlyOrdinary = result.flow.every((step) => step.patternId === "RTT");
  const comparisons = getEnabledPatterns().map((pattern) => {
    const cost = result.patternOnlyCosts[pattern.id];
    const diff = cost - result.bestCost;
    return `<li>${pattern.label}のみ：${formatCurrency(cost)}（${diff === 0 ? "同額" : `最安より${formatCurrency(diff)}高い`}）</li>`;
  }).join("");
  const passCosts = getEnabledPatterns().filter((p) => p.months > 0).map((p) => result.patternOnlyCosts[p.id]);
  const ordinaryMessage = onlyOrdinary && passCosts.length ? (passCosts.every((cost) => cost > result.bestCost)
    ? "この条件では、定期券を買わない方が安い結果でした。" : "普通乗車券のみも最安です。同額の定期券プランがあります。") : "";
  const sample = sampleSession.sample;
  const explanation = sample.explanation.replace("{days}", result.activeDates.length).replace("{method}", method);
  return `<section class="discovery" aria-labelledby="discovery-title">
    <h3 id="discovery-title">今回の発見${sampleSession.modified ? "（変更後の条件）" : ""}</h3>
    <p>${sample.name}</p><p><strong>${method}</strong></p>
    <p class="discovery-price">最安金額 ${formatCurrency(result.bestCost)}</p>
    <p>${explanation} ${ordinaryMessage}</p>
    <ul>${comparisons}</ul>
    <p class="note">各比較額も既存エンジンで算出しています。同額の購入方法が複数ある場合、購入フローはそのうち一つを表示します。</p>
    <p><strong>次に試すなら：</strong>${sample.suggestion}</p>
  </section>`;
}

const futureHolidayCache = new Map();
function getFutureHolidays(year) {
  if (futureHolidayCache.has(year)) return futureHolidayCache.get(year);
  const holidays = {};
  const fixed = (month, day, name) => { holidays[formatDate(new Date(year, month - 1, day))] = name; };
  [[1,1,"元日"],[2,11,"建国記念の日"],[2,23,"天皇誕生日"],[4,29,"昭和の日"],[5,3,"憲法記念日"],[5,4,"みどりの日"],[5,5,"こどもの日"],[8,11,"山の日"],[11,3,"文化の日"],[11,23,"勤労感謝の日"]].forEach(([m,d,n]) => fixed(m,d,n));
  [[1,2,"成人の日"],[7,3,"海の日"],[9,3,"敬老の日"],[10,2,"スポーツの日"]].forEach(([month,n,name]) => {
    fixed(month, 1 + (8 - new Date(year, month - 1, 1).getDay()) % 7 + (n - 1) * 7, name);
  });
  // 2028–2099 estimates. Official equinox holidays are confirmed in the preceding February.
  fixed(3, Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)), "春分の日（推定）");
  fixed(9, Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)), "秋分の日（推定）");
  const nationalDates = Object.keys(holidays).sort();
  for (let day = new Date(year, 0, 2); day.getFullYear() === year; day = addDays(day, 1)) {
    const key = formatDate(day);
    if (!holidays[key] && holidays[formatDate(addDays(day, -1))] && holidays[formatDate(addDays(day, 1))]) holidays[key] = "国民の休日";
  }
  nationalDates.filter((date) => parseDate(date).getDay() === 0).forEach((date) => {
    let next = addDays(parseDate(date), 1);
    while (holidays[formatDate(next)]) next = addDays(next, 1);
    holidays[formatDate(next)] = "振替休日";
  });
  futureHolidayCache.set(year, holidays);
  return holidays;
}
