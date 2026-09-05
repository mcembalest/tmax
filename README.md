# tmax

## Install

macOS / Linux · [Go 1.22+](https://go.dev/doc/install)

```sh
go install github.com/mcembalest/tmax@latest
export PATH="$(go env GOPATH)/bin:$PATH"
tmax
```

First launch guides you through dependency setup and signing in to Pi.
Automatic system dependency setup requires [Homebrew](https://brew.sh/).

| In tmax | Action |
| --- | --- |
| `/login` | Sign in to your model provider |
| `/model` | Choose a model; Ctrl+S saves the default |

## Use

Open Terminal or Ghostty in your project folder. Run `tmax`. Ask for what you want.
Run `tmax` in that folder again to return to its running workspace.

Ctrl-B then Q leaves work running. `/quit` exits the conversation interface;
other panels keep running. `/close-workspace` closes the workspace and its processes.
Saved conversations remain available through Pi's `/resume` or `tmax --resume` when starting again.
After a computer restart, running work is gone; saved conversation history remains.

Updates: rerun the install command.
