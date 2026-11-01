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
let activeSection = "overview";
let fareTextContext = null;
let hasDisplayedResult = false;
const SAMPLE_SESSION_KEY = "ticket-simulator-sample-v110";

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindNavigation();
  setDefaultDates();
  loadSettings();
  bindEvents();
  generateDateList();
  renderExclusionPeriods();
  showSection("overview", { scroll: false });
  initSamples();
}

function bindNavigation() {
  document.querySelectorAll("[data-section], [data-section-link]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section || button.dataset.sectionLink, { focus: true }));
  });
  document.querySelector(".section-menu").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...document.querySelectorAll("[data-section]")];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    showSection(tabs[next].dataset.section, { focus: true });
  });
}

function showSection(section, options = {}) {
  if (!["overview", "guide", "samples", "calculate"].includes(section)) return;
  activeSection = section;
  document.querySelectorAll("[role='tabpanel']").forEach((panel) => { panel.hidden = panel.id !== "section-" + section; });
  document.querySelectorAll("[data-section]").forEach((tab) => {
    const selected = tab.dataset.section === section;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  updateViewVisibility();
  if (section === "calculate") fitFareInputs();
  if (options.focus) document.getElementById("tab-" + section).focus({ preventScroll: true });
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
}

function updateViewVisibility() {
  const usesResults = activeSection === "calculate";
  document.querySelector(".result-panel").hidden = !usesResults || !hasDisplayedResult;
  document.getElementById("sample-context").hidden = !usesResults || !sampleSession;
}

function bindEvents() {
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", handleSettingChanged);
  });
  document.getElementById("generate-dates").addEventListener("click", regenerateByCurrentConditions);
  document.getElementById("refresh-from-exclusion").addEventListener("click", regenerateByCurrentConditions);
  document.getElementById("add-exclusion").addEventListener("click", addExclusionPeriod);
  document.getElementById("simulate-button").addEventListener("click", executeSimulation);
  document.getElementById("download-pdf").addEventListener("click", downloadPdf);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
  document.querySelectorAll(".cost-grid input").forEach((input) => input.addEventListener("input", fitFareInputs));
  window.addEventListener("resize", fitFareInputs);
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

function getJapanTomorrow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((part) => [part.type, part.value]));
  return formatDate(addDays(parseDate(parts.year + "-" + parts.month + "-" + parts.day), 1));
}

