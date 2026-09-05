# Herdr migration experiment

The product direction is one character that can split across panels and reunite.
The user should not need to coordinate agent instances or move their context and
results manually. This change supplies a workspace foundation for that direction;
it does not yet implement automatic result delivery or context merging.

## Ownership

- Go checks dependencies, prepares the two Pi extensions, starts a project session,
  and attaches the Herdr client. It does not run an agent loop.
- Pi owns the interface inside its panel, conversations, model calls, and finite
  command execution with cancellation and timeout.
- Herdr owns terminal processes, layout, agent presence, prompting, and waiting.
- The tmax extension supplies one direct `workspace` tool with literal CLI arguments
  and short guidance. It does not recreate Herdr's command catalog in TypeScript.

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
The main agent still needs to verify and collect results. Canceling a workspace
wait cancels observation, not already submitted work. Extension reload leaves
Herdr's terminals and processes intact. No in-memory job registry needs recovery.

No pi-herdr-subagents package is installed in this experiment. Its automatic
result return is relevant follow-up work; its bundled roles, workflows, and UI
should not be adopted incidentally with the workspace backend.

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

Remaining concerns: native rendering and mouse behavior, robust automatic result
return, cold conversation recovery with extensions, and refreshing environment
variables in a reused server. New terminals receive current launcher variables,
but existing processes retain their environment, and variables absent from a
later launch can still be inherited from the old server. This change does not
claim to solve that environment issue.

Sources: [Herdr](https://github.com/herdrdev/herdr),
[agent automation](https://herdr.dev/docs/agent-automation/),
[session restore](https://herdr.dev/docs/session-state/), and
[pi-herdr-subagents](https://github.com/0xRichardH/pi-herdr-subagents).
