# Recommendation

## Choose now

For a small on-device MacBook recognizer, choose **PyTorch on CPU** if this is a batched or production-oriented implementation: it is the fastest recorded native option at batch 128 (0.03654 ms) and 1,000 (0.20448 ms), while matching the 0.914 fixture accuracy. It also avoids the recorded MPS overhead for this small model.

Choose **NumPy on CPU** instead when the priority is the smallest, clearest dependency surface or single-image latency: it is the fastest recorded option at batch 1 (0.00496 ms), and remains close at larger batches. This is the best immediate baseline to ship or use as a correctness oracle.

MLX is a credible Apple-native choice, but this workload does not justify it: its CPU run is slower than both NumPy and PyTorch, and Metal is slower still. Mojo/MAX is also not the current default: its graph compilation/setup cost is substantial and its recorded inference medians trail the CPU choices. The GPU runs should not be selected for this tiny network based on these measurements.

## Still needs testing

- **Rust:** record an equivalent Rust implementation (and decide whether it means a BLAS-backed CPU path, Accelerate, or a hand-written kernel). It is currently unmeasured, so no fair recommendation is possible.
- **This MacBook:** rerun the same protocol on the target hardware, with repeated fresh sessions and representative power/thermal states.
- **Real serving path:** measure image preprocessing, model loading, allocation, input upload/output conversion, and one-image p50/p95—not only the resident-input kernel timing here.
- **Deployment fit:** compare packaging size, startup time, memory, supported macOS versions, and the operational cost of PyTorch versus a NumPy or Rust binary.
- **Model validity:** confirm accuracy on the intended full dataset and trained/exported weights; the fixture's 0.914 result is only a shared sanity check.

**Provisional decision:** start implementation with the NumPy baseline for verification, then use PyTorch CPU if batching, maintainability, or a larger model matters. Keep Rust as the next focused benchmark rather than assuming it wins.
