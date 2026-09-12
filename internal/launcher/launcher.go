// tmax launches Pi in a persistent Herdr workspace.
package launcher

import (
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

//go:embed extension.ts
var extension []byte

//go:embed handoff.ts
var handoff []byte

//go:embed grid.ts
var grid []byte

const workspaceConfig = "[session]\nresume_agents_on_restore = false\n[update]\nversion_check = false\nmanifest_check = false\n"

func Run(args []string) error {
	if len(args) > 0 {
		switch args[0] {
		case "--version", "-v":
			fmt.Println("tmax 0.1.0 (Pi + Herdr)")
			return nil
		case "--help", "-h":
			fmt.Println("Usage: tmax [Pi options]\n\nOpen or return to this folder's workspace.\nCtrl-B then Q leaves work running; run tmax here to return.\n/quit exits Pi; /close-workspace closes this workspace and its processes.\nPi options (for example --resume) apply when starting Pi, not when reconnecting.")
			return nil
		}
	}
	if err := ensureDependencies(); err != nil {
		return err
	}
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	cwd, err = filepath.EvalSymlinks(cwd)
	if err != nil {
		return err
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(cache, "tmax")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	source := extension
	for name, content := range map[string][]byte{"handoff": handoff, "grid": grid} {
		module, err := cachedFile(dir, name, ".ts", content)
		if err != nil {
			return err
		}
		source = bytes.ReplaceAll(source, []byte("./"+name+".ts"), []byte("./"+filepath.Base(module)))
	}
	ext, err := cachedFile(dir, "extension", ".ts", source)
	if err != nil {
		return err
	}
	// Let the installed Herdr version supply its own Pi hooks. Do not install into
	// the user's Pi settings, copy upstream hooks, or maintain a second reporter.
	integrationDir, err := os.MkdirTemp(dir, "integration-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(integrationDir)
	if err := os.Mkdir(filepath.Join(integrationDir, "extensions"), 0700); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	install := exec.CommandContext(ctx, "herdr", "integration", "install", "pi")
	install.WaitDelay = time.Second
	install.Env = append(os.Environ(), "PI_CODING_AGENT_DIR="+integrationDir)
	if out, err := install.CombinedOutput(); err != nil {
		return fmt.Errorf("prepare Pi integration: %s: %w", out, err)
	}
	hooks, err := os.ReadFile(filepath.Join(integrationDir, "extensions", "herdr-agent-state.ts"))
	if err != nil {
		return err
	}
	integration, err := cachedFile(dir, "herdr-pi", ".ts", hooks)
	if err != nil {
		return err
	}
	os.RemoveAll(integrationDir)
	// Cold restore of Pi currently drops explicit -e arguments. Keep conversation
	// selection in Pi until Herdr can restore this launch with both extensions.
	config, err := cachedFile(dir, "herdr", ".toml", []byte(workspaceConfig))
	if err != nil {
		return err
	}
	session := fmt.Sprintf("tmax-%x", sha256.Sum256([]byte(cwd)))[:29]
	env := workspaceEnv(os.Environ(), session, config)
	h := herdr{env: env, mainFile: filepath.Join(dir, session+".main")}
	lock, err := os.OpenFile(filepath.Join(dir, session+".lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return err
	}
	err = h.prepare(cwd, dir, ext, integration, args)
	syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	if err != nil {
		return err
	}
	binary, err := exec.LookPath("herdr")
	if err != nil {
		return err
	}
	return syscall.Exec(binary, []string{"herdr", "--session", session}, env)
}

// Atomic publication prevents concurrent launches from importing a partial file.
func cachedFile(dir, name, suffix string, content []byte) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("%s-%x%s", name, sha256.Sum256(content), suffix))
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}
	return path, publish(path, content)
}

func publish(path string, content []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+"-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(content); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}
