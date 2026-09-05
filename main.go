package main

import (
	"fmt"
	"os"

	"github.com/mcembalest/tmax/internal/launcher"
)

func main() {
	if err := launcher.Run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "tmax:", err)
		os.Exit(1)
	}
}
