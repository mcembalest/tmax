import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRows, checkRetained, documentHashes} from '../benchmarks/mnist/check.mjs';
const source = {runs: {cpu: {inference: [{batch: 1, median_ms: 0.005}, {batch: 128, median_ms: 0.04}]}, gpu: {inference: [{batch: 1, median_ms: 0.2}]}}};
const rows = [{id: 'cpu', batch: 1, median_ms: 0.005}, {id: 'cpu', batch: 128, median_ms: 0.04}, {id: 'gpu', batch: 1, median_ms: 0.2}];
test('MNIST checks accept reordered data without grading its interpretation', () => {
  assert.equal(checkRows([...rows].reverse(), source).meaning, 'not graded');
});
test('MNIST checks reject incomplete, duplicated, invented, coerced and wrong-unit data', () => {
  for (const bad of [[], rows.slice(1), [...rows, rows[0]], [rows[0], rows[0], rows[2]],
    rows.map(r => ({...r, median_ms: r.median_ms * 1000})),
    rows.map(r => ({...r, id: 'rust'})), rows.map(r => ({...r, batch: String(r.batch)})),
    ...[null, NaN, Infinity, -1, '0.005'].map(value => [{...rows[0], median_ms: value}, ...rows.slice(1)])])
    assert.throws(() => checkRows(bad, source));
});
test('changed input rejects a memorized table', () => {
  const changed = structuredClone(source); changed.runs.cpu.inference[0].median_ms *= 2;
  assert.throws(() => checkRows(rows, changed));
  const expanded = structuredClone(source);
  expanded.runs.additional = {inference: [{batch: 7, median_ms: 0.031}]};
  assert.throws(() => checkRows(rows, expanded));
  assert.doesNotThrow(() => checkRows([...rows, {id: 'additional', batch: 7, median_ms: 0.031}], expanded));
});
test('gather must preserve every artifact, not just filenames or one surviving file', () => {
  assert.doesNotThrow(() => checkRetained({'results.md': 'a', 'recommendation.md': 'b'}, {'results.md': 'a', 'recommendation.md': 'b', extra: 'c'}));
  for (const after of [{}, {'results.md': 'a'}, {'results.md': 'a', 'recommendation.md': 'changed'}])
    assert.throws(() => checkRetained({'results.md': 'a', 'recommendation.md': 'b'}, after));
  assert.throws(() => checkRetained({}, {}));
});

test('retention checks required user artifacts without treating changing server state as a document edit', () => {
  const before = {'compare.mjs': 'a', 'results.md': 'b', 'recommendation.md': 'c', 'herdr/workspace.json': 'old'};
  const after = {...before, 'herdr/workspace.json': 'new'};
  assert.doesNotThrow(() => checkRetained(documentHashes(before), after));
  for (const path of ['compare.mjs', 'results.md', 'recommendation.md']) {
    const missing = {...before}; delete missing[path];
    assert.throws(() => documentHashes(missing), /Required artifact missing/);
    assert.throws(() => checkRetained(documentHashes(before), missing));
  }
});

const {turn} = await import('../benchmarks/mnist/turn.mjs');
test('deadline closes a still-running RPC before returning failure', async () => {
  let closed = false;
  await assert.rejects(turn({prompt: () => new Promise(() => {}), close: async () => {closed = true;}}, 'request', 5), /budget/);
  assert.equal(closed, true);
});
test('model errors close the session; successful turns preserve the continuing session', async () => {
  let closes = 0;
  const close = async () => {closes++;};
  await turn({prompt: async (message, budget) => {
    assert.equal(message, 'request'); assert.equal(budget, 100);
  }, close}, 'request', 100);
  assert.equal(closes, 0);
  await assert.rejects(turn({prompt: async () => {throw new Error('no auth');}, close}, 'request', 100), /no auth/);
  assert.equal(closes, 1);
});
