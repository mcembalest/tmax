# One conversation, living views

Bring something useful into view, keep talking, and gather back when you want
your attention in one place. The surrounding views can stay useful for seconds,
a whole project, or many conversations.

[Watch the 47-second demo](assets/views-demo.mp4)

![Actual Pi and Herdr terminal output after revising the plan](assets/views-four.png)

The recording uses the real Pi interface and Herdr client, with a small, explicitly
labeled planning fixture. It starts with Pi ready, includes model waits and short
reading pauses, and is not sped up. Terminal bytes were recorded through a PTY and
rasterized for playback; this is **not native Terminal/Ghostty rendering verification**.
No character artwork, personality, or new UI theme was introduced.

## What works in this slice

- Show saved Markdown content or follow an existing file beside the conversation.
  Adding views spreads 1 → 2 → 4 while preserving focus and existing terminals.
- Recall a historical record without letting new decisions overwrite its source
  through Pi's edit/write tools. Current plans and drafts remain editable. The
  agent chooses the operation from the task; there is no user-facing mode chooser.
- File changes appear automatically, including atomic replacement. A missing
  source shows a visible error and recovers when it returns. Pi supplies Markdown,
  themes, scrolling, and text selection; a view starts at the top of its document.
- Gather into the conversation without closing views or stopping their processes.
  Reveal the same layout again. Pi commands `/gather` and `/spread` skip model latency.
- Close a display and reopen its retained content later, or explicitly discard it.
  Discard never deletes an external source. Updating a view with supplied content
  writes its own saved document, leaving the original external file intact.
- Reuse saved view IDs after extension reload or Pi restart. A crashed viewer can
  reopen in a fresh pane; a pane repurposed for other work is protected from dismissal.

The Go launcher embeds two small TypeScript modules: view tools and a standalone
file viewer. There is no new model loop or runtime dependency. Pi still owns agent
execution and conversations; Herdr owns pane processes. The existing split-and-return
tools remain available when actual parallel work is useful.

Saved view records and owned documents live in tmax's per-project application data
directory, outside the source tree and extension cache. An external file stays an
external file: deleting it makes its view unavailable. Gathering keeps displays
running; closing a display stops that renderer while retaining its document.
After a server/computer restart, reopening starts a new renderer. It does not restart
data producers, restore unsaved process state, or run an old command automatically.

## Evidence and remaining friction

Local lifecycle samples on macOS with Herdr 0.9.0 and Pi 0.85.1:

| Boundary | Observed samples |
| --- | --- |
| Request → first rendered view, original SDK import | 0.45–0.59 s |
| Same boundary after importing only Pi's theme | 0.16 s (two isolated samples) |
| Source-file replacement → observed display update | 0.11–0.12 s |
| Gather invocation → verified zoom | 8–12 ms |

These are individual development-machine samples, not latency guarantees. They
exclude model time. In one live run, two simultaneous view calls completed locally
in 0.90 seconds including queueing; the natural request took 9.88 seconds to finish.
The first implementation rejected one simultaneous call and needed a model retry.
Serializing mutations locally removed that reproduced failure.

The first CI run also caught a clean-install failure: importing Pi's SDK barrel
pulled in a server package absent from the CLI installation. The viewer now imports
only Pi's packaged theme module. This both removes that dependency and reduces
startup work; the latter row above was measured separately after the fix. That
theme-module path is a Pi compatibility boundary covered by the renderer tests.

The 26 headless regressions cover both terminal environment variants, retained
terminal IDs, active project directory, source changes, scrolling, parent restart,
viewer crashes, repurposed panes, launch acknowledgement timeout, canceled queued
requests, and the Go binary's embedded renderer. Environment coverage is distinct
from native rendering. The existing direct workspace benchmark remains separate.

**History now has an enforced boundary, but recognition still depends on the model.** Several natural conversations
revised the remembered discussion to match a new decision instead of preserving
the historical record. This happened with both low and medium reasoning. General
source-preservation guidance did not eliminate it. The final recorded TUI run
preserved history and updated both current views, but one success is not a fix.

