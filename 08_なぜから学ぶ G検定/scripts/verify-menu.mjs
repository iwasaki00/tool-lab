import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium, webkit } from "@playwright/test";
const root = resolve("app");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const relative = decodeURIComponent(url.pathname).replace(/^\/app\//, "");
  const path = resolve(root, relative || "index.html");
  if (
    !url.pathname.startsWith("/app/") ||
    (!path.startsWith(root + sep) && path !== root)
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(4174, "127.0.0.1", r));
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        }),
        page = await context.newPage();
      await page.goto("http://127.0.0.1:4174/app/");
      await page.getByRole("button", { name: "3分で全体像を見る" }).waitFor();
      await page
        .getByText("オフライン教材：準備済み")
        .waitFor({ timeout: 15000 });
      await page.reload();
      await context.setOffline(true);
      await page.reload();
      await page.getByRole("button", { name: "3分で全体像を見る" }).click();
      await page
        .locator(".beginner-guide summary")
        .filter({ hasText: "なぜ、ルールを書く以外の方法が必要だった？" })
        .click();
      const assets = await page
        .locator(".beginner-guide img")
        .evaluateAll((imgs) =>
          imgs.map((i) => ({
            src: i.getAttribute("src"),
            loaded: i.complete && i.naturalWidth > 0,
          })),
        );
      if (assets.length !== 3 || assets.some((i) => !i.loaded))
        throw Error("Menu image loading failed");
      await page
        .getByRole("button", { name: "第1話で、AIの学び方を試す" })
        .click();
      if ((await page.locator(".comic-panel").count()) !== 3)
        throw Error("Menu lesson entry failed");
      console.log(
        name + ": /app/ relative images + offline guide/deep dive + L003 PASS",
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((r) => server.close(r));
}
