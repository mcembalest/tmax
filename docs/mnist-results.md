# MNIST pilot: results

Two complete pairs ran on 15 September 2026: ordinary/joint, then joint/ordinary,
using one Luna/medium Pi session per arm. All 16 turns completed and all mechanical
checks passed. Artifact review found useful work and remaining interpretation
gaps in both conditions. These four sessions do not establish an advantage for
the extra perspective instruction. Production behavior remains unchanged.

## Complete paired pilot, 15 September

The same pinned Jade source, four requests and tools were used in every session.
Local environment: Apple M3 Max, macOS arm64, Node 25.1.0, Pi 0.85.1, Herdr 0.9.0.
These are agent/workspace measurements over recorded MNIST data, not new backend
performance measurements. No corrective user turns or clarification requests were
needed. Ordinary pair 0 self-corrected two tool errors; joint pair 1 encountered
one failed git command. All original tool errors remain in the records.

| Pair / condition | Build (s) | Rename (s) | Revise (s) | Gather (s) | Total (s) | Reported output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 ordinary | 63.34 | 3.57 | 38.09 | 2.90 | 107.90 | 4,736 |
| 0 joint | 57.56 | 4.02 | 44.56 | 4.14 | 110.27 | 4,844 |
| 1 joint | 56.98 | 3.62 | 116.54 | 5.29 | 182.42 | 4,439 |
| 1 ordinary | 67.79 | 4.44 | 36.50 | 4.11 | 112.84 | 4,859 |

Times are whole model requests, including tools. They are not isolated model
compute times. Pi-reported input, cached input and output usage are retained in
[the summary](../benchmarks/results/mnist-20260915-paired/summary.json). The longer
joint revision is one observed request, not proof of a treatment latency effect.
Both sessions in each pair were sequential; there were no concurrent local
benchmark jobs. The session pairs share a model/service and are not independent
statistical samples.

| Workspace operation | Local tool duration | Request to tool completion | Full response |
| --- | ---: | ---: | ---: |
| Create each document view | 164–361 ms | Includes building the artifact first | 57–68 s for the whole build request |
| Rename the existing view | 26–45 ms | 2.19–3.07 s | 3.57–4.44 s |
| Gather into the conversation | 10–16 ms | 1.61–2.69 s | 2.90–5.29 s |

Request-to-tool time is derived from Pi agent-start and tool-end events. It measures
workspace-tool acknowledgement, not native pixels. One joint revision also called
show_view twice to refresh views that already watch their source files (53/87 ms).
No local action duration is substituted for a full user-request duration.

Every adapter read its supplied input, emitted all 27 recorded inference rows,
and handled changed numbers plus a new backend/batch. Reference trees remained
unchanged. The title-only request kept the documents byte-identical and preserved
pane/terminal identities and the other title. Gathering preserved the program,
both documents, saved view registries and pane/terminal identities, with the
conversation focused and zoomed. The live run establishes retained views; the
separate headless view regression exercises actual reopening after reload.

## What artifact review found

| Condition | Useful behavior | Remaining problem |
| --- | --- | --- |
| 0 ordinary | Both documents adopted the one-digit lifecycle; proposed inference-only measurements | Uses MAX benchmark setup cost against the app default without resolving its five-graph scope; calls fresh launches “truly cold” without establishing cache conditions |
| 0 joint | Correct adapter, scopes recorded inference, updates both documents | Uses unequal NumPy/PyTorch setup timers as startup evidence; proposes timing the whole training script as a startup proxy; conflates a long-lived process with batched work |
| 1 joint | Most concrete next plan: final model, fixed image, preprocessing, one printed prediction and exit | Still uses MAX setup/compilation against the default without explaining the benchmark scope; the proposed entry points and cache policy remain to be built |
| 1 ordinary | Clearly withdraws batching as the decision metric and proposes timing until prediction is available | Does not identify the initial untrained weights behind the inference table, beside reported trained accuracy; checkpoint and cache policy remain unspecified |

This was source/artifact review by Codex with arm labels visible, not blind human
review. [Detailed review](../benchmarks/results/mnist-20260915-paired/review.json)
records the reasoning rather than scoring keywords. No human transfer result or
verified app-runtime winner is claimed. The two conditions expose overlapping
weaknesses; a short perspective instruction has not earned a production change.

The smallest useful next engineering experiment is a real trained, inference-only
entry point and a fresh-process measurement on the Mac, with an explicit timing
boundary, checkpoint identity, prediction check and cache policy. Its measurements
can feed the existing views. That addresses a missing piece of evidence directly;
adding roles or agent-to-agent discussion would not supply the missing measurement.

[Protocol and source hashes](../benchmarks/results/mnist-20260915-paired/protocol.json)
and per-condition directories retain reports, public messages/tool calls, lifecycle
timestamps, generated files and saved view registries. The frozen experiment text
is saved as experiment-at-run.md; its hash matches the protocol, before results
were added to the current documentation. Unchanged snapshot copies are omitted;
reports retain every per-turn hash. Repeated reference sources
and tool-result text are omitted from committed evidence; full sanitized events
remain in the local attempt directory and their hashes are recorded. Raw session
files, private reasoning and credentials are not included.

