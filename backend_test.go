package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecodeReply(t *testing.T) {
	for _, data := range []string{`{"text":"hi","split":"none"}`, `{"text":"","split":"right"}`, `{"text":"ok","split":"below"}`} {
		if _, err := decodeReply([]byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	for _, data := range []string{`{}`, `null`, `{"text":null,"split":"none"}`, `{"text":12,"split":"none"}`, `{"text":"hi","split":"delete"}`, `{"text":"hi","split":"none","extra":1}`, `{"text":"hi","split":"none"}{}`} {
		if _, err := decodeReply([]byte(data)); err == nil {
			t.Fatalf("accepted %s", data)
		}
	}
}

func fakeCodex(t *testing.T, body string) {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "codex"), []byte("#!/bin/sh\n"+body), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

func TestCodexAdapter(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("TMAX_CAPTURE", dir)
	t.Setenv("TMAX_MODEL", "test-model")
	fakeCodex(t, `printf '%s\n' "$@" > "$TMAX_CAPTURE/args"
cat > "$TMAX_CAPTURE/input"
while [ "$#" -gt 0 ]; do
 if [ "$1" = '-o' ]; then shift; output="$1"; fi
 shift
done
printf '{"text":"hello","split":"none"}' > "$output"
`)
	reply, err := codexReply(context.Background(), []Message{{"user", "hello"}})
	if err != nil || reply.Text != "hello" {
		t.Fatalf("%+v %v", reply, err)
	}
	args, _ := os.ReadFile(filepath.Join(dir, "args"))
	for _, want := range []string{"--sandbox\nworkspace-write", "-m\ntest-model", "--ignore-user-config"} {
		if !strings.Contains(string(args), want) {
			t.Fatal(string(args))
		}
	}
	input, _ := os.ReadFile(filepath.Join(dir, "input"))
	if !strings.Contains(string(input), `"content":"hello"`) {
		t.Fatal(string(input))
	}
}

func TestCodexFailureAndCancellation(t *testing.T) {
	fakeCodex(t, "echo offline >&2\nexit 7\n")
	if _, err := codexReply(context.Background(), nil); err == nil || !strings.Contains(err.Error(), "offline") {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := codexReply(ctx, nil); err == nil || !strings.Contains(err.Error(), "canceled") {
		t.Fatal(err)
	}
}
