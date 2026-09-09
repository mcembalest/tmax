# Herdr migration experiment

The product direction is one character that can split across panels and reunite.
The user should not need to coordinate agent instances or move their context and
results manually. This experiment supplies persistent workspaces and one assigned-turn handoff: a
helper works in another panel and its findings return to the original conversation.
It does not merge full transcripts or support nested splitting yet.

## Ownership

- Go checks dependencies, prepares the two Pi extensions, starts a project session,
  and attaches the Herdr client. It does not run an agent loop.
- Pi owns the interface inside its panel, conversations, model calls, and finite
  command execution with cancellation and timeout.
- Herdr owns terminal processes, layout, agent presence, prompting, and waiting.
- The tmax extension supplies a direct `workspace` tool and a small `split_work`
  handoff module. It does not recreate Herdr's command catalog or Pi's agent loop.

The installed Herdr binary supplies its official Pi integration. tmax installs it
into a temporary directory and atomically caches the resulting extension, loading
it only for tmax launches. Ordinary Pi settings and extensions are not changed.
Minimum versions are Herdr 0.8.2 and Pi 0.85.0; these are the tested versions.
Newer versions satisfy the minimum check but are not thereby proven compatible.

## Leave and return

A canonical project directory identifies a dedicated Herdr session. Concurrent
launches are serialized during startup; plain `tmax` returns to a live agent.
Explicit Pi options are rejected on reconnect instead of silently ignored.

Herdr's Ctrl-B, Q detaches the client while work continues. `/quit` exits Pi;
other panels remain. `/close-workspace` closes that workspace and its processes.
After Pi quits or crashes, tmax opens Pi in a fresh tab and preserves old panels.
This avoids reusing a shell whose terminal input modes were damaged by a killed
TUI. It also avoids replacing work that the user started in the old shell.

Herdr restores layout after server restart, but those are new processes.
Automatic native conversation restore is disabled for tmax's server: Herdr 0.8.2
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
The helper panel stays open. Interactive takeover or switching its conversation
stops automatic assignment reporting; cancellation and disappearance are reported
as incomplete work. A failed launch is uncertain because canceling a CLI request
does not undo a submitted remote action.

This is a bounded first version: one assigned turn per helper, no automatic panel
cleanup, no nested splitting, and no transactional merge of concurrent file edits.
Switching away from the parent conversation defers its results until resumed.
It does not promise recovery of unfinished model calls after process death.

## Cost and network behavior

Herdr 0.8.2 is [Apache 2.0 licensed](https://github.com/herdrdev/herdr/blob/v0.8.2/LICENSE).
Its local runtime requires no Herdr account or subscription; model-provider costs
remain separate. Inspection of the released source found no built-in analytics
collector or analytics SDK. Herdr does make automatic version and detection-catalog
requests by default. tmax disables both in its private server configuration,
and starts Pi with `--offline` to disable Pi's startup network operations.
Herdr's official Pi hook communicates over the local Unix socket.

This is a source audit of 0.8.2, not a packet-level guarantee for every dependency,
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
not reproduced or conclusively explained. Keep this as a draft until startup has
been exercised further on real terminals.

A deterministic test provider now exercises the real Pi loop and Herdr helper
process: split, keep chatting, and deliver findings once. Separate lifecycle tests
cover busy parents, reload recovery, canceled turns, user takeover, and missing
agents versus transport failures. This provider is test-only; it does not verify
model judgment or tool selection. The new natural split-and-return benchmark is
blocked by expired Pi authentication and has not passed.

Remaining concerns: native rendering and mouse behavior, natural task evaluation
of handoffs, cold conversation recovery with extensions, and refreshing environment
variables in a reused server. New terminals receive current launcher variables,
but existing processes retain their environment, and variables absent from a
later launch can still be inherited from the old server. This change does not
claim to solve that environment issue.

Sources: [Herdr](https://github.com/herdrdev/herdr),
[agent automation](https://herdr.dev/docs/agent-automation/),
[session restore](https://herdr.dev/docs/session-state/), and
[pi-herdr-subagents](https://github.com/0xRichardH/pi-herdr-subagents).
