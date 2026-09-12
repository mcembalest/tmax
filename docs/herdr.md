# Herdr migration experiment

The product direction is one character that can split across panels and reunite.
The user should not need to coordinate agent instances or move their context and
results manually. This experiment supplies persistent workspaces and assigned-task handoffs: a
helper works in another panel and its findings return to the original conversation.
It does not merge full transcripts or support nested splitting yet.

## Ownership

- Go checks dependencies, prepares the two Pi extensions, starts a project session,
  and attaches the Herdr client. It does not run an agent loop.
- Pi owns the interface inside its panel, conversations, model calls, and finite
  command execution with cancellation and timeout.
- Herdr owns terminal processes, layout, agent presence, prompting, and waiting.
- The tmax extension supplies direct workspace controls, a grid operation, and a
  small delegation module with explicit follow-ups. It does not recreate Herdr's command catalog or Pi's agent loop.

The installed Herdr binary supplies its official Pi integration. tmax installs it
into a temporary directory and atomically caches the resulting extension, loading
it only for tmax launches. Ordinary Pi settings and extensions are not changed.
Minimum versions are Herdr 0.9.0 and Pi 0.85.0; these are the tested versions.
Newer versions satisfy the minimum check but are not thereby proven compatible.

Herdr 0.9.0 adds a combined client for local and saved SSH machines, independent
client views, and more reliable prompt submission. tmax uses the released binary
and its bundled Pi integration; CI verifies the pinned download checksum. Machine
connections remain Herdr's responsibility. tmax's assigned-task records and results
remain local: this update does not add cross-machine split-and-return.

