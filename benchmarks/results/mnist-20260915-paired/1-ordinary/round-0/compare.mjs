#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const filename = process.argv[2];
if (!filename || process.argv.length !== 3) {
  console.error("Usage: node compare.mjs <measurements.json>");
  process.exit(2);
}

let measurements;
try {
  measurements = JSON.parse(await readFile(filename, "utf8"));
} catch (error) {
  console.error(`Could not read ${filename}: ${error.message}`);
  process.exit(1);
}

if (!measurements || typeof measurements.runs !== "object" || Array.isArray(measurements.runs)) {
  console.error("Expected a measurements JSON object with a runs object");
  process.exit(1);
}

const output = [];
for (const [id, run] of Object.entries(measurements.runs)) {
  if (!run || !Array.isArray(run.inference)) continue;
  for (const measurement of run.inference) {
    if (typeof measurement.batch !== "number" || typeof measurement.median_ms !== "number") {
      console.error(`Invalid inference measurement in run ${id}`);
      process.exit(1);
    }
    output.push({ id, batch: measurement.batch, median_ms: measurement.median_ms });
  }
}

console.log(JSON.stringify(output, null, 2));
