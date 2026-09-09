# First benchmark iterations

September 8, 2026 (local date). Herdr 0.8.2, Pi 0.85.0, Node 25.1.0, macOS arm64.
These are development-machine observations, not controlled old/new model trials
or native Terminal/Ghostty rendering verification.

## Three rounds

Each local round ran 16 cases × five repetitions × two terminal environment
variants: 160 observations per round, 480 total. Cases passed in all three rounds
once benchmark-observer mistakes were corrected. The initial observer incorrectly
parsed empty command output as JSON and expected a trailing newline from an API
that trims output; those were harness errors, not product failures.

| Measurement | Round 1: baseline | Round 2: faster return | Round 3: recovery coverage |
| --- | --- | --- | --- |
| Direct workspace cases | 160/160 | 160/160 | 160/160 |
| Open beside, median including verification | 19.5 ms | 20.4 ms | 19.6 ms |
| Three-split 2×2 grid, same timing boundary | 30.4 ms | 30.1 ms | 31.1 ms |
| Close panel, same timing boundary | 33.2 ms | 34.6 ms | 35.0 ms |
| Helper result → parent delivery, fresh session | 569 ms | 98 ms | 138 ms |
| Helper result → parent delivery, forked session | 580 ms | 102 ms | 98 ms |
| Split invocation → handoff tool return | 3.08 s | 3.07 s | 3.05–3.09 s |

The handoff rows are individual samples using a deterministic, test-only provider
inside actual Pi processes with actual Herdr panels. They isolate the machinery;
they do not measure model quality, model latency, or natural tool selection. The
fixture intentionally takes three seconds to produce its helper answer; that
wait is separate from the delivery interval measured from the result file's
modification time to the parent's received-message timestamp.

The only production change is checking local result files every 250 ms instead
of every second. Agent-status CLI checks stay capped at once per second. The
small handoff samples improved by roughly 0.44–0.48 seconds; more samples and
varied completion phases are needed for stable median/tail claims. The unchanged
workspace numbers show no claimed local-action speedup.

Round 3 also passed real-process checks for restarting the parent while a helper
is running, delivering the pending result to that same saved conversation,
restarting again without duplicate delivery, and closing a helper mid-task while
preserving a usable parent. Both terminal environment variants passed restart
coverage. The final full regression run passed all 14 tests; Go build, tests,
and vet passed.

## A reproduced gap

The follow-up probe starts a reviewer, receives its initial answer, sends a
second task to that same reviewer, observes the second answer in its panel, and
waits another 1.5 seconds. Automatic result count stays at one. This is a product
gap, not a model failure: the current module tracks one assigned turn per helper.
The probe deliberately exits nonzero until the behavior improves. It is separate
from the passing regression suite so the missing capability stays visible.

The next priorities are making follow-up assignments return naturally and
understanding the roughly three-second helper startup path. The previously
recorded 5–8 model calls for a grid also remain a concern; fast local splits do
not erase that user-facing delay. No new high-level grid API was introduced
without testing its agent behavior.

## Real-model evaluation is blocked

All 20 natural-request cases have runnable setup, prompts and outcome checks.
The first request failed with “Provided authentication token is expired.” The
runner marked it and the remaining 19 cases blocked without repeating provider
requests. There are **zero completed natural-model trials in these rounds**.
After Pi authentication is refreshed, run the baseline and held-out phrasings;
do not treat the controlled provider as a substitute. These new live cases are
not yet validated end to end. Their oracles should be reviewed against the first
successful transcripts, especially concurrency and semantic integration.

## Evidence

Raw local samples:
[round 1](../benchmarks/results/round1-local.json),
[round 2](../benchmarks/results/round2-local.json),
[round 3](../benchmarks/results/round3-local.json).

Real-process handoff runs:
[round 1](../benchmarks/results/round1-handoff.txt),
[round 2](../benchmarks/results/round2-handoff.txt),
[round 3](../benchmarks/results/round3-handoff.txt),
[full regressions](../benchmarks/results/final-regressions.txt).

[Follow-up gap](../benchmarks/results/round3-followup.json) and
[blocked natural-request run](../benchmarks/results/round1-live.json).

The existing CI now runs direct workspace benchmarks as well as lifecycle tests.
It prints case outcomes and medians; it does not run paid model calls or assert
that synthetic terminal environments prove native app behavior.
