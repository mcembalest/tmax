# tmax functional latency

This suite measures tmax as a multiplexed workspace and as an agent that can
split and return findings. It does not benchmark Pi's arithmetic, file editing,
or general reasoning. There are 36 cases: 16 direct workspace operations and 20
natural-request cases. The latter use trivial fixture content so reasoning is
not the challenge.

## Direct workspace operations

`benchmarks/local.mjs` invokes the installed tmax extension against a real,
isolated Herdr server. Each repetition follows a known sequence of states; setup
and cleanup are outside timings. Five repetitions under each of Apple_Terminal
and ghostty give ten samples per case. All servers, processes and files belong
to disposable fixtures.

| ID | Operation |
| --- | --- |
| W01 | Inspect the current panels |
| W02 | Open a shell beside the conversation, preserving cwd/focus |
| W03 | Open below an existing panel |
| W04 | Create an actual 2×2 grid through three direct splits |
| W05 | Inspect an existing grid without changing it |
| W06 | Rename a panel |
| W07 | Move focus to a neighbor |
| W08 | Enlarge one panel |
| W09 | Restore the other panels |
| W10 | Resize a split |
| W11 | Swap two panels |
| W12 | Start a visible display and observe its first output |
| W13 | Read current display output |
| W14 | Interrupt a display and verify its shell is usable |
| W15 | Close a panel |
| W16 | End a bounded output wait while preserving its panel |

Timing ends after an independent observer verifies the effect. `elapsedMs`
includes those verification calls; `cliMs` records extension CLI time separately.
These are headless functional observations, not pixel presentation timestamps.
The grid case measures local mechanics; it does not imply a single model tool
call or an available high-level grid tool. W16 deliberately includes a 50 ms
requested wait; its latency is not comparable to an instantaneous rename.

## Real conversations

`benchmarks/requests.mjs` defines intentions and three phrasings per intention.
Variant 2 is held out from tuning. `benchmarks/live.mjs` sends ordinary requests
to real Pi, observes Herdr independently, and checks process identity, geometry,
focus, actual returned findings, and randomized context labels. It does not
route requests by keywords or require a particular tool sequence.

| ID | Requested outcome |
| --- | --- |
| A01 | A usable shell beside the conversation |
| A02 | A usable shell below the conversation |
| A03 | Four panels arranged as 2×2 |
| A04 | Complete a partial grid without restarting its display |
| A05 | Recognize an already complete grid without duplicating panels |
| A06 | Rename the intended panel |
| A07 | Temporarily enlarge the intended panel |
| A08 | Restore the previous layout |
| A09 | Stop a display while retaining its panel |
| A10 | Close a display and terminate its process |
| S01 | Delegate a small check and return its findings here |
| S02 | Carry a previously discussed, random label to another conversation |
| S03 | Two simultaneous reviewers return two distinct findings |
| S04 | Handle another workspace request while a reviewer is still running |
| S05 | Receive pending findings after restarting the original Pi process |
| S06 | Report incomplete work after the reviewer disappears |
| S07 | Follow up with the same reviewer and return its next findings |
| S08 | Recognize a user taking over a reviewer panel |
| S09 | Rename panels using words like “copy” or “team” without delegating |
| S10 | Return two conflicting perspectives instead of dropping one |

Cases are independently set up, but S02/S04/S05/S07/S08 deliberately involve
multiple interactions within the same conversation. Gated fixture commands make
concurrency observable: the original must remain useful before the helper is
allowed to finish. The deliberate gate time is recorded separately. S08 injects
an ordinary interactive input into the helper; this is not a native clicking test.

The automated oracle checks concrete outcomes, not prose quality. S10 requires
both distinct findings; a human still reviews whether the integrated explanation
actually describes the disagreement well. Retain visible transcripts for that review; opaque provider reasoning payloads
are omitted from new reports. A separate rename clarification probe preserves the
original S09 failures while checking explicit quoted labels.
S10 no longer requires incidental fixture labels in the final prose; its two
returned results and integrated explanation are reviewed together. The A05 “already done” state may be correct at time zero: response latency and
absence of mutation are the meaningful measurements there. S07 already has a
helper, so it deliberately omits a misleading helper-creation timestamp.

## Running

With the repository's tested Pi and Herdr on PATH:

```sh
node benchmarks/local.mjs benchmarks/results/local.json
TMAX_LIVE=1 node benchmarks/live.mjs benchmarks/results/live.json
TMAX_LIVE=1 TMAX_VARIANT=2 TMAX_CASES=A03,A04,A05,S01,S07,S09 node benchmarks/live.mjs benchmarks/results/held-out.json
TMAX_BENCH=1 node --test tests/pi.test.mjs tests/return.test.mjs tests/handoff.test.mjs
```

Use `TMAX_REPEATS` for direct-operation repetition count; `TMAX_TERMINAL` for the
live environment; `TMAX_TEST_PROVIDER`, `TMAX_TEST_MODEL`, and
`TMAX_TEST_THINKING` for the live provider configuration. Natural runs default to GPT-5.6 Luna / medium, require working Pi authentication,
and consume model quota. Each run freezes a copy of the extension source so edits
during a run cannot mix runtime versions. One authentication or unsupported-model failure
blocks the rest of that run instead of repeatedly submitting doomed requests.
Do not replace real-model results with scripted-provider results.

Keep the existing launcher regression suite too: launch, simultaneous return,
project cwd, reload, quit, crash recovery, and close-workspace. Client detach and
native Terminal/Ghostty interaction remain separate checks. Setting terminal
environment variables does not verify either app's rendering or mouse behavior.

## Comparing iterations

- Publish pass/fail/blocked counts against the full selected denominator. Do not
  hide a missing capability or timeout by excluding it from success counts.
- Compare the same setup, provider/model/thinking, dependencies, machine and
  terminal dimensions. Alternate old/new order for controlled comparisons.
- Report per-case samples and medians. Five live repetitions are an initial
  baseline, not evidence for stable tail latency; collect at least 20 before p90.
- Separate time to a useful effect from the final correct response. Record tool
  durations and call counts. Tool durations can overlap; never subtract their
  sum from task time and label the remainder “model latency.”
- Current live traces time parent tool events; `assistantMessages` is a count of
  completed assistant messages, not a provider-request count. It excludes helper
  requests and invisible retries. Full provider-span instrumentation is not yet
  implemented. Helper launch/result mechanics are timed separately by Pi tests.
- Preserve failed transcripts and inspect them before changing tools or prompts.
  Do not put benchmark phrasings, fixture markers, or expected answers into
  production instructions. Rotate held-out phrasings and random labels.
- Fix lost work and incorrect outcomes before optimizing speed. Prefer removing
  needless round trips to adding a catalog of special-purpose tools.

The initial local rounds, later real-model rounds, and remaining gaps are recorded in
[benchmark-results.md](benchmark-results.md). This is a benchmark specification
and implementation, not approval to change the leave-and-return product behavior.
