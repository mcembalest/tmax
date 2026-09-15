#!/usr/bin/env node
/** Print inference medians from Jade's measurements fixture. */
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error("Usage: node compare.mjs <measurements.json>");
  process.exit(2);
}

let measurements;
try {
  measurements = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`);
  process.exit(1);
}

const runs = measurements?.runs;
if (!runs || typeof runs !== "object" || Array.isArray(runs)) {
  console.error("Invalid measurements: expected an object with a runs object");
  process.exit(1);
}

const output = [];
for (const [id, run] of Object.entries(runs)) {
  if (!Array.isArray(run?.inference)) continue;
  for (const measurement of run.inference) {
    if (!Number.isFinite(measurement?.batch) || !Number.isFinite(measurement?.median_ms)) {
      console.error(`Invalid inference measurement in run ${id}`);
      process.exit(1);
    }
    output.push({ id, batch: measurement.batch, median_ms: measurement.median_ms });
  }
}

console.log(JSON.stringify(output, null, 2));
