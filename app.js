const menuItems = [...document.querySelectorAll("[data-tool]")];
const navButtons = [...document.querySelectorAll(".menu-item")];
const views = [...document.querySelectorAll(".tool-view")];

function showTool(toolId) {
  const target = document.getElementById(toolId);
  if (!target) return;

  views.forEach((view) => {
    view.classList.toggle("is-active", view.id === toolId);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === toolId);
  });

  history.replaceState(null, "", `#${toolId}`);
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => showTool(item.dataset.tool));
});

document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  showTool("dashboard");
});

document.getElementById("add-tool-button").addEventListener("click", () => {
  alert("新しいツールは tools/ に実装して、このメニューへ追加します。");
});

const memoInput = document.getElementById("memo-input");
memoInput.value = localStorage.getItem("tool-lab:memo") || "";
memoInput.addEventListener("input", () => {
  localStorage.setItem("tool-lab:memo", memoInput.value);
});

let timerSeconds = 0;
let timerId = null;
const timerOutput = document.getElementById("timer-output");
const timerStart = document.getElementById("timer-start");

function renderTimer() {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  timerOutput.value = `${minutes}:${seconds}`;
}

timerStart.addEventListener("click", () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    timerStart.textContent = "開始";
    return;
  }

  timerStart.textContent = "停止";
  timerId = setInterval(() => {
    timerSeconds += 1;
    renderTimer();
  }, 1000);
});

document.getElementById("timer-reset").addEventListener("click", () => {
  clearInterval(timerId);
  timerId = null;
  timerSeconds = 0;
  timerStart.textContent = "開始";
  renderTimer();
});

const calcInput = document.getElementById("calc-input");
const calcOutput = document.getElementById("calc-output");
const allowedExpression = /^[\d\s+\-*/().%]+$/;

calcInput.addEventListener("input", () => {
  const expression = calcInput.value.trim();
  if (!expression) {
    calcOutput.value = "結果がここに表示されます";
    return;
  }

  if (!allowedExpression.test(expression)) {
    calcOutput.value = "数字と演算子だけ入力できます";
    return;
  }

  try {
    const result = Function(`"use strict"; return (${expression})`)();
    calcOutput.value = Number.isFinite(result) ? String(result) : "計算できません";
  } catch {
    calcOutput.value = "式を確認してください";
  }
});

showTool(location.hash.slice(1) || "dashboard");
