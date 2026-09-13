"use strict";

export const HAND_LANDMARK_INDEX = Object.freeze({
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
});

export const DEFAULT_OPEN_PALM_OPTIONS = Object.freeze({
  minHandConfidence: 0.5,
  fingerPipAngleDeg: 155,
  fingerDipAngleDeg: 150,
  thumbMcpAngleDeg: 145,
  thumbIpAngleDeg: 145,
  fingertipDistanceRatio: 1.08,
  thumbDistanceRatio: 1.04,
  frontalityThreshold: 0.35,
  palmSideThreshold: 0.08,
  requirePalmSide: true,
  mirroredInput: false
});

const FINGER_JOINTS = Object.freeze({
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20]
});

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function point(value) {
  return {
    x: finiteNumber(value?.x),
    y: finiteNumber(value?.y),
    z: finiteNumber(value?.z),
    visibility: Number.isFinite(value?.visibility) ? Number(value.visibility) : undefined
  };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector) {
  const length = magnitude(vector);
  if (length < 1e-8) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function midpoint(points) {
  if (!points.length) return { x: 0, y: 0, z: 0 };
  const total = points.reduce(
    (sum, current) => ({
      x: sum.x + current.x,
      y: sum.y + current.y,
      z: sum.z + current.z
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length
  };
}

/** Angle ABC in degrees. */
export function jointAngleDegrees(a, b, c) {
  const ba = subtract(a, b);
  const bc = subtract(c, b);
  const denominator = magnitude(ba) * magnitude(bc);
  if (denominator < 1e-8) return 0;
  const cosine = clamp(
    (ba.x * bc.x + ba.y * bc.y + ba.z * bc.z) / denominator,
    -1,
    1
  );
  return Math.acos(cosine) * (180 / Math.PI);
}

function thresholdScore(value, threshold, maximum = 180) {
  if (value < threshold) return 0;
  return clamp((value - threshold) / Math.max(1, maximum - threshold));
}

function ratioScore(value, threshold) {
  if (value < threshold) return 0;
  return clamp((value - threshold) / 0.35 + 0.35);
}

function getHandedness(categoryList) {
  const category = Array.isArray(categoryList) ? categoryList[0] : categoryList;
  return {
    label: category?.categoryName ?? category?.displayName ?? category?.label ?? "Unknown",
    score: clamp(finiteNumber(category?.score, 1))
  };
}

function analyzeFinger(landmarks, indices, wrist, options) {
  const [mcpIndex, pipIndex, dipIndex, tipIndex] = indices;
  const mcp = landmarks[mcpIndex];
  const pip = landmarks[pipIndex];
  const dip = landmarks[dipIndex];
  const tip = landmarks[tipIndex];
  const pipAngle = jointAngleDegrees(mcp, pip, dip);
  const dipAngle = jointAngleDegrees(pip, dip, tip);
  const distanceRatio = distance(tip, wrist) / Math.max(1e-6, distance(pip, wrist));
  const extended = pipAngle >= options.fingerPipAngleDeg
    && dipAngle >= options.fingerDipAngleDeg
    && distanceRatio >= options.fingertipDistanceRatio;
  const confidence = (
    thresholdScore(pipAngle, options.fingerPipAngleDeg)
    + thresholdScore(dipAngle, options.fingerDipAngleDeg)
    + ratioScore(distanceRatio, options.fingertipDistanceRatio)
  ) / 3;

  return { extended, confidence, pipAngle, dipAngle, distanceRatio };
}

function analyzeThumb(landmarks, wrist, palmCenter, options) {
  const cmc = landmarks[HAND_LANDMARK_INDEX.THUMB_CMC];
  const mcp = landmarks[HAND_LANDMARK_INDEX.THUMB_MCP];
  const ip = landmarks[HAND_LANDMARK_INDEX.THUMB_IP];
  const tip = landmarks[HAND_LANDMARK_INDEX.THUMB_TIP];
  const mcpAngle = jointAngleDegrees(cmc, mcp, ip);
  const ipAngle = jointAngleDegrees(mcp, ip, tip);
  const wristRatio = distance(tip, wrist) / Math.max(1e-6, distance(ip, wrist));
  const palmRatio = distance(tip, palmCenter) / Math.max(1e-6, distance(ip, palmCenter));
  const distanceRatio = Math.min(wristRatio, palmRatio);
  const extended = mcpAngle >= options.thumbMcpAngleDeg
    && ipAngle >= options.thumbIpAngleDeg
    && distanceRatio >= options.thumbDistanceRatio;
  const confidence = (
    thresholdScore(mcpAngle, options.thumbMcpAngleDeg)
    + thresholdScore(ipAngle, options.thumbIpAngleDeg)
    + ratioScore(distanceRatio, options.thumbDistanceRatio)
  ) / 3;

  return { extended, confidence, mcpAngle, ipAngle, distanceRatio };
}

function analyzePalmFacing(landmarks, handedness, options) {
  const wrist = landmarks[HAND_LANDMARK_INDEX.WRIST];
  const indexMcp = landmarks[HAND_LANDMARK_INDEX.INDEX_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARK_INDEX.PINKY_MCP];
  const normal = normalize(cross(subtract(indexMcp, wrist), subtract(pinkyMcp, wrist)));
  const frontality = Math.abs(normal.z);
  const label = handedness.label.toLowerCase();
  let expectedNormalZ = label.includes("right") ? -1 : label.includes("left") ? 1 : 0;
  if (options.mirroredInput) expectedNormalZ *= -1;
  const sideAlignment = expectedNormalZ === 0 ? frontality : normal.z * expectedNormalZ;
  const sideMatches = !options.requirePalmSide
    || expectedNormalZ === 0
    || sideAlignment >= options.palmSideThreshold;
  const facing = frontality >= options.frontalityThreshold && sideMatches;
  const frontalityScore = frontality < options.frontalityThreshold
    ? 0
    : clamp((frontality - options.frontalityThreshold) / (1 - options.frontalityThreshold));
  const sideScore = expectedNormalZ === 0
    ? 0.5
    : clamp((sideAlignment + 1) / 2);

  return {
    facing,
    normal,
    frontality,
    sideAlignment,
    confidence: options.requirePalmSide
      ? Math.min(frontalityScore, sideScore)
      : frontalityScore
  };
}

/** Analyze one set of 21 MediaPipe hand landmarks. */
export function analyzeHandLandmarks(rawLandmarks, input = {}) {
  const options = { ...DEFAULT_OPEN_PALM_OPTIONS, ...(input.options ?? input) };
  if (!Array.isArray(rawLandmarks) || rawLandmarks.length < 21) {
    return {
      detected: false,
      openPalm: false,
      confidence: 0,
      reason: "insufficient_landmarks",
      landmarks: []
    };
  }

  const landmarks = rawLandmarks.slice(0, 21).map(point);
  const worldLandmarks = Array.isArray(input.worldLandmarks)
    ? input.worldLandmarks.slice(0, 21).map(point)
    : [];
  const geometry = worldLandmarks.length >= 21 ? worldLandmarks : landmarks;
  const handedness = getHandedness(input.handedness);
  const wrist = geometry[HAND_LANDMARK_INDEX.WRIST];
  const palmCenter = midpoint([
    wrist,
    geometry[HAND_LANDMARK_INDEX.INDEX_MCP],
    geometry[HAND_LANDMARK_INDEX.MIDDLE_MCP],
    geometry[HAND_LANDMARK_INDEX.RING_MCP],
    geometry[HAND_LANDMARK_INDEX.PINKY_MCP]
  ]);

  const fingers = {
    thumb: analyzeThumb(geometry, wrist, palmCenter, options),
    index: analyzeFinger(geometry, FINGER_JOINTS.index, wrist, options),
    middle: analyzeFinger(geometry, FINGER_JOINTS.middle, wrist, options),
    ring: analyzeFinger(geometry, FINGER_JOINTS.ring, wrist, options),
    pinky: analyzeFinger(geometry, FINGER_JOINTS.pinky, wrist, options)
  };
  const palm = analyzePalmFacing(geometry, handedness, options);
  const allFingersExtended = Object.values(fingers).every((finger) => finger.extended);
  const fingerConfidence = Object.values(fingers).reduce(
    (sum, finger) => sum + finger.confidence,
    0
  ) / 5;
  const detected = handedness.score >= options.minHandConfidence;
  const openPalm = detected && allFingersExtended && palm.facing;
  const confidence = detected
    ? clamp(Math.min(handedness.score, (fingerConfidence + palm.confidence) / 2))
    : 0;

  return {
    detected,
    openPalm,
    confidence,
    handedness,
    allFingersExtended,
    extendedFingerCount: Object.values(fingers).filter((finger) => finger.extended).length,
    fingers,
    palm,
    landmarks,
    worldLandmarks
  };
}

/** Analyze a complete MediaPipe HandLandmarker VIDEO result. */
export function analyzeHandLandmarkerResult(result, options = {}) {
  const landmarkSets = Array.isArray(result?.landmarks) ? result.landmarks : [];
  const worldSets = Array.isArray(result?.worldLandmarks) ? result.worldLandmarks : [];
  const handednessSets = Array.isArray(result?.handednesses)
    ? result.handednesses
    : Array.isArray(result?.handedness)
      ? result.handedness
      : [];
  const hands = landmarkSets.map((landmarks, index) => analyzeHandLandmarks(landmarks, {
    options,
    worldLandmarks: worldSets[index],
    handedness: handednessSets[index]
  }));
  const bestHand = hands.reduce((best, current) => {
    if (!best) return current;
    if (current.openPalm !== best.openPalm) return current.openPalm ? current : best;
    return current.confidence > best.confidence ? current : best;
  }, null);

  return {
    detected: hands.some((hand) => hand.detected),
    openPalm: hands.some((hand) => hand.openPalm),
    confidence: bestHand?.confidence ?? 0,
    handCount: hands.length,
    bestHand,
    hands
  };
}
