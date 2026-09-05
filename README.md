# tmax

Pi with tmux tools. A small launcher and extension, not another agent harness.

Pi owns the interactive editor, streaming, model connections, persistent sessions,
compaction, and tool loop. tmux owns the panes. tmax connects them.
No character, personality, theme, or custom chat interface is defined here.

## Install

Requires macOS or Linux, tmux, and **Pi 0.85.0** (the version tested here).
Install Pi following [its instructions](https://pi.dev/), then run `pi` and use
`/login` and `/model` to set it up. tmax uses those existing settings; it does
not use the Codex CLI or select a model for you.

```sh
go install github.com/mcembalest/tmax@latest
tmax
```

For the current checkout:

```sh
go install .
tmax
```

While this rewrite is under review, use the checkout instructions or install
`github.com/mcembalest/tmax@codex/pi-runtime`; `@latest` still selects `main`.

Go's install directory must be on PATH. Go is needed to build, not to run the
result. Pi and tmux are separate runtime dependencies; `go install` installs
only tmax. The TypeScript extension is embedded in the Go executable and
extracted to a versioned file in your user cache when launched.

## Use

Launch in Apple Terminal or Ghostty from the project you want to work in.
Pi arguments pass through: `tmax --resume`, `tmax --continue`, `tmax --model ...`.
A launch creates a new tmux workspace; inside tmux, it runs Pi in the current pane.
Each Pi process retains its session across messages. Pi saves sessions for resume.

Try:

- “Make a 2×2 grid.” One workspace tool call, without source-code investigation.
- “Run this repo's tests in a visible output pane and explain the result.”
- “Open a shell for me.” Or use `/shell` directly.
- “Fork an agent into another pane to review the README.”

Instant commands (no model call):

| Command | Action |
| --- | --- |
| `/grid 2x2` | Fill to four total panes and tile them. `/grid 6` fills to six. |
| `/panes` | Show pane IDs, positions, sizes, input state and focus. |
| `/layout tiled` | Rearrange existing panes. Also: `even-horizontal`, `even-vertical`, `main-horizontal`, `main-vertical`. |
| `/focus %3` | Focus a pane. `/focus` returns to the agent. |
| `/resize %3 80 24` | Request width and height in terminal cells. |
| `/title %3 logs` | Set a pane title. |
| `/swap %3 %4` | Swap two pane positions. |
| `/zoom %3`, `/unzoom` | Expand a pane, or restore the window. |
| `/close-pane %3` | Close that pane and its process; cannot close this agent. |

Grid creation preserves existing processes and focus, and refuses to remove
extra panes. If the window is too small, it reports partial progress so the
agent can inspect the actual state. Natural-language requests still need model
inference; tmax does not change your selected model or thinking setting.

Click panes to focus. Ctrl-B then an arrow also switches panes. Mouse wheel
scrolling uses tmux copy mode; clipboard shortcuts depend on your terminal.
Ctrl-B then D detaches; `tmux -L tmax attach` reconnects. Pi keeps running while
detached. Pi's normal interrupt and exit keys apply (see its help).

Tools added to Pi:

| Tool | Behavior |
| --- | --- |
| `pane_grid`, `pane_layout` | Create a tiled grid in one call, or rearrange existing panes. |
| `pane_list` | Inspect pane IDs and current geometry. |
| `pane_focus`, `pane_resize`, `pane_title`, `pane_swap`, `pane_zoom` | Direct workspace controls. |
| `pane_close` | Close a requested pane, with current-window and agent-pane checks. |
| `pane_shell` | Open your interactive shell without taking focus. |
| `pane_run` | Run a finite command, show live output, return output and exit status during the same agent turn. |
| `pane_read` | Read recent visible text from a pane in the same window. |
| `pane_fork` | Start an independent interactive Pi session from the saved parent history, with a specific task. |

Output panes accept focus, scrolling and selection, but no process input.
Commands run with local user permissions, **not in a sandbox**. Read-only refers
only to terminal input. Your shell panes never receive commands from these tools.
Pi still has its normal built-in tools, including bash.

Visible commands default to a 120-second timeout (up to 600). Canceling the Pi
tool kills the command's process group. Output returned to the agent is capped
at the last 32 KB; the pane retains its log until cleared. `/clear-output` closes
this agent's output panes and removes their temporary logs; normal Pi session
shutdown does the same. Abrupt process termination may leave temporary logs.

Forks are explicit and share the project files. They copy saved history, not a
live shared conversation. The child stays interactive; no automatic result
aggregation or file isolation is implemented. Finite commands belong in
`pane_run`; long-running servers and interactive programs belong in your shell.

## Development

Two runtime source files:

- `main.go`: launch tmux and Pi; embed and load the extension.
- `extension.ts`: Pi tools for panes, visible commands and session forks.

No Go dependencies, package manager manifest, custom agent loop, model adapter,
or custom conversation store. The extension uses Pi's installed dependencies.

```sh
go build -o bin/tmax .
go test -race ./...
go vet ./...
node --test tests/*.test.mjs
```

Extension tests require the npm installation of Pi (including its bundled jiti
and typebox dependencies), Node, and tmux. They create disposable tmux servers
and exercise actual commands, output, cancellation, user input, focus, and
read-only behavior under both terminal environment values. Native Terminal and
Ghostty rendering/mouse interaction still need manual checks. No model calls
are made by default.

Optional live check: `TMAX_LIVE=1 node --test tests/pi.test.mjs`. This uses Pi's
OpenAI Codex provider with `gpt-5.4-mini` for two messages in one process, checking
that a visible command's output reaches the agent and survives into the next turn.
It requires that provider to be signed in and uses model quota.

Benchmarks:

```sh
TMAX_BENCH=1 node --test tests/extension.test.mjs
TMAX_LIVE=1 TMAX_BENCH=1 TMAX_TEST_MODEL=gpt-5.6-luna node --test tests/pi.test.mjs
```

The first measures ten fresh 2×2 grid creations and enforces a generous 2-second
local-action regression budget. CI runs it on every push and PR and uploads the
timing samples. Set `TMAX_BENCH_OUTPUT` to save the report to a JSON file.
The second additionally times a natural-language grid request and asserts exactly
one `pane_grid` call, with no source reads or shell investigation. It uses medium
thinking. Live latency depends on provider conditions and is reported, not gated.

On the development machine, ten local grid runs measured a 77 ms median and an
81 ms maximum. One live gpt-5.6-luna/medium request measured 5.9 seconds and one
tool call, compared with 36.5 seconds and ten calls in the earlier user transcript.
This is an indicative comparison, not a controlled or statistically stable model
benchmark; context and provider conditions can differ.

References: [Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md),
[Pi sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md).
