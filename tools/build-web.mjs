import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const excludedNames = new Set([
  ".git", ".agents", ".tmp", "dist", "node_modules", "tools",
  "character-animation-output", "package.json", "package-lock.json"
]);

async function copyPublicTree(source, destination, depth = 0) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) continue;
    if (entry.name.toLowerCase().endsWith(".cmd")) continue;
    if (entry.isDirectory() && entry.name === "tools") continue;
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyPublicTree(from, to, depth + 1);
    } else if (entry.isFile()) {
      await cp(from, to);
    }
  }
}

await rm(output, { recursive: true, force: true });
await copyPublicTree(root, output);

console.log(`BoltWorks 2D Studio web edition built in ${output}`);
