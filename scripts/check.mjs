import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory()
      ? files(path.join(dir, f.name))
      : /\.[cm]?js$/.test(f.name)
        ? [path.join(dir, f.name)]
        : [],
  );
const targets = [...files("src"), ...files("public/app"), ...files("tests")];
for (const file of targets) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked: ${targets.length} JavaScript files.`);
