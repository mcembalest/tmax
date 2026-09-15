# A multiagent

tmax is one character that can become several and come together again. The user
interacts with that character while it handles the distribution of attention,
context, and work. They should not become the manager of an agent team.

The immediate experiment is one Pi agent sustaining several perspectives while
working. Implementation correctness, experimental validity, the intended use,
and the reader's understanding should shape the same developing artifact. For
example, anticipating how a reader will interpret a latency chart should change
the measurement before the chart is made. Teacher and student are perspectives,
not permanent jobs or a reason to stage an agent dialogue.

A pane is a place for something useful: a remembered conversation, live data, a
progress display, a plan taking shape, or another place the character is working.
The number of panes need not equal the number of model instances. Character,
personality, and visual design belong to the user.

Views have independent lifetimes. Something useful for five seconds may be
discarded; something useful all weekend may stay; something worth keeping may
outlive many conversations. Gathering back into one conversation does not mean
destroying the views or forgetting what happened in them.

## The demo we are working toward

Use a real engineering project: build an on-device MNIST digit recognizer and
compare implementations on the user's MacBook. Reuse Jade's MNIST example;
Python/NumPy, PyTorch, MLX and Mojo/MAX already have implementations there. Rust
is an additional candidate, not an existing measurement.

1. One conversation: establish what the recognizer needs to do.
2. Two panes: make working predictions or the existing evidence visible.
3. Four panes: expose useful implementation results, measurements, and a developing
   recommendation. A pane need not correspond to one backend or model instance.
4. Revise the intended use once: open the app, recognize one digit, and close it.
   Every affected comparison should address that use; local display choices stay
   local. Preserve earlier measurements with their original scope.
5. Gather into one conversation and explain the choice, its evidence, and what
   remains unknown. Keep useful views available to revisit.

Recorded warm inference with resident inputs does not establish app startup time.
Cloud correctness runs do not establish Apple silicon performance. Implementations
may develop concurrently, but benchmark shared hardware without competing runs.

Every new pane should make something useful visible. Competing opinions are one
reason to split, not a required explanation for multiplicity. A local edit should
stay local; a shared constraint should affect all relevant work without manual
message routing. Full conversational continuity across independently interactive
instances remains an acceptance target, not a capability established by a pane demo.

## Evidence before architecture

The baseline is the simplest useful implementation on an existing agent runtime
and a terminal multiplexer, including Claude Code/Agent SDK with tmux. Compare
the same outcomes, models and settings where possible, and count lost results,
manual intervention, latency, and maintenance burden. Fast local pane operations
alone do not establish a better multiagent experience.

Start by comparing one ordinary agent with the same agent given a concise
instruction to keep relevant perspectives jointly in view. Use the same task,
evidence, tools, model, and budget. Do not give one condition extra factual hints.
An advisor with a team remains a valid implementation and comparison baseline.
Keep the simplest approach that meets the user's needs.

Evaluate whether the resulting explanation supports a correct decision when the
use case changes. Simulated agreement or a model's self-score does not establish
human understanding. Record failures, user corrections, usage, and time to a
trustworthy result; distinguish local tool time, full request time, and measured
application performance. Do not promote a perspective instruction into the
production runtime merely because the idea is appealing.
