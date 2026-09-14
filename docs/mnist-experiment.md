# One continuing agent: MNIST pilot

## Question and frozen protocol

Does a short, generic joint-attention instruction improve the artifacts produced
by one Pi session? This is an engineering pilot, not a demonstration of superiority.
Production prompts, tools, runtime, and UI are unchanged. The experiment-only
extension loads production in both arms; treatment appends one sentence about
correctness, measurement meaning, intended use, and reader interpretation. There
are no extra agents, task-specific hints, or treatment-only acceptance criteria.

Two pairs run sequentially, ordinary/joint then joint/ordinary, with fresh sessions
and the same pinned Jade source, requests, tools, permissions, model, thinking,
and 90-second turn budget. Each arm has four turns (build, local view rename,
shared workload revision, gather). No corrective user turns or automatic retries.
A failed model attempt stops the pilot; preserve it and restart a whole paired
pilot in a new directory after fixing infrastructure. These few non-independent
observations cannot establish statistical significance. The advisor-plus-team
baseline remains unmeasured and legitimate.

The runnable artifact requested is a small adapter over Jade's recorded inference
measurements, with results and a developing recommendation. It is a first slice
of choosing/building a recognizer, not a new implementation of all its backends.
`compare.mjs <measurements.json>` emits every source inference row as
`{id, batch, median_ms}`. This common output contract is given to both arms.
The program and documents belong in the current working directory; `reference/`
remains read-only. The changed-input probe also adds a backend and batch to catch
fixed-catalog implementations. The revised workload is one digit per application launch. A local view-title
request must not change the documents; a shared workload change must update every
relevant current conclusion without rewriting the recorded data.

### Predeclared criteria

| Criterion | Evidence / decision rule |
| --- | --- |
| Numerical correctness | Execute the submitted adapter, independently compare all rows with pinned source; reject missing, extra, duplicate, invented, invalid, and wrong-unit values. Changed-input probe must also work. |
| Implementation validity | Reviewer inspects runnable adapter and command result; must read its supplied input, reuse Jade, and not manufacture backend results. Numeric pass alone is insufficient. |
| Measurement meaning | Review actual results/recommendation: scopes, devices, weight state, transfers, accuracy checks, setup and compilation exclusions must support each conclusion. No magic-word scoring. |
| Local intervention | No unrequested repair prompts. Rename only Results to Measurements, preserve other view identities/titles and all document bytes. Inspect registry and pane snapshots. |
| Shared revision | Review all current documents and displays for stale conclusions after one-digit-per-launch revision. Recorded historical numbers remain intact. |
| Gathering | Before/after artifact hashes must match, all views remain recoverable, and pane layout returns to the conversation. Inspect saved registries/layout; do not infer success just from tool calls. |
| Elapsed time | Report every turn including failures; model-request wall time includes tools. Tool durations are separate, overlapping intervals, never summed as model latency. Snapshots and grader execution are outside that interval. |
| Usage | Preserve Pi-reported usage per assistant message; missing usage stays unknown, never zero. Compare totals only for complete paired arms and report failed attempts separately. |
| Receiving/transfer | A human reader, blind to arm, gets only final artifacts and applies them to the changed case below. No simulated student, praise, model self-score, or prepared transcript. |

A successful artifact must satisfy all correctness/meaning/revision/retention
criteria; do not average a correctness failure away with speed. Report intervention
counts (planned requests: four; unplanned corrective requests: zero by design),
clarification requests and unresolved work from the actual transcript. Compare
paired completion, time and usage only alongside artifact review. If both arms
pass, extra tokens without better transfer or correctness are not an improvement.

For receiving/transfer, give a reader this question without source code or the
rubric: "The recognizer will now remain open for an hour and handle a digit every
second. What parts of the recommendation still follow, what changes, and what
would you measure next?" Have them write their decision before any feedback.
Reviewer checks whether they can distinguish amortized startup from steady-state
latency, identify which existing evidence applies, and specify a measurement
including the relevant input/output path and trained prediction. Mark each
supported/unsupported with the artifact passage used and elapsed reader time.
This is a held-for-human transfer task, not another Pi-agent turn. Until a real
reader does it, comprehension is **not measured**. The harness never injects this
rubric or question into either arm. It is not a security isolation boundary.

## Reproduce

From tmax root, with a local Jade clone (read-only use):

```sh
node --test tests/mnist.test.mjs
node benchmarks/mnist/run.mjs ../jade /tmp/mnist-prepared
TMAX_LIVE=1 node benchmarks/mnist/run.mjs ../jade /tmp/mnist-live
```

