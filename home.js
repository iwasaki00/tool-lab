const PRESS_DURATION = 520;
const MOVE_TOLERANCE = 12;

const cards = [...document.querySelectorAll(".game-card")];
const dialog = document.querySelector("#detail-dialog");
const dialogIcon = document.querySelector("#dialog-icon");
const dialogCategory = document.querySelector("#dialog-category");
const dialogTitle = document.querySelector("#dialog-title");
const dialogDescription = document.querySelector("#dialog-description");
const featureList = document.querySelector("#feature-list");
const dialogOpen = document.querySelector("#dialog-open");
const dialogClose = document.querySelector("#dialog-close");

let pressTimer = 0;
let pressedLink = null;
let pressedCard = null;
let pressOrigin = null;
let suppressedLink = null;
let recentTouchStart = 0;

function cardData(card) {
  const link = card.querySelector(".game-link");
  const icon = card.querySelector(".game-art img");

  return {
    title: link.dataset.title,
    category: link.dataset.category,
    description: link.dataset.description,
    features: link.dataset.features.split("|"),
    href: link.href,
    iconSrc: icon.src,
    iconAlt: icon.alt,
  };
}

function openDetails(card) {
  const game = cardData(card);

  dialogIcon.src = game.iconSrc;
  dialogIcon.alt = game.iconAlt;
  dialogCategory.textContent = game.category;
  dialogTitle.textContent = game.title;
  dialogDescription.textContent = game.description;
  dialogOpen.href = game.href;
  dialogOpen.setAttribute("aria-label", `${game.title}を開く`);
  featureList.replaceChildren(
    ...game.features.map((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      return item;
    }),
  );

  document.body.classList.add("has-dialog");
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  dialogClose.focus();
}

function clearPress() {
  window.clearTimeout(pressTimer);
  pressTimer = 0;
  pressedCard?.classList.remove("is-pressing");
  pressedLink = null;
  pressedCard = null;
  pressOrigin = null;
}

function startPress(event, link, card) {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  clearPress();
  if (event.pointerType === "touch") recentTouchStart = Date.now();

  pressedLink = link;
  pressedCard = card;
  pressOrigin = { x: event.clientX, y: event.clientY };
  card.classList.add("is-pressing");

  pressTimer = window.setTimeout(() => {
    suppressedLink = link;
    card.classList.remove("is-pressing");
    openDetails(card);
    if (navigator.vibrate) navigator.vibrate(18);
    window.setTimeout(() => {
      if (suppressedLink === link) suppressedLink = null;
    }, 1000);
  }, PRESS_DURATION);
}

function movePress(event) {
  if (!pressOrigin || event.currentTarget !== pressedLink) return;
  const movedX = Math.abs(event.clientX - pressOrigin.x);
  const movedY = Math.abs(event.clientY - pressOrigin.y);
  if (movedX > MOVE_TOLERANCE || movedY > MOVE_TOLERANCE) clearPress();
}

function endPress() {
  clearPress();
}

cards.forEach((card) => {
  const link = card.querySelector(".game-link");
  const trigger = card.querySelector(".detail-trigger");

  link.addEventListener("pointerdown", (event) => startPress(event, link, card));
  link.addEventListener("pointermove", movePress);
  link.addEventListener("pointerup", endPress);
  link.addEventListener("pointercancel", endPress);
  link.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") endPress();
  });
  link.addEventListener("dragstart", endPress);
  link.addEventListener("contextmenu", (event) => {
    if (Date.now() - recentTouchStart < 1000) event.preventDefault();
  });
  link.addEventListener("click", (event) => {
    if (suppressedLink !== link) return;
    event.preventDefault();
    event.stopPropagation();
    suppressedLink = null;
  });

  trigger.addEventListener("click", () => openDetails(card));
});

function closeDetails() {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    document.body.classList.remove("has-dialog");
  }
}

dialogClose.addEventListener("click", closeDetails);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDetails();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("has-dialog");
});
