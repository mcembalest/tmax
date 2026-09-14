# MNIST pilot: 14 September 2026

The cloud work produced a runnable paired experiment and passing GitHub CI. Local
follow-up found evaluator issues and preserved interrupted live attempts. There
is no completed paired comparison, measured treatment advantage, or human
understanding result. Production behavior is unchanged.

## Completed exploratory review

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
read-only reference instruction. This correction has not been tested in a full
live pair yet.

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

Seven focused checks pass locally. Complete the frozen paired protocol on an
awake host with Pi authentication, or in an appropriately authenticated cloud
workspace. Do not copy the user's local credentials into cloud jobs. Review
artifact meaning and run the human transfer task before claiming an improvement.
Actual Mac application startup, working trained predictions, and native rendering
are separate, still-unmeasured outcomes.
