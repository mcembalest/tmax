import assert from 'node:assert/strict';

// Numerical checks only. Meaning and recommendation quality require artifact review.
export function checkRows(actual, measurements) {
  assert.ok(Array.isArray(actual), 'Expected an array of measurements');
  const expected = Object.entries(measurements.runs).flatMap(([id, run]) =>
    run.inference.map(row => ({id, batch: row.batch, median_ms: row.median_ms})));
  assert.equal(actual.length, expected.length, 'Missing or extra measurements');
  const seen = new Set();
  for (const row of actual) {
    const key = JSON.stringify([row.id, row.batch]);
    assert.ok(!seen.has(key), 'Duplicate measurement'); seen.add(key);
    const source = expected.find(x => x.id === row.id && x.batch === row.batch);
    assert.ok(source, 'Unknown backend or batch');
    assert.ok(Number.isFinite(row.median_ms) && row.median_ms >= 0, 'Invalid timing');
    assert.ok(Math.abs(row.median_ms - source.median_ms) <= Math.max(1e-12, Math.abs(source.median_ms) * 1e-9), 'Timing or units differ');
  }
  return {status: 'pass', rows: actual.length, meaning: 'not graded'};
}

export function checkRetained(before, after) {
  assert.ok(Object.keys(before).length, 'No retained artifacts to check');
  for (const [path, hash] of Object.entries(before)) assert.equal(after[path], hash, `Retained artifact changed or disappeared: ${path}`);
}

export function documentHashes(hashes) {
  return Object.fromEntries(['compare.mjs', 'results.md', 'recommendation.md'].map(path => {
    assert.equal(typeof hashes[path], 'string', `Required artifact missing: ${path}`);
    return [path, hashes[path]];
  }));
}