The correction adds `recall_view` alongside the existing `show_view`. Recall marks
the source as history in the saved view record. Pi's `tool_call` hook blocks edit
and write before they execute; view updates cannot rewrite or demote that record.
Protection survives dismiss/reopen and Pi restart, including relative paths,
symlinks, hard links, and a temporarily missing source. A current document can later
be recalled as history. Older records keep their previous editable behavior until
recalled. Explicit discard removes the record and its protection; it still never
deletes an external source.

New regressions deliberately request the bad history edit through the actual Pi
file tools while updating a current plan successfully. They also check aliases,
restart, missing-source recovery, owned history, and attempts to rewrite history
through view updates. The guarded update plus display verification took 42–43 ms
in two local samples, with no model call.

On the final implementation, two Astra/medium conversations passed the complete
1 → 2 → 4 → 1 → return sequence. One used different natural wording and arbitrary
filenames under the Ghostty environment. Both verified history protection before
revision, byte-for-byte source preservation at turn end, an updated current plan,
and unchanged terminal IDs after restart. First view calls took 163–173 ms locally;
the corresponding requests finished in 6.7–7.0 seconds. These are small samples,
not a model comparison or latency guarantee; the user's model defaults are unchanged.

**A Luna/low check still selected the ordinary editable view for the earlier
conversation.** The strengthened benchmark fails immediately in that case, even
if the file has not yet changed. Earlier designs with a required purpose field
also misclassified current plans as history. Those failed trials are retained.
This is therefore a concrete guard for recalled sources, not a universal solution
to shared-context semantics. It covers Pi edit/write and the view tools; it is not
an OS sandbox for shell commands, custom tools, or external writers. External
source updates still appear in the view. No filename triggers, phrase dispatch,
extra model call, or runtime dependency was added.

This slice has one conversational anchor with document views. It does not establish
continuous conversation from every pane, automatic context sharing between model
instances, autonomous refresh of web data, or superiority over Claude Code/Agent SDK
with tmux. View mutation ordering is local to each Pi extension instance, not a
cross-process transaction system.

## Reproduce and inspect

```sh
go build -o bin/tmax .
go test ./...
go vet ./...
TMAX_BENCH=1 node --test tests/*.test.mjs
TMAX_REPEATS=2 node benchmarks/local.mjs /tmp/tmax-local.json
TMAX_LIVE=1 node benchmarks/views-live.mjs /tmp/tmax-views.json
TMAX_LIVE=1 TMAX_TEST_MODEL=gpt-6-astra TMAX_VIEWS_VARIANT=paraphrase node benchmarks/views-live.mjs /tmp/tmax-views-paraphrase.json
TMAX_LIVE=1 TMAX_TEST_THINKING=medium node benchmarks/views-demo.mjs /tmp/tmax-demo
```

The live commands use the signed-in model account. The PTY recorder uses `uv`
and Python's standard library only. Default diagnostic model: Luna; runtime model
and reasoning preferences are unchanged. The recording's native terminal data and
stage timing are in [the demo evidence](../benchmarks/results/views-demo).

Live trials: [initial retry](../benchmarks/results/views-live-2.json),
[history failure found in audit](../benchmarks/results/views-live-3.json),
[low reasoning](../benchmarks/results/views-live-4.json),
[medium reasoning](../benchmarks/results/views-live-5.json).
The first [harness error](../benchmarks/results/views-live-1.json) is retained:
an assertion returned no truthy value, so the observer timed out despite a visible
view. The next checker revision also sampled too early; it now rechecks turn-end
state. These errors are not counted as product improvements.

Mechanical evidence: [full regressions](../benchmarks/results/views-regressions.txt),
[view lifecycle](../benchmarks/results/views-lifecycle.txt),
[embedded renderer](../benchmarks/results/views-packaging.txt), and
[64 direct workspace observations](../benchmarks/results/views-local.json).
The [theme-only import check](../benchmarks/results/views-theme.txt) and
[fresh Pi 0.85.0 regression run](../benchmarks/results/views-clean-install.txt)
cover the packaging correction made after the recording.

The [history correction evidence](../benchmarks/results/history/README.md)
includes both final Astra passes, the final Luna failure, exploratory failures,
26-test runs on Pi 0.85.0 and 0.85.1, and fresh direct workspace measurements.
The demo predates this correction.
