"use strict";

const CACHE_VERSION = "focus-lens-2026-08-01-v2";
const CACHE_PREFIX = "focus-lens";
const STATIC_CACHE = CACHE_PREFIX + "-static-" + CACHE_VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + "-runtime-" + CACHE_VERSION;

// Cache each file independently. During parallel development some of these files
// may not exist yet; one missing file must never abort the service-worker install.
const APP_SHELL = Object.freeze([
  "./",
  "./index.html",
  "./css/style.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/constants.js",
  "./js/storage.js",
  "./js/settings.js",
  "./js/timer.js",
  "./js/history.js",
  "./js/faceDetector.js",
  "./js/handDetector.js",
  "./js/gestureController.js",
  "./js/attendanceController.js",
  "./js/camera.js",
  "./js/notifier.js",
  "./js/wakeLock.js",
  "./js/debug.js",
  "./js/ui.js",
  "./js/app.js",
]);

function scopedUrl(relativePath) {
  return new URL(relativePath, self.registration.scope).toString();
}

function isCacheable(response) {
  return Boolean(response && (response.ok || response.type === "opaque"));
}

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  const results = await Promise.allSettled(APP_SHELL.map(async (relativePath) => {
    const request = new Request(scopedUrl(relativePath), { cache: "reload" });
    const response = await fetch(request);
    if (!isCacheable(response)) {
      throw new Error("HTTP " + response.status);
    }
    await cache.put(request, response.clone());
  }));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.info("[Focus Lens SW] precache skipped:", APP_SHELL[index]);
    }
  });
}

function isMediaPipeRuntimeResource(url) {
  const mediaPipeCdn = (
    (url.hostname === "cdn.jsdelivr.net" || url.hostname === "unpkg.com") &&
    /(?:@mediapipe|mediapipe)/i.test(url.pathname)
  );
  const googleModel = (
    (url.hostname === "storage.googleapis.com" || url.hostname === "www.gstatic.com") &&
    /(?:mediapipe|vision|\.task$|\.tflite$)/i.test(url.pathname)
  );
  return mediaPipeCdn || googleModel;
}

async function cacheFirst(request, cacheName, ignoreSearch = false) {
  let cache = null;
  try {
    cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch });
    if (cached) return cached;
  } catch (error) {
    // A cache/storage failure must not block a live network response.
  }

  try {
    const response = await fetch(request);
    if (cache && isCacheable(response)) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    // Keep respondWith from rejecting when a CDN/model request fails offline.
    return Response.error();
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) return response;
  } catch (error) {
    // Continue to the subpath-safe app-shell fallback below.
  }

  const fallback = await caches.match(scopedUrl("./index.html")) ||
    await caches.match(scopedUrl("./"));
  if (fallback) return fallback;

  return new Response(
    "<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><title>オフライン</title>" +
      "<body><p>オフラインです。通信が戻ってから再読み込みしてください。</p></body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().catch((error) => {
    console.info("[Focus Lens SW] precache unavailable:", error);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => {
      const isFocusLensCache = cacheName.startsWith(CACHE_PREFIX + "-");
      const isCurrent = cacheName === STATIC_CACHE || cacheName === RUNTIME_CACHE;
      return isFocusLensCache && !isCurrent ? caches.delete(cacheName) : Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isMediaPipeRuntimeResource(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  const scopeUrl = new URL(self.registration.scope);
  const belongsToApp = url.origin === scopeUrl.origin && url.href.startsWith(scopeUrl.href);
  if (belongsToApp) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, true));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_VERSION" && event.source) {
    event.source.postMessage({ type: "SERVICE_WORKER_VERSION", version: CACHE_VERSION });
  }
});
