# tmax

## Install

macOS / Linux · Go 1.22+

```sh
go install github.com/mcembalest/tmax@latest
export PATH="$(go env GOPATH)/bin:$PATH"
cd /path/to/project
tmax
```

PATH: persist in shell startup file; custom `GOBIN` takes precedence over `GOPATH/bin`.

| First launch | Action |
| --- | --- |
| Missing tmux / Node | Homebrew install; commands shown; confirmation required |
| Missing Pi | npm install of Pi 0.85.0; confirmation required |
| Dependencies present | Direct launch; existing installations preserved |
| No configured provider | Pi editor prefilled with `/login`; Enter opens login |
| No Homebrew | Manual setup instructions; [Homebrew](https://brew.sh/) or system package manager |
| Non-interactive launch | Missing dependencies reported; no installation |

Pi setup:

| Command | Action |
| --- | --- |
| `/login` | OpenAI Codex → ChatGPT Plus/Pro; browser sign-in |
| `/model` | Select model; Ctrl+S saves default |

Authentication: Pi-managed · Codex CLI not required · [Other providers](https://pi.dev/)

Manual dependencies: tmux · Node 22.19+/npm · Pi 0.85.0

```sh
brew install node tmux
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.85.0
```

Linux without Homebrew: tmux and Node/npm from package manager; same Pi install command.
Updates: rerun tmax install command; Pi/tmux updates remain separate.

## Reference

| Item | Behavior |
| --- | --- |
| Terminal | Apple Terminal / Ghostty |
| Runtime | Pi: UI, models, sessions, compaction, tool loop |
| Workspace | tmux: panes, layout, input, scrollback |
| Launch | New tmux session; inside tmux: current pane |
| Directory | Active project directory preserved |
| Pi options | `tmax --resume`, `tmax --continue`, `tmax --model …` |
| Pane focus | Click / Ctrl-B then arrow |
| Scroll | Mouse wheel; tmux copy mode |
| Detach | Ctrl-B then D; processes remain running |
| Reconnect | `tmux -L tmax attach` for workspaces launched outside existing tmux |
| Permissions | Local user permissions; no sandbox |
| Read-only panes | Focus, scroll, copy; process input disabled |

## Commands

No model calls.

| Command | Action |
| --- | --- |
| `/shell` | New interactive shell |
| `/grid 2x2`, `/grid 6` | Fill to 4 or 6 total panes; tile; preserve existing processes |
| `/panes` | IDs, positions, sizes, roles, exit state, focus |
| `/layout tiled` | Rearrange existing panes |
| `/focus %3`, `/focus` | Focus pane / return to agent |
| `/resize %3 80 24` | Width × height in terminal cells |
| `/title %3 logs` | Pane header title |
| `/swap %3 %4` | Swap positions |
| `/zoom %3`, `/unzoom` | Expand pane / restore layout |
| `/stop %3` | Stop managed display; retain pane and layout |
| `/close-pane %3` | Close pane and process; agent pane protected |
| `/clear-output` | Close this agent's finite-output panes; remove logs; idle only |

Layouts: `tiled`, `even-horizontal`, `even-vertical`, `main-horizontal`, `main-vertical`.
Grid: 1–12 total panes; excess panes require explicit closure; partial progress possible.

## Agent tools

| Tool | Behavior |
| --- | --- |
| `pane_grid`, `pane_layout` | Grid creation / layout |
| `pane_list` | Geometry, roles, titles, process, exit state |
| `pane_focus`, `pane_resize`, `pane_title`, `pane_swap`, `pane_zoom`, `pane_close` | Workspace controls |
| `pane_shell` | New interactive user shell; focus preserved |
| `pane_run` | Finite command; new read-only output pane; output + exit status returned |
| `pane_start` | Display/server in existing tmax shell/display pane; layout and focus preserved |
| `pane_stop` | Stop managed display in place; return last output |
| `pane_read` | Last 100 terminal lines + pane exit state; untrusted output |
| `pane_fork` | Independent Pi session; copied saved history; shared project files |

| Execution | Details |
| --- | --- |
| Finite jobs | 120 s default timeout; 600 s maximum; last 32 KB returned |
| Cancellation | Finite job process group terminated |
| Output logs | Removed by `/clear-output` or normal Pi shutdown; abrupt termination may leave logs |
| Displays | POSIX `/bin/sh`; real PTY; 100 ms startup observation; later inspection via `pane_read` |
| Shell takeover | Live process replacement requires `replace=true`; user-requested takeover; no process undo |
| Display input | Read-only default; `interactive=true` enables typing |
| Display lifecycle | Pane retained on exit/stop; survives Pi reload; explicit stop/close |
| Detached daemons | Separate shutdown required |
| Forks | Saved session required; explicit delegation; no automatic result reporting or file isolation |

## Development

```sh
git clone https://github.com/mcembalest/tmax.git
cd tmax
go build -o bin/tmax .
./bin/tmax
```

Checkout installation: `go install .`

| Path | Contents |
| --- | --- |
| `main.go` | Go launcher; embedded extension; versioned user cache |
| `setup.go` | Dependency checks, install confirmation, installer commands |
| `extension.ts` | Pi tools and slash commands |
| `main_test.go` | Launcher regression tests |
| `tests/extension.test.mjs` | Real tmux tool tests; local benchmarks |
| `tests/pi.test.mjs` | Pi integration; optional live model checks |

Go dependencies: none. Extension dependencies: Pi installation (`jiti`, `typebox`).

```sh
go test -race ./...
go vet ./...
node --test tests/*.test.mjs
TMAX_BENCH=1 node --test tests/extension.test.mjs
```

## Test coverage

| Area | Checks |
| --- | --- |
| Launch | Existing tmux / first launch through real PTY; stub Pi; attachment, cwd, quoting, mouse, embedded extension |
| Setup | Missing dependencies, consent, failures, Node version, repeat launch; stub installers; reused tmux PATH; Pi login guidance |
| Workspace | Grids, geometry, focus, resize, swap, zoom, titles, closure, malformed commands |
| Processes | Output, exit status, cancellation, descendants, read-only / interactive input |
| Displays | Three updating displays in four existing panes; inspect, stop, replace, startup failure; layout preserved |
| Pi | Extension loading, command registration, session continuity |
| Environments | Apple Terminal / Ghostty environment values; Linux CI |
| Benchmarks | Ten grid creations; display startup; 2 s local-action regression budget |

Model calls: opt-in; OpenAI Codex login and quota required.

```sh
TMAX_LIVE=1 node --test tests/pi.test.mjs
TMAX_LIVE=1 TMAX_BENCH=1 TMAX_TEST_MODEL=gpt-5.6-luna node --test tests/pi.test.mjs
```

Live defaults: `gpt-5.4-mini` · medium thinking. Benchmark: grid + three existing-pane displays; tool selection and output checks.
Results: console; `TMAX_BENCH_OUTPUT` for grid JSON; CI artifact `grid-benchmark`.
Model latency: informational; separate from local-action timing.

Not covered: native Terminal/Ghostty rendering and mouse interaction, OS clipboard integration.

[Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) · [Pi sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
