const MODES = ["flat", "layers", "mesh"];
const SMOOTH_LEVELS = { off: 0, low: 1, medium: 2, high: 3 };
const QUALITY_SEGMENTS = { low: 64, standard: 112, high: 192 };
const MAX_VERTICES = 40000;

export function createDepthPhotoScene(THREE, {
  phonePerformanceMode = false,
  onDepthPhotoUpdate = () => {},
  initialSettings = {},
} = {}) {
  const root = new THREE.Group();
  root.name = "DEPTH PHOTO";
  const photoRoot = new THREE.Group();
  photoRoot.name = "DEPTH_PHOTO_ROOT";
  root.add(photoRoot);

  const settings = {
    mode: MODES.includes(initialSettings.mode) ? initialSettings.mode : "mesh",
    strength: Number.isFinite(Number(initialSettings.strength)) ? clamp(Number(initialSettings.strength), 0, 3) : 0.9,
    invert: Boolean(initialSettings.invert),
    smooth: Object.hasOwn(SMOOTH_LEVELS, initialSettings.smooth) ? initialSettings.smooth : "medium",
    quality: Object.hasOwn(QUALITY_SEGMENTS, initialSettings.quality)
      ? initialSettings.quality
      : (phonePerformanceMode ? "standard" : "high"),
    maxDepthStep: initialSettings.maxDepthStep !== false,
  };

  let photoCanvas = createSamplePhoto();
  let depthCanvas = createSampleDepth();
  let photoTexture = null;
  let material = null;
  let backgroundMaterial = null;
  let mesh = null;
  let backgroundMesh = null;
  let depthValues = new Float32Array();
  let grid = { columns: 1, rows: 1 };
  let info = emptyInfo();
  let loadRequest = 0;
  let disposed = false;

  rebuildTexture();
  rebuildGeometry();
  emit("SAMPLE READY");

  function rebuildTexture() {
    const oldTexture = photoTexture;
    photoTexture = new THREE.CanvasTexture(photoCanvas);
    photoTexture.colorSpace = THREE.SRGBColorSpace;
    photoTexture.minFilter = THREE.LinearFilter;
    photoTexture.magFilter = THREE.LinearFilter;
    photoTexture.generateMipmaps = true;
    photoTexture.needsUpdate = true;
    if (material) material.map = photoTexture;
    if (backgroundMaterial) backgroundMaterial.map = photoTexture;
    oldTexture?.dispose();
  }

  function rebuildGeometry() {
    const startedAt = performance.now();
    disposeGeometryOnly();
    const aspect = photoCanvas.width / photoCanvas.height;
    const size = fitDisplay(aspect);
    grid = settings.mode === "flat" ? { columns: 1, rows: 1 } : resolveGrid(aspect, settings.quality);
    const geometry = new THREE.PlaneGeometry(size.width * 1.065, size.height * 1.065, grid.columns, grid.rows);
    remapUvsForEdgeStretch(geometry.attributes.uv);
    depthValues = sampleDepth(grid.columns + 1, grid.rows + 1);
    applyDepthToGeometry(geometry);

    material = new THREE.MeshBasicMaterial({ map: photoTexture, side: THREE.DoubleSide });
    mesh = new THREE.Mesh(geometry, material);
    mesh.name = `DEPTH_${settings.mode.toUpperCase()}`;
    mesh.renderOrder = 2;
    photoRoot.add(mesh);

    const backGeometry = new THREE.PlaneGeometry(size.width * 1.13, size.height * 1.13, 1, 1);
    backgroundMaterial = new THREE.MeshBasicMaterial({ map: photoTexture, color: 0x758294, side: THREE.DoubleSide });
    backgroundMesh = new THREE.Mesh(backGeometry, backgroundMaterial);
    backgroundMesh.name = "EDGE_EXTENSION";
    backgroundMesh.position.z = -Math.max(0.07, size.depthAmplitude * settings.strength * 0.62);
    backgroundMesh.renderOrder = 1;
    photoRoot.add(backgroundMesh);

    const values = [...depthValues];
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    info = {
      ...info,
      photoWidth: photoCanvas.width,
      photoHeight: photoCanvas.height,
      depthWidth: depthCanvas.width,
      depthHeight: depthCanvas.height,
      aspect,
      mode: settings.mode,
      strength: settings.strength,
      invert: settings.invert,
      smooth: settings.smooth,
      quality: settings.quality,
      columns: grid.columns,
      rows: grid.rows,
      vertices: geometry.attributes.position.count,
      triangles: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3,
      depthMin: min,
      depthMax: max,
      depthAverage: average,
      depthAmplitude: size.depthAmplitude,
      processingTime: performance.now() - startedAt,
      mismatch: aspectMismatch(photoCanvas, depthCanvas),
      risk: riskLevel(settings.strength, grid.columns * grid.rows),
      photoPreview: canvasPreview(photoCanvas),
      depthPreview: canvasPreview(depthCanvas, settings.invert),
      status: "DEPTH READY",
      errorCode: "",
      errorDetail: "",
    };
    emit();
  }

  function updateDepthOnly({ resample = false } = {}) {
    if (!mesh) return;
    const startedAt = performance.now();
    if (resample) depthValues = sampleDepth(grid.columns + 1, grid.rows + 1);
    applyDepthToGeometry(mesh.geometry);
    const size = fitDisplay(photoCanvas.width / photoCanvas.height);
    backgroundMesh.position.z = -Math.max(0.07, size.depthAmplitude * settings.strength * 0.62);
    info = {
      ...info,
      strength: settings.strength,
      invert: settings.invert,
      smooth: settings.smooth,
      depthPreview: canvasPreview(depthCanvas, settings.invert),
      processingTime: performance.now() - startedAt,
      risk: riskLevel(settings.strength, grid.columns * grid.rows),
      status: "DEPTH READY",
    };
    emit();
  }

  function applyDepthToGeometry(geometry) {
    const position = geometry.attributes.position;
    const amplitude = fitDisplay(photoCanvas.width / photoCanvas.height).depthAmplitude * settings.strength;
    for (let index = 0; index < position.count; index += 1) {
      if (settings.mode === "flat") {
        position.setZ(index, 0);
        continue;
      }
      let depth = settings.invert ? 1 - depthValues[index] : depthValues[index];
      if (settings.mode === "layers") depth = Math.round(depth * 7) / 7;
      position.setZ(index, (depth - 0.5) * amplitude);
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  function sampleDepth(width, height) {
    const work = document.createElement("canvas");
    work.width = width;
    work.height = height;
    const context = work.getContext("2d", { willReadFrequently: true });
    context.drawImage(depthCanvas, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let values = new Float32Array(width * height);
    for (let index = 0; index < values.length; index += 1) {
      const offset = index * 4;
      values[index] = (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
    }
    const passes = SMOOTH_LEVELS[settings.smooth];
    for (let pass = 0; pass < passes; pass += 1) values = blurDepth(values, width, height);
    if (settings.maxDepthStep) values = clampDepthSteps(values, width, height, 0.18);
    return values;
  }

  async function loadImage(kind, file) {
    const startedAt = performance.now();
    const requestId = ++loadRequest;
    validateImageFile(file);
    info = { ...info, status: `LOADING ${kind.toUpperCase()}...`, errorCode: "", errorDetail: "" };
    emit();
    try {
      const nextCanvas = await decodeFileToCanvas(file);
      if (disposed || requestId !== loadRequest) return getInfo();
      if (kind === "photo") {
        photoCanvas = nextCanvas;
        info.photoName = file.name;
        info.photoSource = "LOCAL FILE";
        rebuildTexture();
      } else if (kind === "depth") {
        depthCanvas = nextCanvas;
        info.depthName = file.name;
        info.depthSource = "LOCAL FILE";
      } else {
        throw new Error("UNKNOWN_IMAGE_KIND");
      }
      rebuildGeometry();
      info.processingTime = performance.now() - startedAt;
      emit();
      return getInfo();
    } catch (error) {
      if (!disposed && requestId === loadRequest) {
        info = {
          ...info,
          status: "IMAGE LOAD ERROR",
          errorCode: error?.message || "IMAGE_DECODE_ERROR",
          errorDetail: friendlyImageError(error),
          processingTime: performance.now() - startedAt,
        };
        emit();
      }
      throw error;
    }
  }

  function setSettings(next = {}) {
    const previous = { ...settings };
    if (MODES.includes(next.mode)) settings.mode = next.mode;
    if (Number.isFinite(Number(next.strength))) settings.strength = clamp(Number(next.strength), 0, 3);
    if (typeof next.invert === "boolean") settings.invert = next.invert;
    if (Object.hasOwn(SMOOTH_LEVELS, next.smooth)) settings.smooth = next.smooth;
    if (Object.hasOwn(QUALITY_SEGMENTS, next.quality)) settings.quality = next.quality;
    if (typeof next.maxDepthStep === "boolean") settings.maxDepthStep = next.maxDepthStep;
    const needsRebuild = previous.mode !== settings.mode || previous.quality !== settings.quality;
    const needsResample = previous.smooth !== settings.smooth || previous.maxDepthStep !== settings.maxDepthStep;
    if (needsRebuild) rebuildGeometry();
    else updateDepthOnly({ resample: needsResample });
    return getInfo();
  }

  function getCameraSettings(fov, viewportAspect) {
    const size = fitDisplay(photoCanvas.width / photoCanvas.height);
    const verticalFov = THREE.MathUtils.degToRad(fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(viewportAspect, 0.1));
    const distance = Math.max(
      (size.height * 0.5) / Math.tan(verticalFov * 0.5),
      (size.width * 0.5) / Math.tan(horizontalFov * 0.5),
    ) * 1.15 + size.depthAmplitude * settings.strength * 0.5;
    info.baseCameraDistance = distance;
    info.cameraRangeX = size.width * 0.12;
    info.cameraRangeY = size.height * 0.09;
    return {
      distance,
      target: new THREE.Vector3(0, 0, 0),
      rangeX: info.cameraRangeX,
      rangeY: info.cameraRangeY,
      inputLimitX: 1.45,
      inputLimitY: 1.35,
      near: Math.max(0.03, distance / 100),
      far: Math.max(30, distance + 12),
    };
  }

  function emit(status) {
    if (status) info.status = status;
    onDepthPhotoUpdate(getInfo());
  }

  function getInfo() {
    return { ...info, settings: { ...settings } };
  }

  function disposeGeometryOnly() {
    if (mesh) {
      photoRoot.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    }
    if (backgroundMesh) {
      photoRoot.remove(backgroundMesh);
      backgroundMesh.geometry.dispose();
      backgroundMaterial.dispose();
    }
    mesh = null;
    backgroundMesh = null;
    material = null;
    backgroundMaterial = null;
  }

  function dispose() {
    disposed = true;
    loadRequest += 1;
  }

  return {
    root,
    config: { label: "DEPTH PHOTO", background: 0x05070d, fog: null, shadows: false, cameraRange: 1 },
    update() {},
    loadImage,
    setDepthSettings: setSettings,
    getCameraSettings,
    getDepthPhotoInfo: getInfo,
    dispose,
  };
}

function createSamplePhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#101837");
  sky.addColorStop(0.52, "#395d76");
  sky.addColorStop(1, "#e0a66f");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(251,206,137,.8)";
  context.beginPath(); context.arc(720, 190, 75, 0, Math.PI * 2); context.fill();
  drawMountain(context, 0, 470, 340, 210, "#22374f");
  drawMountain(context, 250, 480, 480, 280, "#29465b");
  drawMountain(context, 610, 490, 390, 225, "#1c3349");
  context.fillStyle = "#122936";
  context.fillRect(0, 500, 960, 220);
  context.fillStyle = "#2e6770";
  context.fillRect(0, 560, 960, 160);
  context.fillStyle = "#67b6ad";
  context.beginPath(); context.ellipse(495, 500, 150, 92, -0.08, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#d7f0dc";
  context.beginPath(); context.ellipse(495, 482, 92, 56, -0.08, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#11252f";
  context.fillRect(470, 470, 48, 250);
  context.strokeStyle = "#8df2d8";
  context.lineWidth = 8;
  context.beginPath(); context.moveTo(130, 720); context.quadraticCurveTo(120, 470, 270, 390); context.stroke();
  context.beginPath(); context.moveTo(850, 720); context.quadraticCurveTo(870, 500, 760, 410); context.stroke();
  context.fillStyle = "rgba(247,255,251,.9)";
  context.font = "600 30px system-ui";
  context.fillText("DEPTH PHOTO / SAMPLE", 36, 56);
  return canvas;
}

function createSampleDepth() {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  context.fillStyle = "#222"; context.fillRect(0, 0, 960, 720);
  context.fillStyle = "#555";
  drawMountain(context, 0, 470, 340, 210); drawMountain(context, 250, 480, 480, 280); drawMountain(context, 610, 490, 390, 225);
  context.fillStyle = "#777"; context.fillRect(0, 500, 960, 220);
  context.fillStyle = "#a9a9a9"; context.fillRect(0, 560, 960, 160);
  context.fillStyle = "#d8d8d8"; context.beginPath(); context.ellipse(495, 500, 150, 92, -.08, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#f5f5f5"; context.fillRect(470, 470, 48, 250);
  context.strokeStyle = "#fff"; context.lineWidth = 20;
  context.beginPath(); context.moveTo(130, 720); context.quadraticCurveTo(120, 470, 270, 390); context.stroke();
  context.beginPath(); context.moveTo(850, 720); context.quadraticCurveTo(870, 500, 760, 410); context.stroke();
  return canvas;
}

function drawMountain(context, x, y, width, height, color) {
  if (color) context.fillStyle = color;
  context.beginPath(); context.moveTo(x, y); context.lineTo(x + width * .48, y - height); context.lineTo(x + width, y); context.closePath(); context.fill();
}

function fitDisplay(aspect) {
  const longEdge = 4.45;
  const width = aspect >= 1 ? longEdge : longEdge * aspect;
  const height = aspect >= 1 ? longEdge / aspect : longEdge;
  return { width, height, depthAmplitude: Math.min(width, height) * 0.46 };
}

function resolveGrid(aspect, quality) {
  const longSegments = QUALITY_SEGMENTS[quality] ?? QUALITY_SEGMENTS.standard;
  let columns = aspect >= 1 ? longSegments : Math.max(16, Math.round(longSegments * aspect));
  let rows = aspect >= 1 ? Math.max(16, Math.round(longSegments / aspect)) : longSegments;
  while ((columns + 1) * (rows + 1) > MAX_VERTICES) {
    columns = Math.max(16, Math.floor(columns * 0.94));
    rows = Math.max(16, Math.floor(rows * 0.94));
  }
  return { columns, rows };
}

function remapUvsForEdgeStretch(attribute) {
  for (let index = 0; index < attribute.count; index += 1) {
    attribute.setXY(index, stretchUv(attribute.getX(index)), stretchUv(attribute.getY(index)));
  }
  attribute.needsUpdate = true;
}

function stretchUv(value) {
  const edge = 0.045;
  if (value <= edge) return 0;
  if (value >= 1 - edge) return 1;
  return (value - edge) / (1 - edge * 2);
}

function blurDepth(source, width, height) {
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0; let count = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = clamp(x + offsetX, 0, width - 1);
          const sampleY = clamp(y + offsetY, 0, height - 1);
          sum += source[sampleY * width + sampleX]; count += 1;
        }
      }
      output[y * width + x] = sum / count;
    }
  }
  return output;
}

function clampDepthSteps(source, width, height, maximumStep) {
  const output = new Float32Array(source);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x > 0) output[index] = clamp(output[index], output[index - 1] - maximumStep, output[index - 1] + maximumStep);
      if (y > 0) output[index] = clamp(output[index], output[index - width] - maximumStep, output[index - width] + maximumStep);
    }
  }
  return output;
}

