# Project conventions

- Use Go. Build with `go build -o bin/tmax .`; test with `go test ./...` and
  check with `go vet ./...`. Keep the runtime free of unnecessary dependencies.
- If Python tooling is ever needed, use uv for setup, dependencies, and execution.
  Do not use bare interpreter commands or pip workflows.
- Keep the implementation extremely small and modular. Avoid speculative abstractions.
- Character, personality, and visual design are the user's decisions.
- Apple Terminal and Ghostty must have equivalent behavior. Preserve the active
  project directory on launch. Keep automated coverage for both
  environments; distinguish it from native app rendering checks.
