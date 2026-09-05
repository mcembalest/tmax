package main

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func tmux(args ...string) (string, error) {
	output, err := exec.Command("tmux", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("tmux: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return strings.TrimSpace(string(output)), nil
}

func launchArgs(binary, cwd, session string) []string {
	// tmux interprets a single command through the shell; quote the executable path.
	quoted := "'" + strings.ReplaceAll(binary, "'", "'\"'\"'") + "'"
	return []string{"tmux", "-L", "tmax", "-f", "/dev/null", "new-session", "-s", session,
		"-n", "chat", "-c", cwd, quoted + " --chat"}
}

func launch() error {
	binary, err := os.Executable()
	if err != nil {
		return err
	}
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	executable, err := exec.LookPath("tmux")
	if err != nil {
		return err
	}
	session := "tmax-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	return syscall.Exec(executable, launchArgs(binary, cwd, session), os.Environ())
}

func split(right bool) (string, error) {
	pane := os.Getenv("TMUX_PANE")
	if pane == "" {
		return "", fmt.Errorf("pane splitting needs tmux; start with tmax")
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	direction := "-v"
	if right {
		direction = "-h"
	}
	return tmux("split-window", "-d", "-P", "-F", "#{pane_id}", direction, "-t", pane, "-c", cwd)
}
