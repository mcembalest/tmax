package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const piPackage = "@earendil-works/pi-coding-agent@0.85.0"

func missingDependencies() []string {
	var missing []string
	for _, name := range []string{"tmux", "pi"} {
		if _, err := exec.LookPath(name); err != nil {
			missing = append(missing, name)
		}
	}
	return missing
}

func ensureDependencies() error {
	if len(missingDependencies()) == 0 {
		return nil
	}
	// Check the actual terminal, not just character-device status (/dev/null).
	tty := exec.Command("stty", "-g")
	tty.Stdin = os.Stdin
	return installDependencies(os.Stdin, os.Stdout, tty.Run() == nil)
}

func installDependencies(input io.Reader, output io.Writer, interactive bool) error {
	missing := missingDependencies()
	if len(missing) == 0 {
		return nil
	}
	var packages []string
	needsPi := false
	for _, name := range missing {
		if name == "tmux" {
			packages = append(packages, "tmux")
		} else {
			needsPi = true
		}
	}
	if needsPi {
		version, err := exec.Command("node", "--version").Output()
		var major, minor int
		fmt.Sscanf(strings.TrimSpace(string(version)), "v%d.%d", &major, &minor)
		_, npmErr := exec.LookPath("npm")
		if err != nil || major < 22 || major == 22 && minor < 19 || npmErr != nil {
			packages = append(packages, "node")
		}
	}
	var commands [][]string
	if len(packages) > 0 {
		if _, err := exec.LookPath("brew"); err != nil {
			return fmt.Errorf("missing %s; automatic system dependency setup requires Homebrew (https://brew.sh). Install tmux and Node 22.19+/npm with your package manager, then run npm install -g --ignore-scripts %s and retry tmax", strings.Join(missing, ", "), piPackage)
		}
		commands = append(commands, append([]string{"brew", "install"}, packages...))
	}
	if needsPi {
		commands = append(commands, []string{"npm", "install", "-g", "--ignore-scripts", piPackage})
	}
	fmt.Fprintf(output, "Missing: %s\n\n", strings.Join(missing, ", "))
	for _, command := range commands {
		fmt.Fprintln(output, strings.Join(command, " "))
	}
	if !interactive {
		return fmt.Errorf("run tmax in an interactive terminal to approve installation, or run the commands above")
	}
	fmt.Fprint(output, "\nInstall these dependencies? [y/N] ")
	answer, err := bufio.NewReader(input).ReadString('\n')
	if err != nil || (strings.ToLower(strings.TrimSpace(answer)) != "y" && strings.ToLower(strings.TrimSpace(answer)) != "yes") {
		return fmt.Errorf("setup canceled; no dependencies installed")
	}
	for _, command := range commands {
		cmd := exec.Command(command[0], command[1:]...)
		cmd.Stdin, cmd.Stdout, cmd.Stderr = input, output, output
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("%s failed: %w; fix the reported error and retry tmax", command[0], err)
		}
		if command[0] == "brew" {
			prefix, err := exec.Command("brew", "--prefix").Output()
			if err != nil || !filepath.IsAbs(strings.TrimSpace(string(prefix))) {
				return fmt.Errorf("cannot locate Homebrew installation; check PATH and retry tmax")
			}
			os.Setenv("PATH", filepath.Join(strings.TrimSpace(string(prefix)), "bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
		}
	}
	if missing := missingDependencies(); len(missing) != 0 {
		return fmt.Errorf("still missing %s after installation; check PATH and retry tmax", strings.Join(missing, ", "))
	}
	return nil
}
