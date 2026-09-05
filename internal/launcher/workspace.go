package launcher

import (
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

type herdr struct{ env []string }
type pane struct {
	ID        string `json:"pane_id"`
	Workspace string `json:"workspace_id"`
}
type snapshot struct {
	Panes  []pane `json:"panes"`
	Agents []struct {
		Pane string `json:"pane_id"`
		Kind string `json:"agent"`
	} `json:"agents"`
}

func workspaceEnv(env []string, session, config string) []string {
	result := []string{}
	for _, entry := range env {
		key := strings.SplitN(entry, "=", 2)[0]
		if strings.HasPrefix(key, "HERDR_") || strings.HasPrefix(key, "TMAX_") || key == "TMUX" || key == "TMUX_PANE" {
			continue
		}
		result = append(result, entry)
	}
	return append(result, "HERDR_SESSION="+session, "HERDR_CONFIG_PATH="+config)
}
func (h herdr) call(args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "herdr", args...)
	cmd.Env = h.env
	out, err := cmd.CombinedOutput()
	if err != nil {
		return out, fmt.Errorf("herdr %s: %s: %w", strings.Join(args[:min(2, len(args))], " "), out, err)
	}
	return out, nil
}
func (h herdr) snapshot() (snapshot, error) {
	out, err := h.call("api", "snapshot")
	if err != nil {
		return snapshot{}, err
	}
	var response struct {
		Result struct {
			Snapshot snapshot `json:"snapshot"`
		} `json:"result"`
	}
	if err := json.Unmarshal(out, &response); err != nil {
		return snapshot{}, err
	}
	return response.Result.Snapshot, nil
}
func (h herdr) prepare(cwd, dir, ext, integration string, args []string) error {
	state, err := h.snapshot()
	if err != nil {
		if !strings.Contains(err.Error(), "server_not_running") {
			return err
		}
		log, err := os.OpenFile(filepath.Join(dir, "herdr-server.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
		if err != nil {
			return err
		}
		defer log.Close()
		cmd := exec.Command("herdr", "server")
		cmd.Env = h.env
		cmd.Dir = cwd
		cmd.Stdout, cmd.Stderr = log, log
		cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
		if err := cmd.Start(); err != nil {
			return err
		}
		go cmd.Wait()
		deadline := time.Now().Add(10 * time.Second)
		for {
			state, err = h.snapshot()
			if err == nil {
				break
			}
			if time.Now().After(deadline) {
				return fmt.Errorf("workspace did not start; see %s: %w", log.Name(), err)
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
	// Reconnect to an existing agent, never silently discard new launch options.
	if len(state.Agents) > 0 {
		if len(args) > 0 {
			return fmt.Errorf("this folder already has a running agent; run tmax without options to return, then use Pi's /resume or /model")
		}
		return nil // Reattach without changing the user's current panel or tab.
	}
	var root pane
	{
		create := []string{"workspace", "create", "--cwd", cwd, "--label", filepath.Base(cwd), "--no-focus"}
		if len(state.Panes) > 0 {
			// An abruptly terminated TUI can leave its shell's terminal modes
			// damaged. Keep old panes intact and launch in a fresh terminal.
			create = []string{"tab", "create", "--workspace", state.Panes[0].Workspace, "--cwd", cwd, "--label", "Pi", "--no-focus"}
		}
		for _, entry := range h.env {
			if !strings.HasPrefix(entry, "HERDR_") {
				create = append(create, "--env", entry)
			}
		}
		out, err := h.call(create...)
		if err != nil {
			return err
		}
		var response struct {
			Result struct {
				Root pane `json:"root_pane"`
			} `json:"result"`
		}
		if err := json.Unmarshal(out, &response); err != nil {
			return err
		}
		root = response.Result.Root
	}
	if root.ID == "" {
		return fmt.Errorf("Herdr returned no workspace pane")
	}
	launch := append([]string{"agent", "start", "tmax", "--kind", "pi", "--pane", root.ID, "--", "-e", ext, "-e", integration}, args...)
	// Shell startup can still be in progress. Only retry the explicit not-ready
	// response; never re-submit a launch after an ambiguous timeout.
	deadline := time.Now().Add(5 * time.Second)
	for {
		out, err := h.call(launch...)
		if err == nil {
			break
		}
		if strings.Contains(string(out), "agent_not_ready") {
			break
		} // Attach so the user can answer Pi's startup dialog.
		if !strings.Contains(string(out), "agent_pane_busy") || time.Now().After(deadline) {
			return err
		}
		time.Sleep(100 * time.Millisecond)
	}
	_, err = h.call("agent", "focus", root.ID)
	return err
}
