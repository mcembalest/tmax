// tmax adds a tmux workspace to Pi's existing terminal agent.
package launcher

import (
	"crypto/sha256"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

//go:embed extension.ts
var extension []byte

func quote(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'" }

// Run launches Pi in a tmux workspace.
func Run(args []string) error {
	if len(args) > 0 && (args[0] == "--version" || args[0] == "-v") {
		fmt.Println("tmax 0.1.0 (Pi + tmux)")
		return nil
	}
	if len(args) > 0 && (args[0] == "--help" || args[0] == "-h") {
		fmt.Println("Usage: tmax [Pi options]\n\nLaunch Pi with multiplexing tools. Requires pi and tmux.\nPi options pass through, for example: tmax --resume or tmax --model ...\nClick panes to focus; Ctrl-B then D detaches; tmux -L tmax attach reconnects.")
		return nil
	}
	if err := ensureDependencies(); err != nil {
		return err
	}
	binary, err := os.Executable()
	if err != nil {
		return err
	}
	if len(args) > 0 && args[0] == "_pi" {
		args = args[1:]
	} else if os.Getenv("TMUX") == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return err
		}
		// A reused tmux server may have an older PATH than this launch/setup.
		command := "env PATH=" + quote(os.Getenv("PATH")) + " " + quote(binary) + " _pi"
		for _, arg := range args {
			command += " " + quote(arg)
		}
		tmux, _ := exec.LookPath("tmux")
		session := fmt.Sprintf("tmax-%x", time.Now().UnixNano())
		return syscall.Exec(tmux, []string{"tmux", "-L", "tmax", "-f", "/dev/null", "new-session", "-s", session, "-n", "pi", "-c", cwd, command}, os.Environ())
	}
	if os.Getenv("TMUX_PANE") == "" {
		return fmt.Errorf("Pi must run inside tmux; launch tmax without _pi")
	}
	// Scope mouse support to this session, including when launched in existing tmux.
	if out, err := exec.Command("tmux", "set-option", "-t", os.Getenv("TMUX_PANE"), "mouse", "on").CombinedOutput(); err != nil {
		return fmt.Errorf("enable mouse: %s: %w", out, err)
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(cache, "tmax")
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	path := filepath.Join(dir, fmt.Sprintf("extension-%x.ts", sha256.Sum256(extension)))
	if err = os.WriteFile(path, extension, 0600); err != nil {
		return err
	}
	pi, _ := exec.LookPath("pi")
	os.Setenv("TMAX_BINARY", binary)
	return syscall.Exec(pi, append([]string{"pi", "-e", path}, args...), os.Environ())
}
