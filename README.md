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

- “Run this repo's tests in a visible output pane and explain the result.”
- “Open a shell for me.” Or use `/shell` directly.
- “Fork an agent into another pane to review the README.”

Click panes to focus. Ctrl-B then an arrow also switches panes. Mouse wheel
scrolling uses tmux copy mode; clipboard shortcuts depend on your terminal.
Ctrl-B then D detaches; `tmux -L tmax attach` reconnects. Pi keeps running while
detached. Pi's normal interrupt and exit keys apply (see its help).

Tools added to Pi:

| Tool | Behavior |
| --- | --- |
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

References: [Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md),
[Pi sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md).
