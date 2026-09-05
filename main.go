package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
)

func main() {
	chatMode := flag.Bool("chat", false, "chat in the current terminal")
	version := flag.Bool("version", false, "print version")
	flag.Parse()
	if *version {
		fmt.Println("tmax 0.0.1")
		return
	}
	if err := run(*chatMode); err != nil {
		fmt.Fprintln(os.Stderr, "tmax:", err)
		os.Exit(1)
	}
}

func run(chatMode bool) error {
	for _, name := range []string{"tmux", "codex"} {
		if _, err := exec.LookPath(name); err != nil {
			return fmt.Errorf("%s is missing; install it first", name)
		}
	}
	info, err := os.Stdin.Stat()
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeCharDevice == 0 {
		return fmt.Errorf("run tmax in an interactive terminal, such as Terminal or Ghostty")
	}
	if chatMode || os.Getenv("TMUX") != "" {
		return chat(os.Stdin, os.Stdout, codexReply, split)
	}
	return launch()
}
