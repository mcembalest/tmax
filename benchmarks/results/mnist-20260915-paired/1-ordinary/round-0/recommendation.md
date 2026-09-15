# Recommendation

## Choice available now

Choose **NumPy on CPU** for the first implementation if the priority is the smallest, lowest-risk on-device recognizer: it has the best recorded batch-1 latency (0.0050 ms) and is effectively tied for training speed. Choose **PyTorch on CPU** instead if its model/export/runtime ecosystem matters or the app commonly processes batches: it leads the recorded batch-128 and batch-1,000 inference cases (0.0365 ms and 0.2045 ms).

Do not choose MPS/Metal, Mojo/MAX, or browser JAX for this tiny model based on the current numbers. Their launch, synchronization, or runtime overhead outweighs their accelerator benefit here. MLX remains a sensible Apple-native option to prototype if a future, larger model needs Metal, but it is not the current latency winner.

## What is not decided

- **Rust has no recorded run** in the supplied fixture, so it cannot be ranked. It needs an implementation using the same weights, batches, warmups, synchronization, and accuracy check.
- This does not measure an end-to-end shipped Mac app: startup/import time, model loading, memory, packaging, battery/power, and input/output conversion are excluded.
- Only one machine, a reported Apple M3 Max, and one small model were measured. The best choice may change for a larger network or different batch distribution.
- The measurements are historical fixture data; rerun the existing backends on the target Mac before treating close CPU results as a decision.

## Next test

Define the real workload first (mostly batch-1, occasional bursts, or sustained batches), then add Rust without changing the existing backends and repeat the shared protocol. Follow that with a cold-start/package-size/power test for the two finalists. Until then, the practical shortlist is **NumPy CPU for simplicity** and **PyTorch CPU for throughput/ecosystem**.
