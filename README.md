# tmax

A small Go terminal agent and tmux workspace. No character or visual style is
specified yet. Runs inside Apple Terminal or Ghostty; JaDE can launch the same
executable in either terminal, with the active project as its working directory.

## Build and run

Requires Go 1.22+ to build, plus tmux and a signed-in Codex CLI on PATH.
The executable itself does not require Go or Python to run.

```sh
go build -o bin/tmax .
./bin/tmax
```

Try `hello`, then `open a shell pane to the right`.
Use `/split` or `/split below` to open a shell without a model call.

- `/help`: commands.
- `/quit` or Ctrl-D: exit chat. Other shell panes remain open.
- Ctrl-C during a request: cancel it; file changes already made may remain.
- Ctrl-C at the prompt: exit chat.
- Ctrl-B, then an arrow: move between panes.
- Ctrl-B, then D: detach while keeping the workspace running.
- `tmux -L tmax attach`: reattach to the most recent workspace.
- Type `exit` in shell panes to close them.

Each standalone launch creates a fresh workspace on the `tmax` tmux socket,
without loading personal tmux configuration. Inside an existing tmux session,
tmax runs chat in the current pane instead of nesting tmux.

## JaDE

For this checkout, launch `/Users/maxcembalest/Desktop/repos/tmax/bin/tmax` inside
Terminal or Ghostty, with the working directory set to the active project.
Both `tmux` and `codex` must be on that terminal's PATH. No JaDE code is changed
in this repo. Build to a stable path before using it as a launcher target.

## Backend

Uses your Codex login (`codex login`) with `gpt-5.4-mini`. Override with
`TMAX_MODEL=...`. The CLI must support `--ignore-user-config` and `--output-schema`.
Global Codex configuration is ignored so tmax's model settings stay independent.
Codex runs with `workspace-write` sandboxing and can inspect and modify the active
project. It is noninteractive; this chat does not provide an approval interface.

## Structure

Four source files, one package, no third-party Go dependencies:

- `main.go`: entry point and dependency checks.
- `agent.go`: synchronous chat and in-memory history.
- `backend.go`: Codex adapter; returns text and an optional split request.
- `terminal.go`: workspace launch and pane splitting.

Replies appear when a turn finishes, with a five-minute timeout. History lasts
while the chat process runs, including while detached; it is lost on exit.
Shell panes share the project directory. Splits open empty shells. Running work
inside them, pane inspection, subagents, streaming, and richer UI are not yet
implemented. Currently targets macOS and Linux, not Windows.

## Checks

```sh
go test ./...
go test -race ./...
go vet ./...
```

Tests cover chat history, commands, backend response validation, process errors,
cancellation, path quoting, and real tmux splits in disposable servers. Tests
exercise both `Apple_Terminal` and `ghostty` environments and verify focus and
working-directory preservation. tmux integration tests skip if it is absent.
No model calls happen in the suite. Native app rendering is not automated.

Manual acceptance in each terminal app: launch, chat, request a split, switch
panes, detach, and reattach.

Codex adapter reference: [non-interactive mode](https://developers.openai.com/codex/noninteractive).
