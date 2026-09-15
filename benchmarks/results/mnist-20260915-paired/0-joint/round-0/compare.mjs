#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file || process.argv.length > 3) {
  console.error("Usage: node compare.mjs <measurements.json>");
  process.exit(2);
}

let document;
try {
  document = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`);
  process.exit(1);
}

if (!document || typeof document.runs !== "object" || document.runs === null) {
  console.error("Invalid measurements file: expected a runs object");
  process.exit(1);
}

const measurements = [];
for (const [id, run] of Object.entries(document.runs)) {
  if (!Array.isArray(run?.inference)) continue;
  for (const sample of run.inference) {
    if (!Number.isFinite(sample?.batch) || !Number.isFinite(sample?.median_ms)) {
      console.error(`Invalid inference measurement in ${id}`);
      process.exit(1);
    }
    measurements.push({ id, batch: sample.batch, median_ms: sample.median_ms });
  }
}

console.log(JSON.stringify(measurements, null, 2));
