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

func TestFirstLaunchFromTerminal(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux missing")
	}
	root := t.TempDir()
	binary := filepath.Join(root, "tmax with 'quotes'")
	if out, err := exec.Command("go", "build", "-o", binary, ".").CombinedOutput(); err != nil {
		t.Fatalf("%s %v", out, err)
	}
	for _, program := range []string{"Apple_Terminal", "ghostty"} {
		for _, reuse := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/reuse=%t", program, reuse), func(t *testing.T) {
				dir := t.TempDir()
				// A short, private socket directory isolates the real -L tmax server.
				sockets, err := os.MkdirTemp("/tmp", "tmax-launch-")
				if err != nil {
					t.Fatal(err)
				}
				defer os.RemoveAll(sockets)
				tmux := func(socket string, args ...string) *exec.Cmd {
					cmd := exec.Command("tmux", append([]string{"-L", socket}, args...)...)
					cmd.Env = append(os.Environ(), "TMUX_TMPDIR="+sockets)
					return cmd
				}
				defer tmux("terminal", "kill-server").Run()
				defer tmux("tmax", "kill-server").Run()
				if reuse {
					old := t.TempDir()
					if err := os.WriteFile(filepath.Join(old, "pi"), []byte("#!/bin/sh\nexit 0\n"), 0700); err != nil {
						t.Fatal(err)
					}
					seed := tmux("tmax", "-f", "/dev/null", "new-session", "-d", "-s", "seed", "/bin/sleep 60")
					seed.Env = append(seed.Env, "PATH="+old+":"+os.Getenv("PATH"))
					if out, err := seed.CombinedOutput(); err != nil {
						t.Fatalf("seed old server: %s %v", out, err)
					}
				}
				fake := "#!/bin/sh\nTMAX_TEST_DIR=" + quote(dir) + "\n" + `pwd > "$TMAX_TEST_DIR/cwd"
printf '%s\n' "$@" > "$TMAX_TEST_DIR/args"
printf '%s\n' "$TMUX" "$TMUX_PANE" "$TERM_PROGRAM" > "$TMAX_TEST_DIR/context"
touch "$TMAX_TEST_DIR/ready"
sleep 60
`
				if err := os.WriteFile(filepath.Join(dir, "pi"), []byte(fake), 0700); err != nil {
					t.Fatal(err)
				}
				launchPath := dir + ":" + os.Getenv("PATH")
				if !reuse {
					// Exercise real first-launch confirmation; only npm itself is stubbed.
					if err := os.Rename(filepath.Join(dir, "pi"), filepath.Join(dir, "pi-template")); err != nil {
						t.Fatal(err)
					}
					realTmux, _ := exec.LookPath("tmux")
					if err := os.Symlink(realTmux, filepath.Join(dir, "tmux")); err != nil {
						t.Fatal(err)
					}
					for name, script := range map[string]string{
						"node": "#!/bin/sh\nprintf 'v24.0.0\\n'\n",
						"npm":  "#!/bin/sh\n/bin/cp " + quote(filepath.Join(dir, "pi-template")) + " " + quote(filepath.Join(dir, "pi")) + "\n",
					} {
						if err := os.WriteFile(filepath.Join(dir, name), []byte(script), 0700); err != nil {
							t.Fatal(err)
						}
					}
					launchPath = dir + ":/usr/bin:/bin"
				}
				model := "model with 'quotes' $(touch should-not-exist)"
				// The outer server supplies a real PTY. Clearing TMUX makes tmax take
				// its ordinary first-launch path, creating and attaching its own server.
				command := "env -u TMUX -u TMUX_PANE PATH=" + quote(launchPath) +
					" TERM_PROGRAM=" + quote(program) + " TMAX_TEST_DIR=" + quote(dir) +
					" " + quote(binary) + " --resume --model " + quote(model)
				if out, err := tmux("terminal", "-f", "/dev/null", "new-session", "-d", "-s", "terminal", "-x", "120", "-y", "40", "-c", dir, command).CombinedOutput(); err != nil {
					t.Fatalf("start terminal: %s %v", out, err)
				}
				approved := reuse
				for i := 0; ; i++ {
					if _, err := os.Stat(filepath.Join(dir, "ready")); err == nil {
						break
					}
					if i == 250 {
						out, _ := tmux("terminal", "capture-pane", "-p", "-t", "terminal").CombinedOutput()
						t.Fatalf("Pi did not start: %s", out)
					}
					if !approved {
						out, _ := tmux("terminal", "capture-pane", "-p", "-t", "terminal").CombinedOutput()
						if strings.Contains(string(out), "Install these dependencies?") {
							if out, err := tmux("terminal", "send-keys", "-t", "terminal", "y", "Enter").CombinedOutput(); err != nil {
								t.Fatalf("confirm setup: %s %v", out, err)
							}
							approved = true
						}
					}
					time.Sleep(20 * time.Millisecond)
				}
				args, _ := os.ReadFile(filepath.Join(dir, "args"))
				lines := strings.Split(strings.TrimSpace(string(args)), "\n")
				if len(lines) != 5 || lines[0] != "-e" || lines[2] != "--resume" || lines[3] != "--model" || lines[4] != model {
					t.Fatalf("Pi arguments changed: %s", args)
				}
				loaded, err := os.ReadFile(lines[1])
				if err != nil || string(loaded) != string(extension) {
					t.Fatalf("embedded extension was not installed correctly: %v", err)
				}
				cwd, _ := os.ReadFile(filepath.Join(dir, "cwd"))
				actual, _ := filepath.EvalSymlinks(strings.TrimSpace(string(cwd)))
				expected, _ := filepath.EvalSymlinks(dir)
				if actual != expected {
					t.Fatalf("project directory changed: %q", actual)
				}
				context, _ := os.ReadFile(filepath.Join(dir, "context"))
				fields := strings.Split(strings.TrimSpace(string(context)), "\n")
				// tmux identifies itself as TERM_PROGRAM inside the newly created pane.
				if len(fields) != 3 || !strings.Contains(fields[0], "/tmax,") || fields[2] != "tmux" {
					t.Fatalf("Pi did not inherit its new workspace: %s", context)
				}
				out, err := tmux("tmax", "show-options", "-v", "-t", fields[1], "mouse").CombinedOutput()
				if err != nil || strings.TrimSpace(string(out)) != "on" {
					t.Fatalf("mouse not enabled: %s %v", out, err)
				}
				out, err = tmux("tmax", "list-clients", "-F", "#{client_session}").CombinedOutput()
				if err != nil || !strings.HasPrefix(strings.TrimSpace(string(out)), "tmax-") {
					t.Fatalf("terminal did not attach to tmax: %s %v", out, err)
				}
				if _, err := os.Stat(filepath.Join(dir, "should-not-exist")); !os.IsNotExist(err) {
					t.Fatal("model argument was interpreted by the shell")
				}
			})
		}
	}
}
