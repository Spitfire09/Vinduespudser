import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const buildId = process.env.GITHUB_SHA?.slice(0, 12) || randomUUID().replace(/-/g, "").slice(0, 12);

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await Promise.all([
    cp(path.join(rootDir, "assets"), path.join(distDir, "assets"), { recursive: true }),
    cp(path.join(rootDir, "index.html"), path.join(distDir, "index.html")),
    cp(path.join(rootDir, "styles.css"), path.join(distDir, "styles.css")),
    cp(path.join(rootDir, "app.js"), path.join(distDir, "app.js")),
    cp(path.join(rootDir, "sw.js"), path.join(distDir, "sw.js")),
    cp(path.join(rootDir, "manifest.webmanifest"), path.join(distDir, "manifest.webmanifest")),
  ]);

  const swPath = path.join(distDir, "sw.js");
  const swContent = await readFile(swPath, "utf8");
  const updatedSw = swContent.replace(
    /const CACHE = ".*";/,
    `const CACHE = "vinduespudser-cache-${buildId}";`
  );
  await writeFile(swPath, updatedSw);
}

try {
  await build();
} catch (error) {
  console.error("Build failed while preparing dist and cache versioning.");
  console.error(error);
  process.exitCode = 1;
}
