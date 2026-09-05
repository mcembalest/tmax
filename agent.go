package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type Reply struct {
	Text  string `json:"text"`
	Split string `json:"split"`
}
type Backend func(context.Context, []Message) (Reply, error)

const help = "/split · /split below · /help · /quit | Ctrl-B then D detaches tmux"

func chat(in io.Reader, out io.Writer, reply Backend, splitPane func(bool) (string, error)) error {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	history := []Message{}
	fmt.Fprintln(out, "tmax\n"+help+"\nBackend: Codex (can edit files in the current workspace).")
	open := func(right bool) {
		pane, err := splitPane(right)
		result := "Opened shell pane " + pane + "."
		if err != nil {
			result = "Pane did not open: " + err.Error()
		}
		history = append(history, Message{"system", result})
		fmt.Fprintln(out, result)
	}
	for {
		fmt.Fprint(out, "\nyou> ")
		if !scanner.Scan() {
			return scanner.Err()
		}
		text := strings.TrimSpace(scanner.Text())
		switch text {
		case "":
			continue
		case "/quit":
			return nil
		case "/help":
			fmt.Fprintln(out, help)
			continue
		case "/split", "/split below":
			history = append(history, Message{"user", text})
			open(text == "/split")
			continue
		}
		if strings.HasPrefix(text, "/") {
			fmt.Fprintln(out, "Unknown command. "+help)
			continue
		}
		fmt.Fprintln(out, "Working…")
		pending := append(append([]Message{}, history...), Message{"user", text})
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
		response, err := reply(ctx, pending)
		stop()
		if err != nil {
			fmt.Fprintln(out, "Error:", err)
			continue
		}
		history = append(pending, Message{"assistant", response.Text})
		fmt.Fprintln(out, "\ntmax> "+response.Text)
		if response.Split != "none" {
			open(response.Split == "right")
		}
	}
}
