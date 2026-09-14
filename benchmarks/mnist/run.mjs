// Paired engineering pilot using Pi's existing runtime and test transport.
import {readFile, writeFile, mkdir, readdir, copyFile} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fixture, exec} from '../../tests/herdr.mjs';
import {rpc} from '../../tests/rpc.mjs';
import {checkRows, checkRetained} from './check.mjs';
import {turn} from './turn.mjs';

const jade = resolve(process.argv[2] || '../jade');
const output = resolve(process.argv[3] || `benchmarks/results/mnist-${Date.now()}`);
const revision = 'dd72a6fa67cb52bb7abf56f585c9f1f4efaaa2ea';
const sourcePath = 'reference/examples/mnist/measurements.json';
const prompts = [
  `I want to choose an on-device MNIST recognizer for my MacBook. Start a small runnable comparison using Jade's existing work in reference/examples/mnist; don't rewrite its backends. I'm considering NumPy, PyTorch, MLX, Rust, and Mojo/MAX. Build compare.mjs so node compare.mjs <measurements.json> prints a JSON array of every recorded inference measurement, each with id (the source run key), batch, and median_ms. Save results.md and recommendation.md, and show them beside this conversation as Results and Recommendation. Explain what we can choose now and what still needs testing. Work as one continuing agent, without delegation.`,
  'Change just the title of the Results view to Measurements. Leave the documents and recommendation as they are.',
  'Actually, I will usually open the recognizer for one digit and close it. Update the comparison explanation and recommendation wherever this changes the conclusion. Include a concrete next measurement I could run for that use.',
  'Bring us back to just this conversation; keep all the saved results and views available for later.'
];
const settings = {provider: process.env.TMAX_TEST_PROVIDER || 'openai-codex', model: process.env.TMAX_TEST_MODEL || 'gpt-5.6-luna', thinking: process.env.TMAX_TEST_THINKING || 'medium'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, {recursive: false}); // Never overwrite a previous attempt.
const source = JSON.parse((await exec('git', ['-C', jade, 'show', `${revision}:examples/mnist/measurements.json`])).stdout);
await exec('git', ['-C', jade, 'archive', '--format=tar', `--output=${join(output, 'jade.tar')}`, revision, 'examples/mnist']);
const tracked = (await exec('git', ['ls-files', 'internal/launcher', 'tests/rpc.mjs', 'tests/herdr.mjs'])).stdout.trim().split('\n');
const provenance = {date: new Date().toISOString(), revision: (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim(),
  jade: revision, jadeArchiveSHA256: sha(await readFile(join(output, 'jade.tar'))), platform: process.platform, arch: process.arch, node: process.version,
  settings, prompts, perTurnBudgetMs: 90000, repetitions: 2,
  sourceHashes: Object.fromEntries(await Promise.all([...tracked, 'benchmarks/mnist/run.mjs', 'benchmarks/mnist/check.mjs', 'benchmarks/mnist/attention.ts', 'benchmarks/mnist/turn.mjs', 'docs/mnist-experiment.md'].map(async path => [path, sha(await readFile(path))])))};
await writeFile(join(output, 'protocol.json'), JSON.stringify(provenance, null, 2) + '\n');
if (process.env.TMAX_LIVE !== '1') {
  console.log(`Prepared pinned sources and protocol in ${output}. No model trials run. Set TMAX_LIVE=1 for live execution with a new output directory.`);
} else {
  // Fail before creating a workspace if dependencies are unavailable.
  const versions = {pi: (await exec('pi', ['--version'])).stdout.trim(), herdr: (await exec('herdr', ['--version'])).stdout.trim()};
  await writeFile(join(output, 'versions.json'), JSON.stringify(versions, null, 2));
  for (let pair = 0; pair < 2; pair++) for (const arm of pair % 2 ? ['joint', 'ordinary'] : ['ordinary', 'joint']) {
    const destination = join(output, `${pair}-${arm}`); await mkdir(destination);
    const report = {pair, arm, settings, rounds: [], semanticReview: 'pending', readerTransfer: 'not measured'};
    let f, p;
    // Copy regular files only: socket files are not artifacts; symlinks cannot escape the workspace.
    async function snapshot(label) {
      const hashes = {}, target = join(destination, label);
      async function visit(dir) {
        for (const entry of await readdir(dir, {withFileTypes: true})) {
          const path = join(dir, entry.name), name = relative(f.dir, path);
          if (entry.isDirectory()) await visit(path);
          else if (entry.isFile()) {
            hashes[name] = sha(await readFile(path));
            await mkdir(resolve(target, relative(f.dir, dir)), {recursive: true});
            await copyFile(path, join(target, name));
          }
        }
      }
      await visit(f.dir); return hashes;
    }
    const artifacts = hashes => Object.fromEntries(Object.entries(hashes).filter(([path]) => path !== 'parent.jsonl' && !(path.startsWith('saved/') && path.endsWith('.json'))));
    try {
      f = await fixture(); f.paneEnv.TMAX_VIEWS_DIR = join(f.dir, 'saved'); f.paneEnv.TMAX_ATTENTION = arm;
      await mkdir(join(f.dir, 'reference'));
      await exec('tar', ['-xf', join(output, 'jade.tar'), '-C', join(f.dir, 'reference')]);
      const initial = await snapshot('initial');
      p = rpc(f, {live: true, extension: resolve('benchmarks/mnist/attention.ts')});
      report.state = await p.request('get_state');
      let prior;
      for (const [index, prompt] of prompts.entries()) {
        const start = performance.now(), offset = p.events.length;
        const round = {index, prompt}; report.rounds.push(round);
        try { await turn(p, prompt); } catch (e) { round.error = String(e); }
        round.modelRequestMs = performance.now() - start;
        const events = p.events.slice(offset), starts = new Map(events.filter(e => e.type === 'tool_execution_start').map(e => [e.toolCallId, e.at]));
        round.tools = events.filter(e => e.type === 'tool_execution_end').map(e => ({name: e.toolName, error: e.isError, elapsedMs: starts.has(e.toolCallId) ? e.at - starts.get(e.toolCallId) : null}));
        round.usage = events.filter(e => e.type === 'message_end' && e.message?.role === 'assistant').map(e => e.message.usage ?? null);
        // Stop a failed/timed-out agent before preserving artifacts; never advance while it is still acting.
        if (round.error) await p.close();
        round.hashes = await snapshot(`round-${index}`);
        round.panes = await f.api('pane', 'list'); round.layout = await f.api('pane', 'layout', '--pane', f.pane);
        round.displays = await Promise.all(round.panes.panes.filter(x => x.pane_id !== f.pane).map(async pane => ({pane: pane.pane_id, text: await f.raw('pane', 'read', pane.pane_id).catch(String)})));
        const check = async (name, action) => { try { round[name] = await action() ?? {status: 'pass'}; } catch (e) { round[name] = {status: 'fail', error: String(e)}; } };
        await check('referenceIntegrity', () => checkRetained(Object.fromEntries(Object.entries(initial).filter(([path]) => path.startsWith('reference/'))), round.hashes));
        await check('numerical', async () => {
          const result = await exec(process.execPath, ['compare.mjs', sourcePath], {cwd: f.dir, timeout: 10000});
          round.adapterOutput = result;
          return checkRows(JSON.parse(result.stdout), source);
        });
        await check('changedInput', async () => {
          const changed = structuredClone(source);
          for (const run of Object.values(changed.runs)) for (const row of run.inference) row.median_ms = row.median_ms * 1.37 + 0.0123;
          const path = join(destination, 'probe.json'); await writeFile(path, JSON.stringify(changed));
          const result = await exec(process.execPath, ['compare.mjs', path], {cwd: f.dir, timeout: 10000});
          round.probeOutput = result;
          return checkRows(JSON.parse(result.stdout), changed);
        });
        if (index === 1 || index === 3) await check('retention', () => checkRetained(artifacts(prior), round.hashes));
        prior = round.hashes;
        await writeFile(join(destination, 'report.json'), JSON.stringify(report, null, 2));
        if (round.error) throw new Error(round.error);
      }
      report.status = 'completed; artifact review required';
    } catch (e) { report.status = 'failed'; report.error = String(e); process.exitCode = 1; }
    finally {
      if (p) { await p.close(); await writeFile(join(destination, 'events.json'), JSON.stringify(p.events, null, 2)); }
      // Preserve failed work as well as successful rounds before fixture cleanup.
      try { if (f) await snapshot('final'); }
      finally { await writeFile(join(destination, 'report.json'), JSON.stringify(report, null, 2)); }
      if (f) await f.close();
    }
    console.log(JSON.stringify({pair, arm, status: report.status, error: report.error}));
    if (report.status === 'failed') throw new Error(`Stopped pilot after failed attempt; preserved in ${destination}. Resolve the failure before starting a new paired pilot.`);
  }
}
