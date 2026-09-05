package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestLaunchIsTerminalIndependent(t *testing.T) {
	var previous []string
	for _, program := range []string{"Apple_Terminal", "ghostty"} {
		t.Setenv("TERM_PROGRAM", program)
		args := launchArgs("/tmp/it's a path/tmax", "/tmp/my project", "test-session")
		if previous != nil && !reflect.DeepEqual(previous, args) {
			t.Fatal(args)
		}
		previous = args
		command := exec.Command("sh", "-c", "set -- "+args[len(args)-1]+"; printf '%s\\n' \"$1\" \"$2\"")
		output, err := command.Output()
		if err != nil || string(output) != "/tmp/it's a path/tmax\n--chat\n" {
			t.Fatalf("%s %v", output, err)
		}
		if args[len(args)-2] != "/tmp/my project" {
			t.Fatal(args)
		}
	}
}

func TestSplitNeedsTmux(t *testing.T) {
	t.Setenv("TMUX_PANE", "")
	if _, err := split(true); err == nil || !strings.Contains(err.Error(), "needs tmux") {
		t.Fatal(err)
	}
}

func TestMissingDependency(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if err := run(false); err == nil || !strings.Contains(err.Error(), "tmux is missing") {
		t.Fatal(err)
	}
}

func TestRealTmuxSplits(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not installed")
	}
	for _, program := range []string{"Apple_Terminal", "ghostty"} {
		t.Run(program, func(t *testing.T) {
			socket := fmt.Sprintf("tmax-test-%d", time.Now().UnixNano())
			run := func(args ...string) string {
				t.Helper()
				out, err := exec.Command("tmux", append([]string{"-L", socket}, args...)...).CombinedOutput()
				if err != nil {
					t.Fatalf("%v: %s", err, out)
				}
				return strings.TrimSpace(string(out))
			}
			t.Cleanup(func() { exec.Command("tmux", "-L", socket, "kill-server").Run() })
			cwd, err := os.Getwd()
			if err != nil {
				t.Fatal(err)
			}
			pane := run("-f", "/dev/null", "new-session", "-d", "-P", "-F", "#{pane_id}", "-x", "120", "-y", "40", "-c", cwd)
			connection := run("display-message", "-p", "-t", pane, "#{socket_path},#{pid},0")
			t.Setenv("TMUX", connection)
			t.Setenv("TMUX_PANE", pane)
			t.Setenv("TERM_PROGRAM", program)
			right, err := split(true)
			if err != nil {
				t.Fatal(err)
			}
			below, err := split(false)
			if err != nil {
				t.Fatal(err)
			}
			rows := strings.Split(run("list-panes", "-t", pane, "-F", "#{pane_id}|#{pane_active}|#{pane_current_path}"), "\n")
			if len(rows) != 3 || right == below {
				t.Fatal(rows)
			}
			for _, row := range rows {
				fields := strings.Split(row, "|")
				active := "0"
				if fields[0] == pane {
					active = "1"
				}
				if fields[1] != active {
					t.Fatal(row)
				}
				actual, _ := filepath.EvalSymlinks(fields[2])
				expected, _ := filepath.EvalSymlinks(cwd)
				if actual != expected {
					t.Fatal(row)
				}
			}
		})
	}
}
