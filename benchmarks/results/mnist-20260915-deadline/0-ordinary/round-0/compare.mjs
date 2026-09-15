#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path || process.argv.length !== 3) {
  console.error("usage: node compare.mjs <measurements.json>");
  process.exitCode = 2;
} else {
  try {
    const document = JSON.parse(await readFile(path, "utf8"));
    if (!document || typeof document.runs !== "object" || document.runs === null) {
      throw new Error("expected a measurements document with a runs object");
    }

    const measurements = [];
    for (const [id, run] of Object.entries(document.runs)) {
      if (!Array.isArray(run.inference)) {
        throw new Error(`run ${id} has no inference array`);
      }
      for (const measurement of run.inference) {
        measurements.push({
          id,
          batch: measurement.batch,
          median_ms: measurement.median_ms,
        });
      }
    }
    process.stdout.write(JSON.stringify(measurements) + "\n");
  } catch (error) {
    console.error(`compare.mjs: ${error.message}`);
    process.exitCode = 1;
  }
}
