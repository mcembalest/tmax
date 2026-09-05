package main

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
)

func TestChatHistoryAndSplits(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "failure"}[fail], func(t *testing.T) {
			calls := 0
			backend := func(_ context.Context, h []Message) (Reply, error) {
				calls++
				if calls == 2 {
					result := h[len(h)-2]
					if result.Role != "system" {
						t.Fatal(h)
					}
					expected := "Opened shell pane %42."
					if fail {
						expected = "Pane did not open: too small"
					}
					if result.Content != expected {
						t.Fatal(result)
					}
					return Reply{"ok", "none"}, nil
				}
				return Reply{"Opening.", "right"}, nil
			}
			splits := 0
			split := func(right bool) (string, error) {
				splits++
				if !right {
					t.Fatal("wrong direction")
				}
				if fail {
					return "", errors.New("too small")
				}
				return "%42", nil
			}
			var out bytes.Buffer
			if err := chat(strings.NewReader("open\nstatus?\n/quit\n"), &out, backend, split); err != nil {
				t.Fatal(err)
			}
			if calls != 2 || splits != 1 {
				t.Fatalf("calls %d splits %d", calls, splits)
			}
		})
	}
}

func TestBackendFailureDoesNotCommitHistory(t *testing.T) {
	calls := 0
	backend := func(_ context.Context, h []Message) (Reply, error) {
		calls++
		if calls == 1 {
			return Reply{}, errors.New("offline")
		}
		if len(h) != 1 || h[0].Content != "second" {
			t.Fatal(h)
		}
		return Reply{"ok", "none"}, nil
	}
	if err := chat(strings.NewReader("first\nsecond\n/quit\n"), &bytes.Buffer{}, backend, nil); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatal(calls)
	}
}

func TestCommandsAndEOF(t *testing.T) {
	splits := 0
	backend := func(context.Context, []Message) (Reply, error) { t.Fatal("unexpected model call"); return Reply{}, nil }
	split := func(right bool) (string, error) {
		splits++
		if right {
			t.Fatal("expected below")
		}
		return "%2", nil
	}
	var out bytes.Buffer
	if err := chat(strings.NewReader("\n/help\n/unknown\n/split below\n"), &out, backend, split); err != nil {
		t.Fatal(err)
	}
	if splits != 1 || !strings.Contains(out.String(), "Unknown command") {
		t.Fatal(out.String())
	}
}
