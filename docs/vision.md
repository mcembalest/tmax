# A multiagent

tmax is one character that can become several and come together again. The user
interacts with that character while it handles the distribution of attention,
context, and work. They should not become the manager of an agent team.

A pane is a place for something useful: a remembered conversation, live data, a
progress display, a plan taking shape, or another place the character is working.
The number of panes need not equal the number of model instances. Character,
personality, and visual design belong to the user.

Views have independent lifetimes. Something useful for five seconds may be
discarded; something useful all weekend may stay; something worth keeping may
outlive many conversations. Gathering back into one conversation does not mean
destroying the views or forgetting what happened in them.

## The demo we are working toward

1. One conversation: ask for help making a plan, using an earlier discussion.
2. Two panes: bring the relevant remembered material into view.
3. Four panes: show current information and a plan developing alongside it.
4. Give a shared constraint once. The affected views change coherently.
5. Gather into one conversation, keeping the useful views available to revisit.

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
