# Recommendation

## Choose now

Because the normal interaction is **open → recognize one digit → close**, choose **NumPy on CPU as the provisional implementation**. It has the best recorded batch-1 kernel (0.00496 ms versus PyTorch CPU's 0.00698 ms), the smallest dependency surface, and is already the correctness baseline. For this workflow, cold startup, model loading, preprocessing, and teardown will dominate the difference between those two kernels; the recorded batch-128/1,000 advantage of PyTorch is not relevant.

MLX is a credible Apple-native choice, but this workload does not justify it: its CPU batch-1 result is slower, and Metal is slower still. Mojo/MAX is not the current default because its graph compilation/setup cost is substantial. The GPU runs should not be selected for this tiny network based on these measurements. Rust remains potentially interesting for a small self-contained executable, but is unmeasured.

## Concrete next measurement

On the target MacBook, measure **30 truly cold one-shot launches** of the eventual recognizer, each reading one digit and exiting. Record total wall time, and separately report p50/p95 for: process launch + model load, preprocessing, inference, and shutdown. For example, after the one-shot entry point exists:

```sh
hyperfine --runs 30 --warmup 0 \
  './mnist-one-shot --input digit.png --output /dev/null'
```

Run the same command for NumPy, PyTorch CPU, and the Rust candidate, with the OS/app caches treated consistently. This is the measurement most likely to change the provisional choice; also repeat it with the recognizer kept resident to establish the per-digit latency floor.

## Still needs testing

- **Rust:** record an equivalent one-shot Rust implementation (and decide whether it uses Accelerate, another BLAS, or a hand-written kernel). It is currently unmeasured, so no fair startup or latency recommendation is possible.
- **This MacBook:** repeat the cold-launch and resident-process measurements on the target hardware and representative power/thermal states.
- **Real serving path:** include image preprocessing, model loading, allocation, input/output conversion, UI open/close, and one-image p50/p95—not only resident-input kernel timing.
- **Deployment fit:** compare package size, startup time, memory, supported macOS versions, and the operational cost of PyTorch versus a NumPy or Rust executable.
- **Model validity:** confirm accuracy on the intended full dataset and trained/exported weights; the fixture's 0.914 result is only a shared sanity check.

**Provisional decision:** start with NumPy CPU. Switch to PyTorch CPU only if the cold-launch measurement shows startup is acceptable and its ecosystem or future batching/model growth is valuable. Keep Rust as the next focused benchmark rather than assuming it wins.