Each output directory must be new. Preparation archives only `examples/mnist/`
at Jade `dd72a6fa67cb52bb7abf56f585c9f1f4efaaa2ea`, records SHA-256 provenance,
requests, settings and budget, and makes no model calls. It does not alter Jade's
checkout. Live execution uses `tests/rpc.mjs`, `tests/herdr.mjs`, and existing
views tools. Install Pi 0.85.0 and Herdr 0.9.0 following
`.github/workflows/test.yml` (the filename is singular). Default provider/model:
`openai-codex` / `gpt-5.6-luna`, thinking `medium`. Existing
`TMAX_TEST_PROVIDER`, `TMAX_TEST_MODEL`, `TMAX_TEST_THINKING` overrides are honored.
Authenticate Pi **in the executing cloud workspace**, or use a supported provider
credential there. Do not copy auth from a user's computer. No fixture provider is
used for claimed model trials.

Each live round retains regular workspace files, view registries, pane reads,
source integrity checks, numerical checks, tool time, usage, model-request time,
and errors. Pi events omit streaming deltas, private reasoning, and signatures;
the raw session file is not duplicated. Final artifacts are saved even on model failure before
workspace cleanup. Reports may contain conversation content; review before
committing live output. Successful execution says "artifact review required",
never that the treatment won. View-title and layout evidence requires review;
the byte-preservation checker cannot judge presentation by itself. Retention
checks the required program and two documents; changing server metadata is not
a document edit. A failed mechanical artifact check produces a failing exit status
while preserving the remaining planned observations, rather than being reported
as a successful artifact.

## What the source establishes

Jade contains NumPy, PyTorch CPU/MPS, MLX CPU/Metal, Mojo/MAX CPU/Metal and jax-js
WASM/WebGPU; Rust is absent. The pinned implementation shares initialization and
shuffle fixtures, checks initial forward outputs and the first Adam update
against NumPy, and checks trained accuracy. Its saved inference timings use the
**initial untrained weights**, resident inputs and synchronized outputs, excluding
upload/readback. Compilation is separate; setup fields differ across runtimes.
These are Apple M3 Max records, not new measurements on the user's MacBook or in this
Linux cloud workspace. They do not establish fresh app launch-to-prediction time.

For the revised application, the next experiment should launch a fresh process
with a trained checkpoint, pass one digit through the intended preprocessing and
input/output path, and stop timing only when the prediction is available to the
caller. Record per-attempt exit/result, environment and source/checkpoint hashes,
multiple fresh processes, plus separately identified setup/compilation if
instrumented. Fresh process does not imply cold OS/driver/compiler caches. Reuse
Jade's adapter and validation rather than training inside the timed startup path.
Actual app UI startup may require a further native measurement.

## Execution record

Cloud Linux x86_64, Node 24.19.0, Go 1.22.12, Pi 0.85.0, Herdr 0.9.0.
Go build/test/vet passed. The six focused numerical/retention/deadline tests passed.
Preparation succeeded against pinned Jade. The full Node suite: 13 pass, 19 fail;
the required extension benchmark: 1 pass, 2 fail. All those failures hit Herdr's
workspace API with `Operation not permitted`, including unchanged launcher tests.
These are failed gates, not passing workspace or native Terminal/Ghostty checks.
Pi's separate `get_available_models` RPC succeeded and returned an empty list.

The attempted ordinary arm failed during Herdr fixture startup, before creating
a Pi session or submitting any model request; the other arms were not run.
[Failure and source hashes](../benchmarks/results/mnist-cloud/failed-attempt.json),
[attempt protocol](../benchmarks/results/mnist-cloud/attempt-protocol.json), and
[validation record](../benchmarks/results/mnist-cloud/validation.txt) preserve this
attempt. Attempt hashes describe the pre-attempt source, before this results note
was filled. The Jade archive is reproducible from its recorded commit and hash.
The initial global Pi install failed on a symlink permission; installing into a
scratch prefix succeeded. Herdr's downloaded binary matched CI's pinned SHA-256.

Two implementation/check rounds added strict row and retention checks, then a
changed-input probe and whole-request deadline with close-on-failure tests.
No runtime behavior was changed. No treatment improvement, application speedup,
or reader-transfer improvement was measured. The live runner's successful full
path remains unverified. Next requirement: execute the paired command in a
workspace permitting Herdr's local workspace API, with Pi authenticated there;
then review the generated artifacts and run the real reader-transfer task.
Apple app startup and native rendering still require the MacBook.

Subsequent GitHub CI passed the complete cloud-built revision: Go race/test/vet/
build, all 32 Node tests with the extension benchmark enabled, and all 64 Herdr
operation checks. Local review then added a seventh focused check and evaluator
corrections. [Local follow-up and interrupted attempts](mnist-results.md) explain
what was observed; they do not establish a completed paired comparison.
