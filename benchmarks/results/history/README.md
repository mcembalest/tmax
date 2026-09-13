# History protection correction

All conversations use labeled local planning fixtures, real Pi RPC and Herdr
0.9.0. Production model preferences were not changed. Each JSON records its model,
reasoning, terminal environment, frozen extension source hashes, and conversation.
Tool spans exclude model waits; request timings include them. Environment labels
are not native rendering verification.

## Final implementation

- [Astra, original wording](astra-original.json): all five steps pass.
- [Astra, alternate wording and filenames](astra-paraphrase.json): all five steps
  pass under the Ghostty environment.
- [Luna, original wording](luna-original.json): fails the new first-step assertion
  because the earlier conversation was opened without history protection.
- [Pi 0.85.1 regressions](regressions.txt): all 26 pass; deterministic Pi tool calls
  attempt history overwrites while verifying that the current plan can change.
- [Clean Pi 0.85.0 installation](clean-install.txt): all 26 pass.
- [Direct workspace measurements](local.json): separate from model latency.

The live checker now also requires that history has edit protection before any
revision, and that the current plan remains editable. It continues to require the
original history bytes, visible current plan, and preserved terminal IDs at turn
end. Passing an older checker without protection is not counted as a fixed result.

## Exploratory trials, retained including failures

| Trial | Design and observed outcome |
| --- | --- |
| [1](exploratory-1.json) | Optional reference/working field: Luna treated the current plan as reference; required source update failed. |
| [2](exploratory-2.json) | Required reference/working field: same misclassification. |
| [3](exploratory-3.json) | Required historical boolean: same misclassification. |
| [4](exploratory-4.json) | Separate recall/show operations: Luna selected ordinary show for history and rewrote it. |
| [5](exploratory-5.json) | Clarified instructions: Luna preserved the file but still omitted its protection, then failed gathering. |
| [Astra](astra-exploratory.json) | Separate recall/show operations before final prompt snippets: all five original checks passed. |

These are development samples with differing code, models and provider conditions,
not a controlled model ranking. They are not included in the deterministic test
pass count. Failed steps retain the conversation even when no timing row completed.