Upgrading a running 0.8.2 server requires a one-time restart, which stops its pane
processes. The 0.9 client reports this protocol mismatch; tmax leaves active work
intact instead of restarting automatically. Finish that work before following the
reported restart instructions. See the [0.9.0 release notes](https://github.com/herdrdev/herdr/releases/tag/v0.9.0).

## Leave and return

A canonical project directory identifies a dedicated Herdr session. Concurrent
launches are serialized during startup; plain `tmax` returns to a live agent.
Explicit Pi options are rejected on reconnect instead of silently ignored.

Herdr's Ctrl-B, Q detaches the client while work continues. `/quit` exits Pi;
other panels remain. `/close-workspace` closes that workspace and its processes.
After the main Pi quits or crashes, tmax opens Pi in a fresh tab and preserves old
panels, even when assigned instances are still running. The launcher remembers
the main terminal's ID; changing agent or pane names does not change its identity.
Concurrent returns start one replacement. Explicit Pi options apply to that new
conversation, while returning to a live main conversation preserves focus.
This avoids reusing a shell whose terminal input modes were damaged by a killed
TUI. It also avoids replacing work that the user started in the old shell.

Herdr restores layout after server restart, but those are new processes.
Automatic native conversation restore is disabled for tmax's server: Herdr 0.9.0
restarts Pi with a session reference but drops the explicit extension arguments.
Use Pi's conversation picker to resume saved history. Live reconnect requires no
conversation selection because the original Pi process never stopped.

## Deliberate differences from the tmux version

Finite jobs now use Pi's ordinary execution tool. The old read-only output panes,
retained exit-status display, `/stop`, and `/clear-output` are not emulated.
Herdr's `pane run` submits input to a terminal; success is not a command exit code.
Live shells and displays can be opened, read, interrupted, and closed through Herdr.
They are interactive terminals, not the previous read-only output panes.

Herdr can start additional Pi agents, prompt them, inspect them, and wait for
state changes. Its waits observe lifecycle state, not individual task completion.
The main agent still needs to verify findings. Canceling a workspace
wait cancels observation, not already submitted work. Extension reload leaves
Herdr's terminals and processes intact. No in-memory job registry needs recovery.

No pi-herdr-subagents package is installed. The handoff uses native Pi fresh or
forked sessions, sharing the project files. A private assignment record beside the
parent session tracks the helper; Pi's settled-turn event writes its result. The
parent checks local results every 250 ms while idle, checks agent status at most
once per second, and records delivered IDs in its own
conversation. Reload can recover pending results without relying on pane text.
An explicit follow-up can reuse an idle helper in the same conversation and return
another result. Helpers started by the older extension need a new helper for
automatic follow-ups; they are not silently treated as compatible. Each assignment has its own result; a small active-record pointer
lets helper reload recover the current assignment. The helper panel stays open. Interactive takeover or switching its conversation
stops automatic assignment reporting; cancellation and disappearance are reported
as incomplete work. A failed launch is uncertain because canceling a CLI request
does not undo a submitted remote action.

This remains bounded: assignments return one settled turn at a time, with no
automatic panel cleanup, nested splitting, or transactional merge of concurrent
file edits. A follow-up cannot reset the existing helper's conversation.
Switching away from the parent conversation defers its results until resumed.
It does not promise recovery of unfinished model calls after process death.

## Cost and network behavior

Herdr 0.9.0 is [Apache 2.0 licensed](https://github.com/herdrdev/herdr/blob/v0.9.0/LICENSE).
Its local runtime requires no Herdr account or subscription; model-provider costs
remain separate. Inspection of the released source found no built-in analytics
collector or analytics SDK. Herdr does make automatic version and detection-catalog
requests by default. tmax disables both in its private server configuration,
and starts Pi with `--offline` to disable Pi's startup network operations.
Herdr's official Pi hook communicates over the local Unix socket.

This is a source audit of 0.9.0, not a packet-level guarantee for every dependency,
newer release, or user-installed extension. Installation and explicit updates
still download software; model requests still contact the chosen provider.
Existing servers keep their loaded configuration until stopped and restarted;
tmax does not kill active work to apply these settings. See Herdr's
[configuration reference](https://herdr.dev/docs/config-reference/).

## Evidence and remaining questions

Automated tests use real Herdr and Pi for launch, concurrent return, reload, exit,
crash recovery, retained displays, cancellation of waits, and workspace closure.
Both Apple_Terminal and ghostty environment variants preserve the project folder.
A PTY smoke check verified actual client detach/reconnect with a running display.
These are not native Terminal/Ghostty rendering checks: computer-use access to
both native apps was denied during this evaluation.

A natural 2x2-panel request succeeded in two runs: five workspace calls in 17.6
seconds and eight calls in 26.4 seconds, including model latency. The latter also
checked the actual 2x2 geometry. The local split/run/read/reload/interrupt/close scenario
measured about 0.33 seconds, including intentional timeout/cancellation waits.
These are single-run observations, not a controlled comparison against tmux.

One earlier combined-suite launch exceeded the test's 45-second deadline without
a diagnostic; subsequent isolated and full-suite runs passed. Version checks and
integration preparation now have bounded deadlines, but the original stall was
not reproduced or conclusively explained. Native terminal startup checks remain
outstanding.

The later reopen regression found a separate, reproducible launcher error: a
surviving helper prevented replacement of a main Pi that had exited. Terminal
identity now distinguishes them. Both environment variants cover quit/crash,
concurrent reopen, retained process and terminal IDs, renamed instances, explicit
Pi options, and adoption of older live sessions. All 22 headless tests pass;
the expanded launcher check also passes separately. Four reopen samples took
3.30–3.35 seconds, including Herdr's startup delay and no model call. See the
[before/after evidence](../benchmarks/results/reopen.txt). These are local
observations, not native rendering checks or latency guarantees.

A deterministic test provider now exercises the real Pi loop and Herdr helper
process: split, keep chatting, and deliver findings once. Separate lifecycle tests
cover busy parents, reload recovery, canceled turns, user takeover, and missing
agents versus transport failures. This provider is test-only; it does not verify
model judgment or tool selection. Authentication was subsequently refreshed; natural requests now run with
GPT-5.6 Luna at medium reasoning. The earlier GPT-5.4 Mini model was rejected for
this account. See the later live rounds in benchmark-results.md.

Remaining concerns: native rendering and mouse behavior, broader repeated live
evaluation of handoffs, cold conversation recovery with extensions, and refreshing environment
variables in a reused server. New terminals receive current launcher variables,
but existing processes retain their environment, and variables absent from a
later launch can still be inherited from the old server. This change does not
claim to solve that environment issue.

Sources: [Herdr](https://github.com/herdrdev/herdr),
[agent automation](https://herdr.dev/docs/agent-automation/),
[session restore](https://herdr.dev/docs/session-state/), and
[pi-herdr-subagents](https://github.com/0xRichardH/pi-herdr-subagents).

The live benchmark exposed excess model round trips for ordinary controls. The
agent now receives a current workspace snapshot as turn context, outside the
system prompt, and can fill an aligned grid in one tool call. Grid creation does
not close existing terminals or repair incompatible split geometry. Prompt-cache
effects remain unmeasured. Herdr 0.9.0 also has a fixed three-second startup settle
delay; tmax does not bypass that readiness path.

For immediate layout changes, Pi's `/grid` command fills a 2×2 grid directly,
without a model call. `/grid 2 3` requests two rows and three columns. It shares
the same operation as the agent tool, preserves terminals and focus, and rejects
incompatible layouts and overlapping grid operations. Ordinary language still
goes to Pi, with the user's chosen model and reasoning setting; there is no
keyword router or automatic model switch.