function validateImageFile(file) {
  if (!file) throw new Error("IMAGE_FILE_REQUIRED");
  if (!file.size) throw new Error("EMPTY_IMAGE_FILE");
  if (!file.type?.startsWith("image/")) throw new Error("IMAGE_FILE_REQUIRED");
}

async function decodeFileToCanvas(file) {
  let bitmap = null;
  if (typeof createImageBitmap === "function") {
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { try { bitmap = await createImageBitmap(file); } catch { /* HTMLImageElement fallback below. */ } }
  }
  const source = bitmap ?? await decodeWithImageElement(file);
  if (!source.width || !source.height) { bitmap?.close?.(); throw new Error("IMAGE_DECODE_ERROR"); }
  const maximum = 2048;
  const scale = Math.min(1, maximum / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  bitmap?.close?.();
  return canvas;
}

function decodeWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGE_DECODE_ERROR")); };
    image.src = url;
  });
}

function canvasPreview(canvas, invert = false) {
  const preview = document.createElement("canvas");
  preview.width = 240;
  preview.height = Math.max(80, Math.round(240 * canvas.height / canvas.width));
  const context = preview.getContext("2d");
  if (invert) context.filter = "invert(1)";
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  context.filter = "none";
  return preview.toDataURL("image/jpeg", 0.78);
}

