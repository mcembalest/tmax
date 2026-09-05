# tmax

Pi with tmux tools. A small launcher and extension, not another agent harness.

Pi owns the interactive editor, streaming, model connections, persistent sessions,
compaction, and tool loop. tmux owns the panes. tmax connects them.
No character, personality, theme, or custom chat interface is defined here.

## Install

Requires macOS or Linux, Go 1.22+ to install/build, tmux, and **Pi 0.85.0**
(the version tested here). The npm installation of Pi requires Node 22.19+.
Install dependencies once. On macOS with [Homebrew](https://brew.sh/) already
installed, skip any packages you already have:

```sh
brew install go node tmux
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.85.0
```

On Linux, install Go, Node/npm and tmux through your preferred package manager
(check the versions above), then use the same npm command.

Log in once through Pi:

```sh
pi
```

Inside Pi, run `/login` and select **OpenAI Codex** to use your ChatGPT Plus/Pro
subscription. Then use `/model` to choose an available model; press Ctrl+S in
the picker to save it as the startup default. Exit Pi when finished.
This is Pi's login flow, not the `codex login` shell command. The Codex CLI is
not required. Other Pi providers also work; see [Pi's instructions](https://pi.dev/).

Install the current rewrite directly at the tested commit, without cloning:

```sh
go install github.com/mcembalest/tmax@6eb0424
export PATH="$(go env GOPATH)/bin:$PATH"
tmax
```

Go version queries cannot contain `/`, so `@codex/pi-runtime` is not a valid
installation command. Use the commit above, or clone the branch as shown below.

Add that PATH line to your shell startup file (usually `~/.zshrc` on macOS) to
keep it in new terminals. If you configured a custom `GOBIN`, add that directory
instead. Launch `tmax` from the project directory you want it to work in.

Alternatively, clone the review branch and install from the checkout:

```sh
git clone --branch codex/pi-runtime https://github.com/mcembalest/tmax.git
cd tmax
go install .
export PATH="$(go env GOPATH)/bin:$PATH"
tmax
```

Or build and run directly from that checkout without installing onto PATH:

```sh
go build -o bin/tmax .
./bin/tmax
```

While PR #1 is under review, `go install github.com/mcembalest/tmax@latest`
still selects the old implementation on `main`. After the rewrite is merged,
that becomes the normal installation command. A commit install stays pinned;
choose a newer commit to update. For a checkout, pull the desired changes and
rerun `go install .`. Pi and tmux updates are separate.

Go is needed to build, not to run the result. Pi and tmux are separate runtime
dependencies; `go install` installs only tmax. tmax does not install dependencies
or manage your login for you. The TypeScript extension is embedded in the Go
executable and extracted to a versioned file in your user cache when launched.

## Use

Launch in Apple Terminal or Ghostty from the project you want to work in.
Pi arguments pass through: `tmax --resume`, `tmax --continue`, `tmax --model ...`.
A launch creates a new tmux workspace; inside tmux, it runs Pi in the current pane.
Each Pi process retains its session across messages. Pi saves sessions for resume.

Try:

- “Make a 2×2 grid.” One workspace tool call, without source-code investigation.
- “Replace the three shells with updating displays, keeping these four panes.”
- “Run this repo's tests in a visible output pane and explain the result.”
- “Open a shell for me.” Or use `/shell` directly.
- “Fork an agent into another pane to review the README.”

Instant commands (no model call):

| Command | Action |
| --- | --- |
| `/grid 2x2` | Fill to four total panes and tile them. `/grid 6` fills to six. |
| `/panes` | Show pane IDs, positions, sizes, roles, exit state and focus. |
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
| `pane_list` | Inspect pane IDs, geometry, roles, titles, current process and exit state. |
| `pane_focus`, `pane_resize`, `pane_title`, `pane_swap`, `pane_zoom` | Direct workspace controls. |
| `pane_close` | Close a requested pane, with current-window and agent-pane checks. |
| `pane_shell` | Open your interactive shell without taking focus. |
| `pane_run` | Run a finite command, show live output, return output and exit status during the same agent turn. |
| `pane_start` | Start a display or server in a specified existing tmax shell/display pane. Returns initial output promptly; preserves layout and focus. |
| `pane_stop` | Stop a managed display without removing its pane; return its last output. |
| `pane_read` | Read recent visible text from a pane in the same window. |
| `pane_fork` | Start an independent interactive Pi session from the saved parent history, with a specific task. |

Output panes accept focus, scrolling and selection, but no process input.
Commands run with local user permissions, **not in a sandbox**. Read-only refers
only to terminal input. Shells are replaced only by an explicit `pane_start`
takeover, with `replace=true` when a process is still alive.
Pi still has its normal built-in tools, including bash.

Pane headers show the pane ID and title. `pane_start` runs a POSIX `/bin/sh`
command in the pane's real terminal, so terminal dimensions and redraws work.
For complex displays, have the agent write a small script and start it instead
of nesting shell quoting. Startup includes a 100 ms observation window; later
failures appear through `pane_read`, which includes exit status for retained
dead panes. There is no automatic background monitoring or model call.
Use `interactive=true` for a process you want to click into and type in.

Display completion and `pane_stop` retain the pane, so the layout stays intact.
Displays belong to the tmux workspace and survive Pi reloads; stop or close them
explicitly. Stopping uses tmux's process termination and is covered for ordinary
shell children; programs that deliberately detach into daemons must manage their
own shutdown. Taking over a shell does not preserve its previous process for undo.

Visible commands default to a 120-second timeout (up to 600). Canceling the Pi
tool kills the command's process group. Output returned to the agent is capped
at the last 32 KB; the pane retains its log until cleared. `/clear-output` closes
this agent's output panes and removes their temporary logs; normal Pi session
shutdown does the same. Abrupt process termination may leave temporary logs.

Forks are explicit and share the project files. They copy saved history, not a
live shared conversation. The child stays interactive; no automatic result
aggregation or file isolation is implemented. Finite commands belong in
`pane_run`; long-running displays/servers use `pane_start` or your own shell.

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
read-only behavior under both terminal environment values. They also populate
three existing panes, inspect startup and failures, stop descendants and replace
a display without changing the four-pane layout. Native Terminal and
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

The first measures ten fresh 2×2 grid creations and display startup, enforcing a generous 2-second
local-action regression budget. CI runs it on every push and PR and uploads the
timing samples. Set `TMAX_BENCH_OUTPUT` to save the report to a JSON file.
The second additionally times a natural-language grid request and asserts exactly
one `pane_grid` call, then requests three displays in the existing panes and
checks tool selection, output and pane count. It uses medium
thinking. Live latency depends on provider conditions and is reported, not gated.

On the development machine, the current local grid runs measured a 97 ms median;
display startup measured 144–150 ms including the 100 ms initial observation.
An earlier live gpt-5.6-luna/medium request measured 5.9 seconds and one
tool call, compared with 36.5 seconds and ten calls in the earlier user transcript.
This is an indicative comparison, not a controlled or statistically stable model
benchmark; context and provider conditions can differ.

References: [Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md),
[Pi sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md).
