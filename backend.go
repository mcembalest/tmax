package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const schema = `{"type":"object","properties":{"text":{"type":"string"},"split":{"type":"string","enum":["none","right","below"]}},"required":["text","split"],"additionalProperties":false}`
const instructions = `You are the backend of a terminal agent application.
Respond to the latest message using the supplied conversation history.
Use your coding tools for requested work in the current directory.
For pane requests, return split=right or below; otherwise return none.
The application opens one empty shell pane after your reply, without moving focus.
Do not run tmux yourself or claim a split succeeded before receiving its result.
No other pane operations are implemented. Keep replies concise.
Conversation JSON:
`

func codexReply(ctx context.Context, history []Message) (Reply, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	dir, err := os.MkdirTemp("", "tmax-")
	if err != nil {
		return Reply{}, err
	}
	defer os.RemoveAll(dir)
	schemaPath, output := filepath.Join(dir, "schema.json"), filepath.Join(dir, "reply.json")
	if err := os.WriteFile(schemaPath, []byte(schema), 0600); err != nil {
		return Reply{}, err
	}
	log, err := os.Create(filepath.Join(dir, "log"))
	if err != nil {
		return Reply{}, err
	}
	defer log.Close()
	model := os.Getenv("TMAX_MODEL")
	if model == "" {
		model = "gpt-5.4-mini"
	}
	cmd := exec.CommandContext(ctx, "codex", "exec", "--ephemeral", "--skip-git-repo-check",
		"--ignore-user-config", "-m", model, "--sandbox", "workspace-write", "--color", "never",
		"--output-schema", schemaPath, "-o", output, "-")
	data, err := json.Marshal(history)
	if err != nil {
		return Reply{}, err
	}
	cmd.Stdin = strings.NewReader(instructions + string(data))
	cmd.Stderr = log
	// Cancel the process group too, so subprocesses do not outlive a canceled turn.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return Reply{}, fmt.Errorf("%w; file changes already made may remain", ctx.Err())
		}
		info, _ := log.Stat()
		offset := int64(0)
		if info != nil && info.Size() > 2000 {
			offset = info.Size() - 2000
		}
		tail := make([]byte, 2000)
		n, _ := log.ReadAt(tail, offset)
		return Reply{}, fmt.Errorf("Codex failed: %w\n%s", err, tail[:n])
	}
	data, err = os.ReadFile(output)
	if err != nil {
		return Reply{}, err
	}
	return decodeReply(data)
}

func decodeReply(data []byte) (Reply, error) {
	var wire struct {
		Text  *string `json:"text"`
		Split string  `json:"split"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&wire); err != nil {
		return Reply{}, err
	}
	if !json.Valid(data) || wire.Text == nil || (wire.Split != "none" && wire.Split != "right" && wire.Split != "below") {
		return Reply{}, fmt.Errorf("invalid backend response")
	}
	return Reply{*wire.Text, wire.Split}, nil
}
