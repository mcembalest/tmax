#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node compare.mjs <measurements.json>");
  process.exit(2);
}

let measurements;
try {
  measurements = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Could not read ${file}: ${error.message}`);
  process.exit(1);
}

if (!measurements || typeof measurements.runs !== "object" || measurements.runs === null) {
  console.error("Expected a measurements JSON object with a runs member");
  process.exit(1);
}

const rows = [];
for (const [id, run] of Object.entries(measurements.runs)) {
  if (!Array.isArray(run?.inference)) continue;
  for (const measurement of run.inference) {
    if (typeof measurement?.batch !== "number" || typeof measurement?.median_ms !== "number") {
      throw new Error(`Invalid inference measurement in run ${id}`);
    }
    rows.push({ id, batch: measurement.batch, median_ms: measurement.median_ms });
  }
}

console.log(JSON.stringify(rows, null, 2));
