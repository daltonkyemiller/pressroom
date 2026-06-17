/// <reference lib="webworker" />
//
// Service worker for pressroom.
//
// Two jobs:
//
// 1. Precache the built static assets so the app loads offline once
//    installed. Workbox handles this via the injected manifest below
//    (`__WB_MANIFEST` is the placeholder vite-plugin-pwa fills in).
//
// 2. Handle inbound Web Share Target POSTs. When the user shares an
//    image to pressroom from another app, the OS sends it as a
//    multipart/form-data POST to `/share`. We stash the file in the
//    Cache API and redirect to the root with `?share=1` so the app
//    knows to load it.

import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const SHARED_FILE_CACHE = "pressroom-shared-files";
const SHARED_FILE_KEY = "/_shared/image";

self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/share" && event.request.method === "POST") {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  // Let everything else fall through to the network — Workbox's
  // precacheAndRoute handles offline GETs for built assets.
});

async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (file instanceof File) {
      const cache = await caches.open(SHARED_FILE_CACHE);
      // We can't store File directly in caches, but we CAN store a
      // Response containing the bytes — same effect from the client's
      // perspective when it reads back via cache.match.
      const headers = new Headers();
      headers.set("Content-Type", file.type || "application/octet-stream");
      headers.set("X-Pressroom-Filename", encodeURIComponent(file.name || "shared"));
      const stashed = new Response(file, { headers });
      await cache.put(SHARED_FILE_KEY, stashed);
    }
  } catch (err) {
    console.warn("pressroom sw: failed to stash shared file", err);
  }
  // 303 See Other so the browser switches from POST to GET on the
  // redirect target.
  return Response.redirect("/?share=1", 303);
}

self.addEventListener("install", () => {
  // Take over old SW immediately on update so users see fixes without
  // closing every tab.
  void self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
