# Project conventions

- Use Go. Build with `go build -o bin/tmax .`; test with `go test ./...` and
  check with `go vet ./...`. Keep the runtime free of unnecessary dependencies.
- If Python tooling is ever needed, use uv for setup, dependencies, and execution.
  Do not use bare interpreter commands or pip workflows.
- Keep the implementation extremely small and modular. Avoid speculative abstractions.
- Reuse Pi's interactive UI, sessions, and agent runtime. Keep Go limited to the
  launcher and TypeScript limited to the Pi extension. Do not rebuild an agent loop.
- Test the extension with `node --test tests/*.test.mjs` using Pi's installed
  dependencies. The optional live check is `TMAX_LIVE=1 node --test tests/pi.test.mjs`.
- During workspace development, run headless regression tests and
  `TMAX_BENCH=1 node --test tests/extension.test.mjs` after changes. Track local
  action time separately from full model-request latency. Use targeted live
  benchmarks to verify tool selection; do not mistake synthetic terminal
  environment checks for native rendering tests.
- Character, personality, and visual design are the user's decisions.
- tmax is a **multiagent**, singular: one multiplexed character that can spread
  into useful views and gather back into one conversation. Views may show memory,
  live information, progress, or results; they need not be separate agents or chats.
  View lifetimes range from disposable to permanent and are independent of agent
  lifetimes. Gathering attention must not silently discard retained work.
- Judge changes against this experience, not agent counts or task-management UI.
  Keep Claude Code/Agent SDK with tmux as a comparison baseline; existing tmax
  benchmarks do not establish superiority over that baseline.
- Design for people unfamiliar with terminals, multiplexers, and terminal agents.
  Keep setup guided and let the agent handle workspace controls; do not require
  users to learn Herdr or agent terminology for ordinary use.
- Keep the README limited to essential installation and getting started.
  Omit agent tool catalogs, tmux control references, and implementation/benchmark detail.
- Apple Terminal and Ghostty must have equivalent behavior. Preserve the active
  project directory on launch. Keep automated coverage for both
  environments; distinguish it from native app rendering checks.
