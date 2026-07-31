const HAND_CONNECTIONS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
]);

export function isDebugMode(search = globalThis.location?.search || "") {
  try {
    return new URLSearchParams(search).get("debug") === "1";
  } catch (error) {
    return false;
  }
}

export const DEBUG_ENABLED = isDebugMode();

function roundNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return Math.round(value * 1000) / 1000;
}

function toDisplayValue(value, seen = new WeakSet()) {
  if (typeof value === "number") return roundNumber(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[function " + (value.name || "anonymous") + "]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value instanceof Date) return value.toISOString();
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => toDisplayValue(item, seen));
  const output = {};
  Object.keys(value).sort().forEach((key) => {
    output[key] = toDisplayValue(value[key], seen);
  });
  return output;
}

export function createDebugSnapshot(parts = {}) {
  return {
    timestamp: new Date().toISOString(),
    ...toDisplayValue(parts)
  };
}

export function formatDebugSnapshot(snapshot = {}) {
  return JSON.stringify(toDisplayValue(snapshot), null, 2);
}

function parseDebugDetail(control) {
  const raw = control.dataset.debugDetail;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { value: raw };
  }
}

export function wireDebugEvents(options = {}) {
  const enabled = options.enabled ?? DEBUG_ENABLED;
  const root = options.root || globalThis.document;
  if (!enabled || !root?.addEventListener) return () => undefined;

  const target = options.target || root;
  const handlers = options.handlers || {};
  const selector = options.selector || "[data-debug-event]";
  const prefix = options.eventPrefix || "focus-lens:debug:";

  const onClick = (event) => {
    const control = event.target?.closest?.(selector);
    if (!control || (root !== globalThis.document && !root.contains(control))) return;
    const eventName = control.dataset.debugEvent;
    if (!eventName) return;
    const detail = {
      ...parseDebugDetail(control),
      source: "debug-control"
    };
    if (typeof handlers[eventName] === "function") {
      handlers[eventName](detail, control, event);
    }
    target?.dispatchEvent?.(new CustomEvent(prefix + eventName, {
      detail,
      bubbles: true
    }));
  };

  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

export const wireDebugEventControls = wireDebugEvents;

function normalizeFaceBox(faceBox) {
  if (!faceBox) return null;
  const box = faceBox.boundingBox || faceBox;
  const x = Number(box.x ?? box.originX ?? box.left);
  const y = Number(box.y ?? box.originY ?? box.top);
  const width = Number(box.width ?? ((box.right ?? 0) - x));
  const height = Number(box.height ?? ((box.bottom ?? 0) - y));
  return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null;
}

function mapPoint(point, canvas, sourceWidth, sourceHeight, mirrored) {
  let x = Number(point?.x);
  let y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const normalized = Math.abs(x) <= 1.2 && Math.abs(y) <= 1.2;
  x = normalized ? x * canvas.width : x * canvas.width / Math.max(1, sourceWidth);
  y = normalized ? y * canvas.height : y * canvas.height / Math.max(1, sourceHeight);
  if (mirrored) x = canvas.width - x;
  return { x, y };
}

function drawFaceBox(context, canvas, faceBox, options) {
  const box = normalizeFaceBox(faceBox);
  if (!box) return;
  const sourceWidth = options.sourceWidth || canvas.width;
  const sourceHeight = options.sourceHeight || canvas.height;
  const normalized = Math.abs(box.x) <= 1.2 && Math.abs(box.y) <= 1.2 &&
    Math.abs(box.width) <= 1.2 && Math.abs(box.height) <= 1.2;
  let x = normalized ? box.x * canvas.width : box.x * canvas.width / Math.max(1, sourceWidth);
  const y = normalized ? box.y * canvas.height : box.y * canvas.height / Math.max(1, sourceHeight);
  const width = normalized ? box.width * canvas.width : box.width * canvas.width / Math.max(1, sourceWidth);
  const height = normalized ? box.height * canvas.height : box.height * canvas.height / Math.max(1, sourceHeight);
  if (options.mirrored) x = canvas.width - x - width;

  context.strokeStyle = options.faceColor || "#58e8b2";
  context.lineWidth = Math.max(2, canvas.width / 280);
  context.setLineDash([8, 5]);
  context.strokeRect(x, y, width, height);
  context.setLineDash([]);
}

function drawHand(context, canvas, landmarks, options) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) return;
  const sourceWidth = options.sourceWidth || canvas.width;
  const sourceHeight = options.sourceHeight || canvas.height;
  const points = landmarks.map((point) => mapPoint(
    point,
    canvas,
    sourceWidth,
    sourceHeight,
    options.mirrored
  ));

  context.strokeStyle = options.handLineColor || "rgba(255, 231, 126, 0.92)";
  context.lineWidth = Math.max(1.5, canvas.width / 360);
  HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
    const start = points[startIndex];
    const end = points[endIndex];
    if (!start || !end) return;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });

  context.fillStyle = options.handPointColor || "#ffce4a";
  const radius = Math.max(2.5, canvas.width / 150);
  points.forEach((point) => {
    if (!point) return;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  });
}

export function drawDebugOverlay(canvas, data = {}, options = {}) {
  const enabled = options.enabled ?? DEBUG_ENABLED;
  if (!enabled || !canvas?.getContext || !canvas.width || !canvas.height) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  if (options.clear !== false) context.clearRect(0, 0, canvas.width, canvas.height);

  const drawOptions = {
    ...options,
    sourceWidth: options.sourceWidth || data.sourceWidth || data.videoWidth || canvas.width,
    sourceHeight: options.sourceHeight || data.sourceHeight || data.videoHeight || canvas.height,
    mirrored: options.mirrored ?? data.mirrored ?? true
  };
  const faceBoxes = Array.isArray(data.faceBoxes) ? data.faceBoxes : [data.faceBox || data.face];
  faceBoxes.filter(Boolean).forEach((box) => drawFaceBox(context, canvas, box, drawOptions));

  const hands = Array.isArray(data.handLandmarks?.[0]) ? data.handLandmarks :
    (Array.isArray(data.hands) ? data.hands : [data.handLandmarks || data.hand]);
  hands.filter(Boolean).forEach((hand) => {
    drawHand(context, canvas, hand.landmarks || hand, drawOptions);
  });
  return true;
}

export function clearDebugOverlay(canvas, options = {}) {
  const enabled = options.enabled ?? DEBUG_ENABLED;
  if (!enabled || !canvas?.getContext) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  return true;
}

export function createDebugTools(options = {}) {
  const enabled = options.enabled ?? DEBUG_ENABLED;
  return Object.freeze({
    enabled,
    snapshot: enabled ? createDebugSnapshot : () => ({}),
    formatSnapshot: enabled ? formatDebugSnapshot : () => "",
    wireEvents: (wireOptions = {}) => wireDebugEvents({ ...options, ...wireOptions, enabled }),
    draw: (canvas, data, drawOptions = {}) => drawDebugOverlay(canvas, data, { ...options, ...drawOptions, enabled }),
    clear: (canvas, clearOptions = {}) => clearDebugOverlay(canvas, { ...options, ...clearOptions, enabled })
  });
}

export default createDebugTools;
