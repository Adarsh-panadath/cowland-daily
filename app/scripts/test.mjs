// Bundles each tests/*.test.ts with esbuild and runs it with Node's built-in test runner.
// Times are checked in India Standard Time, the zone the delivery cutoff is defined in.
import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const out = ".test-dist";
rmSync(out, { recursive: true, force: true });
const entries = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).map((f) => `tests/${f}`);
await build({ entryPoints: entries, outdir: out, bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "warning", outExtension: { ".js": ".mjs" } });
const files = readdirSync(out).map((f) => `${out}/${f}`);
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", env: { ...process.env, TZ: "Asia/Kolkata" } });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