## Earlier 90-second deadline attempt, 15 September

The first ordinary attempt completed build (62.24 s) and rename (3.88 s), then
exceeded its 90-second deadline during revision. The two document edits completed
after roughly 17 and 40 seconds; the model had not finished its response at the
cutoff. The partial recommendation still contained an old batching conclusion.
The Mac sleep log has no sleep during this attempt (10:26:47–10:29:24 UTC); this
is a real missed completion budget, distinct from the 14 September sleep failures.

[Attempt protocol](../benchmarks/results/mnist-20260915-deadline/protocol.json),
[failed report](../benchmarks/results/mnist-20260915-deadline/0-ordinary/report.json)
and partial artifacts are retained. A fresh complete pilot used a 180-second
budget in both arms; its results are not passes under the old deadline. The test
transport now accepts the whole-turn budget instead of imposing a second fixed
90-second generation limit. Defaults for other tests remain unchanged. Closing a
timed-out session before returning failure remains covered.

## Validation

Local Go build/tests/vet and all 33 headless Node tests pass, including the seven
focused numerical, retention and deadline checks. The separate extension benchmark
passes all three tests (311/325 ms for its local operation sequence). Apple Terminal and Ghostty coverage is
headless environment/lifecycle coverage, not native application rendering.

## 14 September: completed exploratory review

An ordinary Luna/medium Pi conversation reviewed Jade's real recorded evidence,
created two useful views, changed a display unit, revised its recommendation for
one digit per launch, and gathered the views. It needed no corrective user turn.
The saved files contain correct numerical conversions and mark Rust unmeasured.

Its recommendation also illustrates a substantive interpretation problem. It
described MAX's roughly 7.2/61.5 seconds of benchmark setup as a decisive mismatch
for the proposed app. Those setup totals include five graphs for training and
several inference batch sizes. They do not measure launching a trained,
inference-only application. A caveat elsewhere about missing app startup
measurements does not make that stronger conclusion valid. A provisional NumPy
choice can still be reasonable; a demonstrated startup winner is unavailable.

The reference code also imports NumPy and exercises the NumPy reference before
the setup timer starts. Its setup fields must not be interpreted as equivalent
fresh-runtime startup measurements. These are reasons to inspect the measurement
boundary before advising a reader, not reasons to change the recorded numbers.

[Comparison](../benchmarks/results/mnist-local/review-ordinary-comparison.md),
[recommendation](../benchmarks/results/mnist-local/review-ordinary-recommendation.md),
[conversation and timings](../benchmarks/results/mnist-local/review-ordinary.json).
This exploratory review requested documents rather than the runnable adapter
required by the shipped pilot; it is not a completed arm of that pilot. Its
instruction and exact requests are preserved in the report.

## Interrupted attempts

The exploratory joint-perspective conversation completed its first two turns,
then encountered a model WebSocket idle timeout during the use-case revision.
The Mac entered clamshell sleep at 06:42:07 EDT during that request.

A subsequent attempt using the cloud-built runner created a partial adapter and
results document, then encountered another idle timeout. The last successful
write was at 08:26:13 EDT; the Mac's sleep log records a 397-second sleep beginning
at that time and a wake at 08:32:50, when the model error was received. An event-loop
deadline cannot execute while the host sleeps. The resulting 451-second request
duration is not a comparable model-speed observation.

The paired attempt also exposed an ambiguous output location: the prompt did not
explicitly put generated files outside the reference tree, but the grader required
root-level files. Both conditions now receive the same explicit output paths and
read-only reference instruction. The corrected paths were subsequently verified in the complete 15 September
pilot above.

[Exploratory interruption](../benchmarks/results/mnist-local/review-joint-interrupted.json),
[paired attempt](../benchmarks/results/mnist-local/paired-ordinary-interrupted.json),
[sanitized events](../benchmarks/results/mnist-local/paired-events.json),
[sleep/wake evidence](../benchmarks/results/mnist-local/interruptions.json).
Attempt protocols retain the hashes and requests used at the time; they precede
the subsequent evaluator fixes. Source archives can be regenerated from pinned
Jade; unchanged reference files are not duplicated in the committed evidence.

## Evaluator corrections and next gate

- Retention checks require the program and both documents. Changes to Herdr's
  bookkeeping are not counted as document edits, and missing required files fail.
- Mechanical check failures now produce a failing exit status. They cannot be
  mistaken for a successfully checked artifact.
- Changed-input probes include a new backend/batch as well as changed values.
  A fixed catalog must not silently omit a future implementation.
- Saved events omit streaming deltas, reasoning content, and signatures; the raw
  session is not copied alongside them.

The seven focused checks and full paired execution now pass locally. The human
transfer task remains unmeasured; do not claim a reader-understanding improvement.
Actual Mac application startup, working trained predictions, and native rendering
are separate, still-unmeasured outcomes.
