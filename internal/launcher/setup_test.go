package launcher

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Installers are stub executables. Tests never download or install packages.
func setupFixture(t *testing.T, names ...string) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("PATH", dir)
	t.Setenv("TMAX_SETUP_TEST", dir)
	for _, name := range names {
		body := "#!/bin/sh\nexit 0\n"
		switch name {
		case "node":
			body = "#!/bin/sh\nprintf 'v24.0.0\\n'\n"
		case "brew":
			body = `#!/bin/sh
if [ "$1" = --prefix ]; then printf '%s\n' "$TMAX_SETUP_TEST"; exit 0; fi
printf 'brew %s\n' "$*" >> "$TMAX_SETUP_TEST/calls"
if [ "$TMAX_SETUP_FAIL" = brew ]; then exit 7; fi
shift
for package do
  case "$package" in
    herdr) /bin/cp "$TMAX_SETUP_TEST/brew" "$TMAX_SETUP_TEST/herdr" ;;
    node)
      printf '#!/bin/sh\nprintf "v24.0.0\\n"\n' > "$TMAX_SETUP_TEST/node"
      /bin/chmod +x "$TMAX_SETUP_TEST/node"
      /bin/cp "$TMAX_SETUP_TEST/npm-stub" "$TMAX_SETUP_TEST/npm" ;;
  esac
done
`
		case "npm", "npm-stub":
			body = `#!/bin/sh
printf 'npm %s\n' "$*" >> "$TMAX_SETUP_TEST/calls"
if [ "$TMAX_SETUP_FAIL" = npm ]; then exit 8; fi
/bin/cp "$TMAX_SETUP_TEST/npm-stub" "$TMAX_SETUP_TEST/pi"
`
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0700); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func TestSetupSkipsConfiguredLaunch(t *testing.T) {
	setupFixture(t, "herdr", "pi")
	var output bytes.Buffer
	if err := installDependencies(strings.NewReader(""), &output, false); err != nil || output.Len() != 0 {
		t.Fatalf("configured launch prompted: %s %v", &output, err)
	}
}

func TestSetupRequiresConsent(t *testing.T) {
	for _, answer := range []string{"", "\n", "no\n", "y\n"} {
		for _, interactive := range []bool{false, true} {
			if interactive && answer == "y\n" {
				continue
			}
			t.Run(answer+stringName(interactive), func(t *testing.T) {
				dir := setupFixture(t, "brew", "npm-stub")
				var output bytes.Buffer
				if err := installDependencies(strings.NewReader(answer), &output, interactive); err == nil {
					t.Fatal("expected setup refusal")
				}
				if _, err := os.Stat(filepath.Join(dir, "calls")); !os.IsNotExist(err) {
					t.Fatal("installer ran without consent")
				}
				if !strings.Contains(output.String(), "npm install -g --ignore-scripts "+piPackage) {
					t.Fatal("installation plan missing")
				}
			})
		}
	}
}

func stringName(interactive bool) string {
	if interactive {
		return "interactive"
	}
	return "headless"
}

func TestSetupInstallPlan(t *testing.T) {
	for _, tc := range []struct {
		name  string
		tools []string
		calls string
	}{
		{"all", []string{"brew", "npm-stub"}, "brew install herdr node\nnpm install -g --ignore-scripts " + piPackage + "\n"},
		{"pi only", []string{"herdr", "node", "npm", "npm-stub"}, "npm install -g --ignore-scripts " + piPackage + "\n"},
		{"herdr only", []string{"pi", "brew"}, "brew install herdr\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := setupFixture(t, tc.tools...)
			var output bytes.Buffer
			if err := installDependencies(strings.NewReader("yes\n"), &output, true); err != nil {
				t.Fatalf("%s %v", &output, err)
			}
			calls, _ := os.ReadFile(filepath.Join(dir, "calls"))
			if string(calls) != tc.calls {
				t.Fatalf("install plan: %s", calls)
			}
			output.Reset()
			if err := installDependencies(strings.NewReader(""), &output, true); err != nil || output.Len() != 0 {
				t.Fatalf("second launch did not skip setup: %s %v", &output, err)
			}
		})
	}
}

func TestSetupInstallerFailure(t *testing.T) {
	for _, installer := range []string{"brew", "npm"} {
		t.Run(installer, func(t *testing.T) {
			dir := setupFixture(t, "brew", "npm-stub")
			t.Setenv("TMAX_SETUP_FAIL", installer)
			var output bytes.Buffer
			if err := installDependencies(strings.NewReader("y\n"), &output, true); err == nil || !strings.Contains(err.Error(), installer+" failed") {
				t.Fatalf("failure not reported: %v", err)
			}
			calls, _ := os.ReadFile(filepath.Join(dir, "calls"))
			if installer == "brew" && strings.Contains(string(calls), "npm ") {
				t.Fatal("continued after failure")
			}
		})
	}
}

func TestSetupWithoutHomebrew(t *testing.T) {
	setupFixture(t)
	var output bytes.Buffer
	if err := installDependencies(strings.NewReader("y\n"), &output, true); err == nil || !strings.Contains(err.Error(), "https://brew.sh") {
		t.Fatalf("missing manual setup instructions: %v", err)
	}
}

func TestSetupOldNode(t *testing.T) {
	dir := setupFixture(t, "herdr", "node", "npm", "brew", "npm-stub")
	if err := os.WriteFile(filepath.Join(dir, "node"), []byte("#!/bin/sh\nprintf 'v22.18.0\\n'\n"), 0700); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := installDependencies(strings.NewReader("y\n"), &output, true); err != nil {
		t.Fatal(err)
	}
	calls, _ := os.ReadFile(filepath.Join(dir, "calls"))
	if !strings.HasPrefix(string(calls), "brew install node\n") {
		t.Fatalf("old Node was not handled: %s", calls)
	}
}

func TestVersionCompatibility(t *testing.T) {
	for _, tc := range []struct {
		herdr, pi string
		ok        bool
	}{
		{"herdr 0.9.0", "0.85.0", true}, {"herdr 0.8.2", "0.85.0", false},
		{"herdr 0.9.0", "0.84.0", false}, {"unknown", "0.85.0", false},
	} {
		t.Run(tc.herdr+tc.pi, func(t *testing.T) {
			dir := setupFixture(t)
			for name, version := range map[string]string{"herdr": tc.herdr, "pi": tc.pi} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte("#!/bin/sh\nprintf '%s\\n' '"+version+"'\n"), 0700); err != nil {
					t.Fatal(err)
				}
			}
			if err := checkVersions(); (err == nil) != tc.ok {
				t.Fatalf("compatibility: %v", err)
			}
		})
	}
}