function aspectMismatch(photo, depth) {
  const ratio = (photo.width / photo.height) / (depth.width / depth.height);
  const delta = Math.abs(Math.log(ratio));
  return delta > 0.16 ? "大きな縦横比差があります。Depth Mapを写真比率へ再サンプリングしました。" : "";
}

function riskLevel(strength, cells) {
  if (strength > 2 || cells > 25000) return "HIGH";
  if (strength > 1.25 || cells > 10000) return "MEDIUM";
  return "LOW";
}

function friendlyImageError(error) {
  if (error?.message === "IMAGE_FILE_REQUIRED") return "JPG / PNG / WebPなどの画像を選択してください。";
  if (error?.message === "EMPTY_IMAGE_FILE") return "画像ファイルが空です。";
  return "画像を読み込めませんでした。HEICは環境により非対応です。JPG / PNG / WebPをお試しください。";
}

function emptyInfo() {
  return {
    status: "INITIALIZING",
    photoName: "SAMPLE PHOTO",
    depthName: "SAMPLE DEPTH MAP",
    photoSource: "BUILT-IN CANVAS",
    depthSource: "BUILT-IN CANVAS",
    errorCode: "",
    errorDetail: "",
    mismatch: "",
    processingTime: 0,
    resourceState: "PHOTO + DEPTH ACTIVE",
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
