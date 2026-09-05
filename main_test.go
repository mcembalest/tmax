package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"testing"
)

func TestQuote(t *testing.T) {
	for _, s := range []string{"/tmp/space here/tmax", "it's a path", "$(touch nope); `date`", ""} {
		out, err := exec.Command("sh", "-c", "printf %s "+quote(s)).Output()
		if err != nil || string(out) != s {
			t.Fatalf("%q: %q %v", s, out, err)
		}
	}
}

func TestMissingPi(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if err := run(nil); err == nil {
		t.Fatal("expected missing dependency")
	}
}

func TestHelpAndVersionNeedNoRuntime(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	for _, arg := range []string{"--help", "--version"} {
		if err := run([]string{arg}); err != nil {
			t.Fatal(err)
		}
	}
}

func TestLauncherStartsPiWithMouseAndOriginalDirectory(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux missing")
	}
	dir := t.TempDir()
	binary := filepath.Join(dir, "tmax with spaces")
	if out, err := exec.Command("go", "build", "-o", binary, ".").CombinedOutput(); err != nil {
		t.Fatalf("%s %v", out, err)
	}
	fakeDir := filepath.Join(dir, "tools")
	os.Mkdir(fakeDir, 0700)
	fake := filepath.Join(fakeDir, "pi")
	if err := os.WriteFile(fake, []byte("#!/bin/sh\npwd > \"$TMAX_TEST_DIR/cwd\"\nprintf '%s\\n' \"$@\" > \"$TMAX_TEST_DIR/args\"\nsleep 60\n"), 0700); err != nil {
		t.Fatal(err)
	}
	for _, program := range []string{"Apple_Terminal", "ghostty"} {
		t.Run(program, func(t *testing.T) {
			socket := fmt.Sprintf("tmax-launch-test-%d", time.Now().UnixNano())
			tmux := func(args ...string) string {
				t.Helper()
				out, err := exec.Command("tmux", append([]string{"-L", socket}, args...)...).CombinedOutput()
				if err != nil {
					t.Fatalf("%s %v", out, err)
				}
				return strings.TrimSpace(string(out))
			}
			defer exec.Command("tmux", "-L", socket, "kill-server").Run()
			os.Remove(filepath.Join(dir, "args"))
			command := "env PATH=" + quote(fakeDir+":"+os.Getenv("PATH")) + " TMAX_TEST_DIR=" + quote(dir) + " TERM_PROGRAM=" + quote(program) + " " + quote(binary) + " _pi --resume"
			pane := tmux("-f", "/dev/null", "new-session", "-d", "-P", "-F", "#{pane_id}", "-c", dir, command)
			var args []byte
			for i := 0; i < 100; i++ {
				args, _ = os.ReadFile(filepath.Join(dir, "args"))
				if len(args) > 0 {
					break
				}
				time.Sleep(20 * time.Millisecond)
			}
			if !strings.HasPrefix(string(args), "-e\n") || !strings.Contains(string(args), "--resume") {
				t.Fatalf("Pi args: %s", args)
			}
			cwd, _ := os.ReadFile(filepath.Join(dir, "cwd"))
			actual, _ := filepath.EvalSymlinks(strings.TrimSpace(string(cwd)))
			expected, _ := filepath.EvalSymlinks(dir)
			if actual != expected {
				t.Fatalf("cwd %q", actual)
			}
			if tmux("show-options", "-v", "-t", pane, "mouse") != "on" {
				t.Fatal("mouse off")
			}
		})
	}
}