function setDefaultDates(now = new Date()) {
  const start = getJapanTomorrow(now);
  document.getElementById("start-date").value = start;
  document.getElementById("end-date").value = formatDate(addDays(parseDate(addMonthsSafe(start, 6)), -1));
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
  if (!result.error && !result.context) result.context = captureCalculationContext();
  const manualMethod = document.getElementById("manual-result-method");
  manualMethod.hidden = Boolean(sampleSession) || Boolean(result.error);
  manualMethod.textContent = sampleSession || result.error ? "" : `自分の条件での最安購入方法：${getPurchaseMethod(result)}`;
  hasDisplayedResult = true;
  updateViewVisibility();
  const area = document.getElementById("result-area");
  const pdfButton = document.getElementById("download-pdf");
  if (result.error) {
    area.innerHTML = `<div class="warning">${result.error}</div>`;
    pdfButton.disabled = true;
    document.getElementById("pdf-pattern").disabled = true;
    return;
  }

  pdfButton.disabled = false;
  updatePdfChoices(result);
  area.innerHTML = `
    ${renderDiscovery(result)}
    <div class="summary-grid">
      ${renderSummaryCard("最安金額", result.bestCost, true)}
      ${renderSummaryCard("乗車券のみ", result.patternOnlyCosts.RTT, false, "RTT")}
      ${renderSummaryCard("1ヶ月定期券のみ", result.patternOnlyCosts.CMT1M, false, "CMT1M")}
      ${renderSummaryCard("3ヶ月定期券のみ", result.patternOnlyCosts.CMT3M, false, "CMT3M")}
      ${renderSummaryCard("6ヶ月定期券のみ", result.patternOnlyCosts.CMT6M, false, "CMT6M")}
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
    if (resultPanel.hidden) return;
    document.getElementById("result-title").focus({ preventScroll: true });
    resultPanel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
}

function getPlanLabel(id) {
  if (id === "BEST") return "最安購入方法";
  if (id === "RTT") return "普通乗車券のみ";
  return ({ CMT1M: "1か月定期券のみ", CMT3M: "3か月定期券のみ", CMT6M: "6か月定期券のみ" })[id];
}

function readableDate(date) { return date.replaceAll("-", "/"); }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function groupDateText(dates) {
  const groups = new Map();
  [...dates].sort().forEach((date) => {
    const month = date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(String(Number(date.slice(8))));
  });
  return [...groups].map(([month, days]) => month.replace("-", "/") + "：" + days.join("・") + "日").join(" ／ ");
}

function snapshotPatternCost(context, pattern) {
  return context.fares[pattern.fareId] * (pattern.id === "RTT" ? 2 : 1);
}

function buildPurchasePlans(result) {
  const context = result.context;
  if (!context) throw new Error("計算条件が保存されていません。もう一度シミュレート実行してください。");
  const plans = {};
  for (const id of ["BEST", ...PATTERNS.map((pattern) => pattern.id)]) {
    let flow;
    if (id === "BEST") flow = result.flow;
    else {
      const pattern = PATTERNS.find((item) => item.id === id);
      flow = [];
      for (let index = 0; index < result.activeDates.length;) {
        const next = getNextNodeIndex(result.activeDates, index, pattern);
        flow.push(createFlowStep(result.activeDates, index, next, pattern));
        index = next;
      }
    }
    const steps = flow.map((step) => {
      const pattern = PATTERNS.find((item) => item.id === step.patternId);
      const validUntil = pattern.months > 0 ? formatDate(addDays(parseDate(addMonthsSafe(step.startDate, pattern.months)), -1)) : step.startDate;
      const dates = result.activeDates.filter((date) => date >= step.startDate && date <= step.endDate);
      return { patternId: pattern.id, label: pattern.id === "RTT" ? "普通乗車券（往復）" : getPlanLabel(pattern.id).replace("のみ", ""), purchaseDate: step.startDate, validUntil, coveredUntil: step.endDate, dates, cost: snapshotPatternCost(context, pattern) };
    });
    const cost = steps.reduce((sum, step) => sum + step.cost, 0);
    const expected = id === "BEST" ? result.bestCost : result.patternOnlyCosts[id];
    const coverage = steps.flatMap((step) => step.dates);
    if (!Number.isSafeInteger(cost) || cost !== expected || coverage.length !== result.activeDates.length || coverage.some((date, index) => date !== result.activeDates[index]) || steps.some((step) => step.dates.length === 0 || step.dates.some((date) => date > step.validUntil))) {
      throw new Error("購入フローと合計金額の整合性を確認できません。条件を確認して再計算してください。");
    }
    plans[id] = { id, label: getPlanLabel(id), cost, steps };
  }
  return plans;
}

function updatePdfChoices(result) {
  const select = document.getElementById("pdf-pattern");
  try {
    buildPurchasePlans(result);
    select.innerHTML = ["BEST", ...PATTERNS.map((pattern) => pattern.id)].map((id) => `<option value="${id}">${getPlanLabel(id)}：${formatCurrency(id === "BEST" ? result.bestCost : result.patternOnlyCosts[id])}</option>`).join("") + '<option value="ALL">すべてのパターンをまとめて保存</option>';
    select.disabled = false;
    document.getElementById("pdf-error").textContent = "";
  } catch (error) {
    select.disabled = true;
    select.innerHTML = "";
    document.getElementById("download-pdf").disabled = true;
    document.getElementById("pdf-error").textContent = error.message;
  }
}

function createPdfModel(result, selection = "BEST", now = new Date()) {
  const all = buildPurchasePlans(result);
  const plans = selection === "ALL" ? Object.values(all) : [all[selection]];
  if (plans.some((plan) => !plan)) throw new Error("保存する購入パターンを選んでください。");
  const label = selection === "ALL" ? "すべての購入パターン" : plans[0].label;
  return { context: structuredClone(result.context), activeDates: [...result.activeDates], plans,
    createdAt: new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now) + "（日本時間）",
    filename: "乗車券_" + label + "_" + result.context.start + "_" + result.context.end + ".pdf" };
}

function groupOrdinarySteps(steps) {
  return steps.reduce((rows, step) => {
    const last = rows[rows.length - 1];
    if (last?.patternId === "RTT" && step.patternId === "RTT") {
      last.coveredUntil = step.coveredUntil; last.dates.push(...step.dates); last.cost += step.cost;
    } else rows.push({ ...step, dates: [...step.dates] });
    return rows;
  }, []);
}

function renderPdfHtml(model) {
  const context = model.context;
  const esc = escapeHtml;
  const weekdays = context.weekdays.length ? context.weekdays.map((day) => WEEKDAY_LABELS[day]).join("・") : "なし（個別日指定）";
  const exclusionText = context.exclusions.length ? context.exclusions.map((period) => readableDate(period.start) + "〜" + readableDate(period.end) + " " + (period.reason || "除外期間")).join(" ／ ") : "なし";
  const overrides = [true, false].map((enabled) => {
    const dates = Object.entries(context.overrides).filter(([, value]) => value === enabled).map(([date]) => date);
    return dates.length ? `<p>個別${enabled ? "有効" : "無効"}日：${esc(groupDateText(dates))}</p>` : "";
  }).join("");
  const conditions = `<div class="conditions"><p><strong>計算対象期間：</strong>${readableDate(context.start)}〜${readableDate(context.end)} ／ 対象利用日数：${model.activeDates.length}日</p>
    <p>片道運賃：${formatCurrency(context.fares["fare-one-way"])}（往復は2倍） ／ 定期代：1か月 ${formatCurrency(context.fares["fare-cmt1m"])}・3か月 ${formatCurrency(context.fares["fare-cmt3m"])}・6か月 ${formatCurrency(context.fares["fare-cmt6m"])}</p>
    <p>利用曜日：${esc(weekdays)} ／ 祝日：${context.excludeHoliday ? "除外" : "曜日・個別日設定に従う"} ／ 土日除外：${context.excludeWeekend ? "あり" : "なし"}</p>
    <p>休暇・除外期間：${esc(exclusionText)}</p>${overrides}
    <p>最安探索の対象：${context.enabledPatterns.map((id) => esc(getPlanLabel(id).replace("のみ", ""))).join("・")}</p>
    ${context.sampleName ? `<p>使用サンプル：${esc(context.sampleName)}${context.modified ? "（変更済み）" : ""}</p>` : ""}</div>`;
  const sections = model.plans.map((plan) => {
    const rows = groupOrdinarySteps(plan.steps);
    const ordinaryDates = plan.steps.filter((step) => step.patternId === "RTT").flatMap((step) => step.dates);
    return `<section class="plan"><h2>${esc(plan.label)}</h2><p class="total">合計購入金額 <strong>${formatCurrency(plan.cost)}</strong></p>
      <table><colgroup><col style="width:25%"><col style="width:40%"><col style="width:11%"><col style="width:24%"></colgroup><thead><tr><th>購入日・券種</th><th>有効期間・対応期間</th><th class="amount">利用日数</th><th class="amount">購入額</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td>${row.patternId === "RTT" ? "利用日ごとに購入" : readableDate(row.purchaseDate)}<br><strong>${esc(row.label)}</strong></td><td>${readableDate(row.purchaseDate)}〜${readableDate(row.patternId === "RTT" ? row.coveredUntil : row.validUntil)}<small>${row.patternId === "RTT" ? "上記期間のうち、下記の対象利用日だけ普通乗車券を購入" : "定期券の有効期間。計算対象の利用は" + readableDate(row.purchaseDate) + "〜" + readableDate(row.coveredUntil)}</small></td><td class="amount">${row.dates.length}日</td><td class="amount">${formatCurrency(row.cost)}</td></tr>`).join("")}
      </tbody><tfoot><tr><th colspan="3">合計</th><td class="amount">${formatCurrency(plan.cost)}</td></tr></tfoot></table>
      ${ordinaryDates.length ? `<div class="ordinary-days"><h3>普通乗車券で対応する利用日（${ordinaryDates.length}日）</h3><p>${esc(groupDateText(ordinaryDates))}</p></div>` : ""}
      </section>`;
  }).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.filename)}</title>
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      * { box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, "Yu Gothic", "Meiryo", sans-serif; margin: 24px; color:#172124; font-size:12px; line-height:1.7; }
      h1 { font-size:21px; margin:0 0 8px; } h2 { font-size:18px; border-bottom:2px solid #0b766d; padding-bottom:4px; margin:18px 0 8px; break-after:avoid; } h3 { font-size:13px; margin:12px 0 4px; break-after:avoid; }
      p { margin:6px 0; overflow-wrap:anywhere; } .conditions { border:1px solid #cfdad9; border-radius:6px; padding:10px; font-size:11px; } .conditions p { margin:3px 0; }
      .total { text-align:right; font-size:15px; break-after:avoid; } .total strong { display:inline-block; margin-left:12px; font-size:22px; color:#075d57; }
      table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; } th,td { border:1px solid #cfdad9; padding:7px 6px; text-align:left; overflow-wrap:anywhere; vertical-align:top; } th { background:#eef4f3; } .amount { text-align:right; font-variant-numeric:tabular-nums; white-space:normal; } td small { display:block; margin-top:4px; color:#526166; font-size:10px; }
      thead { display:table-header-group; } tfoot { display:table-row-group; } tr { break-inside:avoid; } .plan + .plan { break-before:page; } .notice,.footnote { color:#526166; font-size:10px; }
      .print-tools { padding:12px; background:#eef4f3; margin-bottom:16px; } button { padding:10px 16px; font-size:15px; touch-action:manipulation; } .ordinary-days { font-size:11px; }
      @media print { body { margin:0; } .print-tools { display:none; } } @media(max-width:500px) { body { margin:12px; } th,td { padding:5px 3px; } }
    </style></head><body><div class="print-tools"><button type="button" onclick="window.print()">印刷・PDFに保存</button><p>印刷画面で「PDFに保存」を選んでください。保存名の候補：${esc(model.filename)}</p></div>
    <h1>乗車券購入シミュレーション</h1><p>出力日時：${esc(model.createdAt)}</p>${conditions}${sections}
    <p class="footnote">定期券は記載の購入日に1枚ずつ購入する想定です。有効期限が対象期間を超えても、代金は日割りせず全額計上しています。比較パターンは最初の利用日から同じ券種で順に購入する既存ルールです。普通乗車券は片道運賃の2倍で計算しています。実際の運賃・定期券の発売条件・有効期間は利用する交通機関で確認してください。祝日データの推定と個別日の設定も結果に影響します。同額の最安プランは一つを表示しています。</p>
    <script>window.addEventListener("load", () => { document.fonts.ready.then(() => setTimeout(() => window.print(), 200)); });<\/script></body></html>`;
}

function downloadPdf() {
  if (!lastResult) return;
  const error = document.getElementById("pdf-error");
  error.textContent = "";
  try {
    const model = createPdfModel(lastResult, document.getElementById("pdf-pattern").value);
    const html = renderPdfHtml(model);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { error.textContent = "印刷画面を開けませんでした。このページのポップアップを許可して、もう一度保存ボタンを押してください。"; return; }
    printWindow.opener = null;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  } catch (cause) { error.textContent = cause.message; }
}


function renderSummaryCard(label, value, best = false, patternId = "") {
  const display = typeof value === "number" ? formatCurrency(value) : value;
  const referenceOnly = patternId && lastResult?.context && !lastResult.context.enabledPatterns.includes(patternId);
  const difference = referenceOnly ? '<small class="comparison-difference">参考額（最安探索の対象外）</small>' : typeof value === "number" && !best && lastResult ? `<small class="comparison-difference">${value === lastResult.bestCost ? "最安と同額" : `最安より${formatCurrency(value - lastResult.bestCost)}高い`}</small>` : "";
  return `<div class="summary-card ${best ? "best" : ""}"><span class="summary-label">${label}</span><span class="summary-value ${typeof value === "number" ? "amount" : ""}">${display}</span>${difference}</div>`;
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
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value) + "円";
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
    <article class="sample-item">
      <button class="sample-card" id="sample-card-${sample.id}" type="button" data-sample="${sample.id}" aria-expanded="false" aria-controls="sample-conditions-${sample.id}">
        <span class="sample-icon" aria-hidden="true">${sample.icon}</span><strong>${sample.id} ${sample.name}</strong>
        <span>${sample.description}</span><span class="sample-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="sample-conditions" id="sample-conditions-${sample.id}" role="region" aria-labelledby="sample-card-${sample.id}" aria-hidden="true" inert><div class="sample-conditions-inner"><div class="sample-conditions-body">
        <p class="sample-highlight">${sample.highlight}</p>${renderSampleConditions(sample)}
        <button class="primary-button" type="button" tabindex="-1" data-apply-sample="${sample.id}">この条件でシミュレート</button>
      </div></div></div>
    </article>`).join("");
  document.querySelectorAll("[data-sample]").forEach((button) => {
    button.addEventListener("click", () => {
      const expand = button.getAttribute("aria-expanded") !== "true";
      document.querySelectorAll("[data-sample]").forEach((other) => {
        const selected = other === button && expand;
        const panel = document.getElementById(other.getAttribute("aria-controls"));
        if (!selected && panel.contains(document.activeElement)) button.focus({ preventScroll: true });
        other.setAttribute("aria-expanded", String(selected));
        panel.setAttribute("aria-hidden", String(!selected));
        panel.toggleAttribute("inert", !selected);
        panel.querySelector("[data-apply-sample]").tabIndex = selected ? 0 : -1;
        panel.classList.toggle("is-open", selected);
      });
      if (expand) window.requestAnimationFrame(ensureSampleHeadingVisible);
    });
  });
  document.querySelectorAll(".sample-conditions").forEach((panel) => panel.addEventListener("transitionend", (event) => {
    if (event.target === panel && event.propertyName === "grid-template-rows") ensureSampleHeadingVisible();
  }));
  document.querySelectorAll("[data-apply-sample]").forEach((button) => button.addEventListener("click", () => applySample(samples.find((sample) => sample.id === button.dataset.applySample))));
  document.getElementById("restore-settings").addEventListener("click", restoreOriginalSettings);
  document.querySelectorAll("input").forEach((input) => input.addEventListener("input", invalidateSimulation));
  try {
    const saved = JSON.parse(localStorage.getItem(SAMPLE_SESSION_KEY) || "null");
    if (saved?.original && saved?.sample && saved.version === 1) sampleSession = saved;
  } catch { /* Keep manual simulation available when session data is malformed. */ }
  updateSampleStatus();
}

function compactSampleDateGroups(dates) {
  const groups = new Map();
  [...dates].sort().forEach((date) => {
    const month = date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(Number(date.slice(8)));
  });
  return [...groups].map(([month, days]) => {
    const ranges = [];
    for (let index = 0; index < days.length;) {
      const start = days[index];
      let end = start;
      while (index + 1 < days.length && days[index + 1] === end + 1) end = days[++index];
      ranges.push(end === start ? String(start) : `${start}〜${end}`);
      index++;
    }
    return `<span class="exception-month" data-month="${month}">${month.replace("-", "/")}：<span class="exception-days">${ranges.join("・")}</span>日</span>`;
  }).join("");
}

function renderSampleConditions(sample) {
  const weekdays = sample.weekdays.join(",") === "1,2,3,4,5" ? "月〜金" : sample.weekdays.length ? sample.weekdays.map((day) => WEEKDAY_LABELS[day]).join("・") : "個別日指定";
  const fares = PATTERNS.map((pattern) => `<div data-preview-fare="${pattern.id}"><dt>${pattern.id === "RTT" ? "片道運賃" : getPlanLabel(pattern.id).replace("定期券のみ", "定期")}</dt><dd>${formatCurrency(sample.fares[pattern.fareId])}</dd></div>`).join("");
  let exceptions = sample.exclusions.length ? `<ul class="sample-leave">${sample.exclusions.map((period) => `<li><span><time datetime="${period.start}">${readableDate(period.start)}</time> → <time datetime="${period.end}">${readableDate(period.end)}</time></span><span>${escapeHtml(period.reason)}</span></li>`).join("")}</ul>` : "";
  for (const [enabled, label] of [[true, "個別有効日"], [false, "個別無効日"]]) {
    const dates = Object.entries(sample.overrides).filter(([, value]) => value === enabled).map(([date]) => date);
    if (dates.length) exceptions += `<div class="sample-date-overrides" data-enabled="${enabled}"><h5>${label}</h5>${compactSampleDateGroups(dates)}</div>`;
  }
  return `<dl class="sample-period"><dt>利用期間</dt><dd><time datetime="${sample.start}" aria-label="利用開始日 ${sample.start}">${readableDate(sample.start)}</time><span aria-hidden="true"> → </span><time datetime="${sample.end}" aria-label="利用終了日 ${sample.end}">${readableDate(sample.end)}</time></dd></dl>
    <dl class="sample-fares" aria-label="運賃・定期代">${fares}</dl>
    <ul class="sample-tags" aria-label="通勤条件"><li data-condition="weekdays">${weekdays}</li><li data-condition="holiday">${sample.excludeHoliday ? "祝日除外" : "祝日除外なし"}</li><li data-condition="weekend">${sample.excludeWeekend ? "土日除外" : "土日除外なし"}</li></ul>
    <p class="sample-comparison">比較：普通乗車券（往復）＋定期1・3・6か月</p>
    ${exceptions ? `<section class="sample-exceptions"><h4>休暇・例外日</h4>${exceptions}</section>` : ""}`;
}

function ensureSampleHeadingVisible() {
  if (activeSection !== "samples") return;
  const button = document.querySelector('[data-sample][aria-expanded="true"]');
  if (!button) return;
  const rect = button.getBoundingClientRect();
  const top = document.querySelector(".app-header").getBoundingClientRect().bottom + 10;
  const bottom = window.innerHeight - 10;
  const offset = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
  if (Math.abs(offset) > 1) window.scrollBy({ top: offset, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function fitFareInputs() {
  document.querySelectorAll(".cost-grid input").forEach((input) => {
    if (!input.clientWidth) return;
    const style = getComputedStyle(input);
    const width = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
    if (!fareTextContext) fareTextContext = document.createElement("canvas").getContext("2d");
    if (!fareTextContext) return;
    fareTextContext.font = `${style.fontWeight} 16px ${style.fontFamily}`;
    const textWidth = fareTextContext.measureText(input.value || "0").width;
    input.style.fontSize = `${Math.max(10, Math.min(16, 16 * width / Math.max(1, textWidth)))}px`;
  });
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
  const originalBeforeSample = sampleSession ? null : captureInputState();
  clearSimulationResult();
  clearValidationErrors();
  if (!sampleSession) sampleSession = { version: 1, original: originalBeforeSample };
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
  saveSettings();
  updateSampleStatus();
  showSection("calculate", { focus: true });
}

function restoreOriginalSettings() {
  if (!sampleSession) return;
  showSection("calculate", { focus: true });
  clearValidationErrors();
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
  updateViewVisibility();
  const sample = sampleSession?.sample;
  document.getElementById("sample-status").textContent = sample ? (sampleSession.modified ? "サンプルの条件を変更しました：" : "サンプルの条件を設定しました：") + sample.name + (sampleSession.modified ? "（変更済み）" : "") : "";
  document.getElementById("restore-settings").hidden = !sampleSession;
  document.getElementById("reset-settings").textContent = "初期化";
  document.getElementById("reset-settings").hidden = Boolean(sampleSession);
}

function clearSimulationResult() {
  hasDisplayedResult = false;
  updateViewVisibility();
  lastResult = null;
  document.getElementById("result-area").textContent = "条件を設定して「シミュレート実行」を押してください。";
  document.getElementById("download-pdf").disabled = true;
  document.getElementById("pdf-pattern").disabled = true;
  document.getElementById("pdf-pattern").innerHTML = "";
  document.getElementById("pdf-error").textContent = "";
}

function invalidateSimulation() {
  clearValidationErrors();
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
  const template = sampleSession.modified ? "変更後の条件での有効日は{days}日です。最安方法と各券種の金額を比較できます。" : sample.explanation;
  const explanation = template.replace("{days}", result.activeDates.length).replace("{method}", method);
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

function clearValidationErrors() {
  document.querySelectorAll(".input-error:not(#pdf-error)").forEach((element) => { element.textContent = ""; });
  document.querySelectorAll("input[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
}

function executeSimulation() {
  clearSimulationResult();
  clearValidationErrors();
  const errors = [];
  PATTERNS.forEach((pattern) => {
    const input = document.getElementById(pattern.fareId);
    const value = Number(input.value);
    if (input.value.trim() === "" || !Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value * 2 * Math.max(dateNodes.length, 1))) {
      document.getElementById(pattern.fareId + "-error").textContent = "0以上の整数の金額を入力してください。無料の場合は0を入力します。";
      input.setAttribute("aria-invalid", "true");
      errors.push(input);
    }
  });
  const start = document.getElementById("start-date");
  const end = document.getElementById("end-date");
  let dateError = "";
  if (!start.value || !end.value) dateError = "開始日と終了日を両方入力してください。";
  else if (start.value > end.value) dateError = "終了日を開始日以降にしてください。";
  else if (!dateNodes.some((node) => node.enabled)) dateError = "利用日がありません。曜日を選ぶか、詳細設定のカレンダーで利用日を有効にしてください。";
  if (dateError) {
    document.getElementById("date-error").textContent = dateError;
    start.setAttribute("aria-invalid", "true"); end.setAttribute("aria-invalid", "true");
    errors.push(start);
  }
  if (getEnabledPatterns().length === 0) {
    document.getElementById("pattern-error").textContent = "比較する乗車券を1つ以上選んでください。";
    document.getElementById("advanced-settings").open = true;
    errors.push(document.getElementById("use-rtt"));
  }
  if (errors.length) {
    errors[0].focus();
    errors[0].scrollIntoView({ block: "center", behavior: "auto" });
    return;
  }
  simulate();
}

function captureCalculationContext() {
  return {
    start: document.getElementById("start-date").value,
    end: document.getElementById("end-date").value,
    fares: Object.fromEntries(PATTERNS.map((pattern) => [pattern.fareId, Number(document.getElementById(pattern.fareId).value)])),
    enabledPatterns: getEnabledPatterns().map((pattern) => pattern.id), weekdays: getSelectedWeekdays(),
    excludeHoliday: document.getElementById("exclude-holiday").checked,
    excludeWeekend: document.getElementById("exclude-weekend").checked,
    exclusions: structuredClone(exclusionPeriods),
    overrides: Object.fromEntries(dateNodes.filter((node) => node.enabled !== node.defaultEnabled).map((node) => [node.date, node.enabled])),
    sampleName: sampleSession?.sample.name || "", modified: Boolean(sampleSession?.modified)
  };
}
