// owns: shared harness helpers (vite server, software-WebGL chromium launch) for browser tests and goldens.
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

function cachedChromium() {
  const dir = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir)
    .filter((n) => /^chromium-/.test(n))
    .sort()
    .reverse()
    .map((n) => join(dir, n, "chrome-linux64/chrome"))
    .find(existsSync);
}

// Dev server on a free port (port 0 lets the OS choose).
export async function startServer() {
  const server = await createServer({ server: { port: 0, strictPort: false, host: "127.0.0.1", hmr: false, watch: null }, logLevel: "error" });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { server, url };
}

export async function launch() {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync(chromium.executablePath()) ? chromium.executablePath() : cachedChromium());
  return chromium.launch({ headless: true, executablePath, args: CHROMIUM_ARGS });
}

export async function webglRenderer(page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "(no debug info)";
  });
}
