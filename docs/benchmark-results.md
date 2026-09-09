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
At that revision the probe deliberately exited nonzero. The later live work below
adds follow-up support and the probe now passes. It is separate
from the passing regression suite so the missing capability stays visible.

At the end of the initial local rounds, the next priorities were making follow-up assignments return naturally and
understanding the roughly three-second helper startup path. The previously
recorded 5–8 model calls for a grid also remain a concern; fast local splits do
not erase that user-facing delay. No new high-level grid API was introduced
without testing its agent behavior.

## Initial real-model block (subsequently resolved)

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

## After authentication: real-model rounds

Authentication was refreshed. The account rejected GPT-5.4 Mini, so the new
baseline uses [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
with medium reasoning throughout. These results are not comparable to the older
Mini timings as a controlled model comparison. The first compatibility probe
succeeded; the benchmark now stops on an unsupported model instead of repeatedly
submitting cases.

| Round | Scope | Outcome |
| --- | --- | --- |
| Live 1 | All 20 original phrasings, Terminal environment | 15 automated passes; 4 behavioral failures and 1 overstrict checker |
| Checker correction | Disagreement case, unchanged runtime | Passed; both opinions were returned and accurately contrasted |
| Live 2 | Six cases targeted by fixes, original phrasings | 5/6 passed; the unquoted multiword rename still failed |
| Live 3 | All 20 held-out phrasings, Ghostty environment | 19/20 passed; the rename case still failed |
| Live 4 | Follow-up, another phrasing | Passed without the context-argument retry |
| Rename clarification | Three explicit quoted labels, no runtime change | 3/3 passed without delegation |

The disagreement checker had wrongly required random fixture identifiers in the
final answer. Those identifiers were incidental to the requested disagreement.
Both returned findings and the original final answer correctly distinguished
release from hold. The raw failed run is retained with a review note, and a
separate corrected run passed. It is not presented as a product fix.

Changes driven by these runs:

- A small grid module fills rows/columns while preserving terminals and focus.
  It handles complete and aligned partial grids, and rejects incompatible
  existing geometry before mutating it. It does not silently close extra panels.
- Current pane identities, labels, state and geometry arrive as turn context.
  This helps distinguish workspace requests from application-code requests.
  Common native command syntax is provided; no benchmark labels or phrasing
  triggers are added to production code. Cache effects remain unmeasured.
- Explicit follow-ups can reuse a returned, idle helper in the same conversation
  and automatically deliver a new result. Assignment pointers survive helper
  reload. Context selection applies only to new helpers, avoiding an unnecessary
  retry when a follow-up includes a context argument.
- Helpers inherit the parent's reasoning setting. Fresh and forked helper
  sessions live with their assignment records. Prompting or waiting on one's
  own agent panel is rejected.

| Task | Original live sample | After changes, original wording | Held-out wording |
| --- | --- | --- | --- |
| Fresh 2×2 grid | 15.0 s / 5 calls | 8.0 s / 1 call | 4.9 s / 1 call |
| Complete partial grid | 13.5 s / 4 calls | 5.7 s / 1 call | 4.8 s / 1 call |
| Rename a panel | 11.4 s / 4 calls | — | 5.5 s / 1 call |
| Enlarge named panel | Unrequested reviewer, then correction | 7.5 s / 1 call | 7.2 s / 1 call |
| Stop a display | 20.1 s / 7 calls | — | 4.8 s / 1 call |
| Close display | 10.0 s / 2 calls | — | 6.8 s / 1 call |
| Receive findings after parent restart | Failed | 26.4 s | 15.7 s |
| Same-reviewer follow-up | No automatic second result | 17.1 s | 18.9 s |

These are individual end-to-end task samples, not medians or latency guarantees.
Some diagnostic runs overlapped, and provider conditions, cache state, wording,
and terminal environment differed. The grid tool itself took 39 ms in live round
2; almost all of its task time was outside that local operation. A final follow-up
run took 15.5 seconds overall with a 19 ms assignment tool call, no new panel, and
no validation retry; additional parent file inspection remained.

The original restart failure returned an unexpected takeover status and led the
parent into inspection/waiting. It did not recur in the later two live runs, and
mechanical restart regressions pass, but its original cause was not conclusively
isolated. Keep this as evidence to investigate if it recurs, not a proven fix for
every recovery path.

Remaining visible friction:

- Unquoted phrases such as “Name the scratch panel copy work” were misread; the
  held-out equivalent targeted the wrong panel. Quoted label requests succeeded
  without changing production code. The original failures remain in the score.
- A vague request for a bottom terminal still caused unnecessary source listing
  and took 18.8 seconds. The agent sometimes repeats the reviewer's file reads.
- Fresh helper startup still takes about three seconds. Herdr 0.8.2 defines
  AGENT_START_SETTLE_DELAY as three seconds in src/app/agents.rs; bypassing its
  readiness path was not part of this change.
- More repetitions and native rendering checks are still needed. No claim is
  made that every phrasing, lifecycle edge, or newer dependency is reliable.

Final validation: 20 headless regressions, Go build/tests/vet, and the direct local
benchmark passed. The new grid regression covers multiple shapes under both
terminal environments, repeated requests, preservation and incompatible geometry.
Real-process follow-up, helper-reload, and legacy-helper compatibility regressions
were added. Existing helpers from the older extension are rejected for automatic
follow-ups instead of silently promising delivery they cannot perform.

Live evidence: [baseline](../benchmarks/results/live-round1.json),
[corrected checker](../benchmarks/results/live-round1-oracle-check.json),
[targeted fixes](../benchmarks/results/live-round2.json),
[held-out round](../benchmarks/results/live-round3-heldout.json),
[final follow-up](../benchmarks/results/live-round4-followup.json), and
[rename clarification](../benchmarks/results/rename-clarification.json).

Mechanical evidence: [follow-up probe](../benchmarks/results/followup-round2.json),
[local samples](../benchmarks/results/local-after-live-fixes.json), and
[final regressions](../benchmarks/results/live-final-regressions.txt).

## Immediate grid command and Herdr 0.9.0

The earlier eight-second grid task spent only 39 ms in the layout tool. Pi's
`/grid` command now calls that same operation directly, defaulting to 2×2;
`/grid 2 3` requests two rows and three columns. There is no model request or
natural-language keyword matching. The regression enforces a two-second deadline,
checks actual geometry, retained terminals/focus, repeated requests, invalid sizes,
and zero model turns.

Twenty command samples across two runs and both terminal environments measured
**37–48 ms, median 43 ms**. These include Pi RPC command dispatch and independent
Herdr layout verification, exclude startup, and are not native rendering timings.
Natural-language grid requests still use Pi normally. With Luna / low, three
phrasings produced the layout in **1.94, 1.88, and 2.66 seconds**; final responses
took **3.03, 3.11, and 5.21 seconds**. A partial-grid request took 2.53 seconds to
the layout. These are individual diagnostics, not a two-second model guarantee.
The user's model and reasoning defaults are unchanged. A medium-reasoning sample
on 0.9.0 still took 6.06 seconds to the layout and 10.36 seconds to finish.

The dependency minimum and checksum-pinned CI binary are now Herdr 0.9.0. All
22 headless regressions and 160 direct workspace observations passed, as did
Go build/tests/vet. Natural grid, delegate-and-return, and same-reviewer follow-up
checks passed on 0.9.0. The latter two took 26.6 and 19.5 seconds overall; extra
parent file reads remain visible in their traces. Runtime versions are now
recorded by both benchmark runners.

Additional manual checks used actual PTY client attach/detach/reattach under both
terminal environments and verified the display process survived. An initial
attempt to run the PTY wrapper through pipes was unsupported; the successful check
used a real PTY. Native Terminal/Ghostty rendering and remote SSH operation remain
unverified. A 0.9 client correctly rejected a running 0.8.2 server with a protocol
mismatch and left its terminal intact. Restarting that old server stops processes;
tmax does not perform that restart automatically.

Evidence: [command samples](../benchmarks/results/herdr09-grid.json),
[natural requests at low reasoning](../benchmarks/results/herdr09-natural-low.json),
[live upgrade checks](../benchmarks/results/herdr09-live.json),
[local observations](../benchmarks/results/herdr09-local.json), and
[regressions](../benchmarks/results/herdr09-regressions.txt).
