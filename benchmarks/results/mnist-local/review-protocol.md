# Exploratory MNIST perspective pilot

This is a bounded live review of real recorded Jade results, not a test of building
the recognizer, fresh application timings, or a demonstration of superiority over
an advisor and team. Run the existing Pi agent in an isolated Herdr workspace.

Both conditions receive identical reference files and four user turns, have the
same tools/model/thinking setting, and use one conversation. The treatment adds
only a generic instruction to keep implementation, evidence, use, and reader
interpretation jointly in view. No role dialogue or extra workers are requested.
Use Luna/medium as the existing small-model diagnostic default. Preserve every
attempt, including timeouts and workspace failures. Do not silently retry failures.

Record total request time, each local tool execution duration, model usage, files
after each turn, pane IDs/layout/view records, and the conversation. These clocks
are not application inference timings. Do not estimate model latency by simply
subtracting overlapping tool durations from total request time.

Review criteria (inspect meaning and evidence; no keyword score):

1. Recorded values and backend/device distinctions are faithfully represented;
   Rust is unmeasured, and the Python baseline uses NumPy.
2. The changed display unit is numerically correct (microseconds / 1000) and
   unrelated measurements stay unchanged.
3. The revised use case reaches the comparison, recommendation, and final answer.
   Recorded warm resident-input inference is not described as fresh app startup.
   No cold-start winner is falsely established by the existing data.
4. Training accuracy does not establish that latency trials used trained weights.
   A recommendation may be provisional, with supporting reasons and missing evidence.
5. Existing reference files and saved current artifacts survive gathering. No new
   model instance is needed to maintain these useful views.

Human understanding has not been measured. A future blinded reader should be able
to identify what the latency comparison includes, explain what is still unknown
for a fresh single-digit app launch, and say which measurements matter if the app
instead processes a large resident batch. Model self-confidence is not a score.

This first exploratory pair uses baseline then treatment. If repeated, reverse
the order and use matched paraphrases. A few trials can reveal failures and gross
overhead, but cannot prove a general quality or speed advantage.
