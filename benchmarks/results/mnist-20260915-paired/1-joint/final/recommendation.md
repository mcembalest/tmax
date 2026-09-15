# Recommendation

## What we can choose now

For a small **single-image, on-device recognizer**, keep **NumPy on CPU as the current baseline**: it is the fastest recorded batch-1 path (0.00496 ms median), simple, and already validated against the shared fixture. However, because the process is opened and closed for one digit, steady-state inference is probably not the dominant cost; imports, model loading, preprocessing, and teardown matter more. Do not choose PyTorch CPU merely for its batch advantage here: its batch-1 median is slower (0.00698 ms), and its startup/package footprint may be less favorable. PyTorch remains sensible only if the surrounding application already requires it.

MLX is a reasonable Apple-native follow-up, but this tiny model does not benefit from moving to Metal in the recorded test: MLX CPU/Metal are 0.02571/0.19454 ms at batch 1. MAX/Mojo is not the default recommendation for this workload because its recorded inference is slower for small batches and its graph compilation/setup cost is high. MPS likewise loses to CPU for this model.

These are engineering choices, not a claim that the fastest fixture row is automatically the best product runtime. Packaging, API ergonomics, memory ownership, and cold-start behavior can dominate a tiny network.

## What still needs testing

- **Rust:** no Rust backend or run is included in `reference/examples/mnist`; implement or select the intended Rust runtime and measure it under the same model, weights, accuracy check, and batch sizes.
- **Real workload:** repeat with the expected batch distribution (especially batch 1), end-to-end image preprocessing, input upload/output conversion, and application integration. The fixture deliberately excludes transfers.
- **Cold start and packaging:** measure process startup, imports, model loading, and first inference. The fixture excludes setup and warmups; MAX also compiles graphs separately.
- **Device and version coverage:** rerun on the actual MacBook model and target macOS/runtime versions. The source measurements are from an M3 Max and are not portable performance guarantees.
- **Production model:** verify the final trained/exported weights and accuracy, not only Jade's untrained-weight inference timing.

## Next measurement to run

Measure the user-visible cold path, not another steady-state batch benchmark. Build a tiny inference-only entry point for each candidate that loads the final model, reads one fixed MNIST image, preprocesses it, runs exactly one prediction, prints the digit, and exits. Then run 30 fresh processes per candidate, for example:

```sh
hyperfine --runs 30 --warmup 0 \
  'uv run --script --locked infer_once_numpy.py data/sample.png' \
  'uv run --script --locked infer_once_torch.py data/sample.png'
```

Record median and p95 wall time, plus peak RSS from `/usr/bin/time -l`; repeat the same protocol for Rust, MLX, and MAX. Include model load and preprocessing, but report the already-measured inference median separately. This directly answers whether the tiny batch-1 advantage survives the open-and-close workflow.

Until that cold-path measurement and the Rust result exist, the defensible short list is NumPy CPU for the simplest baseline, with PyTorch CPU only when its surrounding ecosystem is valuable.
