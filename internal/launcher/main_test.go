package launcher

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestMissingPi(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	if err := Run(nil); err == nil {
		t.Fatal("expected dependency error")
	}
}
func TestHelpAndVersionNeedNoRuntime(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	for _, arg := range []string{"--help", "--version"} {
		if err := Run([]string{arg}); err != nil {
			t.Fatal(err)
		}
	}
}
func TestEnvironmentDoesNotTargetOuterWorkspace(t *testing.T) {
	for _, terminal := range []string{"Apple_Terminal", "ghostty"} {
		env := workspaceEnv([]string{"PATH=/fresh/bin", "TERM_PROGRAM=" + terminal, "HERDR_SOCKET_PATH=/other/socket", "HERDR_PANE_ID=w9:p3", "HERDR_SESSION=other", "TMUX=other", "TMAX_OLD=yes", "PROJECT_TOKEN=fresh"}, "tmax-project", "/config")
		joined := strings.Join(env, "\n")
		for _, bad := range []string{"/other/socket", "w9:p3", "=other", "TMAX_OLD"} {
			if strings.Contains(joined, bad) {
				t.Fatal(joined)
			}
		}
		for _, good := range []string{"PATH=/fresh/bin", "TERM_PROGRAM=" + terminal, "PROJECT_TOKEN=fresh", "HERDR_SESSION=tmax-project"} {
			if !strings.Contains(joined, good) {
				t.Fatal(joined)
			}
		}
	}
}
func TestCacheConcurrentPublication(t *testing.T) {
	dir := t.TempDir()
	content := []byte(strings.Repeat("extension\n", 10000))
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			path, err := cachedFile(dir, "extension", ".ts", content)
			if err != nil {
				t.Error(err)
				return
			}
			got, err := os.ReadFile(path)
			if err != nil || string(got) != string(content) {
				t.Error("partial extension", err)
			}
		}()
	}
	wg.Wait()
	files, _ := filepath.Glob(filepath.Join(dir, "*.ts"))
	if len(files) != 1 {
		t.Fatal(files)
	}
}
