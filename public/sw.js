/* 研词 Core service worker：
 * - 带内容哈希的静态资源：缓存优先（命中后不再请求）
 * - 页面导航：网络优先，断网时回退到缓存的 index.html（SPA 离线可用）
 * - 跨域请求（词典 API、Supabase）一律放行不缓存
 */
const CACHE = "kaoyan-core-vocab-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() =>
          caches
            .match("./index.html")
            .then((hit) => hit || caches.match(request))
            .then(
              (hit) =>
                hit ||
                new Response("离线且无缓存", {
                  status: 503,
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                }),
            ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) {
        return hit;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
