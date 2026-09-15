# Recommendation

## What we can choose now

For a small **single-image, on-device recognizer**, choose **NumPy on CPU as the current baseline**: it is the fastest recorded batch-1 path (0.00496 ms median), simple, and already validated against the shared fixture. If the application is already PyTorch-based or mostly processes batches, **PyTorch CPU** is the measured alternative: it leads the recorded batch-128 and batch-1,000 medians (0.03654 ms and 0.20448 ms) while matching the 91.4% accuracy result.

MLX is a reasonable Apple-native follow-up, but this tiny model does not benefit from moving to Metal in the recorded test: MLX CPU/Metal are 0.02571/0.19454 ms at batch 1. MAX/Mojo is not the default recommendation for this workload because its recorded inference is slower for small batches and its graph compilation/setup cost is high. MPS likewise loses to CPU for this model.

These are engineering choices, not a claim that the fastest fixture row is automatically the best product runtime. Packaging, API ergonomics, memory ownership, and cold-start behavior can dominate a tiny network.

## What still needs testing

- **Rust:** no Rust backend or run is included in `reference/examples/mnist`; implement or select the intended Rust runtime and measure it under the same model, weights, accuracy check, and batch sizes.
- **Real workload:** repeat with the expected batch distribution (especially batch 1), end-to-end image preprocessing, input upload/output conversion, and application integration. The fixture deliberately excludes transfers.
- **Cold start and packaging:** measure process startup, imports, model loading, and first inference. The fixture excludes setup and warmups; MAX also compiles graphs separately.
- **Device and version coverage:** rerun on the actual MacBook model and target macOS/runtime versions. The source measurements are from an M3 Max and are not portable performance guarantees.
- **Production model:** verify the final trained/exported weights and accuracy, not only Jade's untrained-weight inference timing.

Until Rust and end-to-end/cold-start tests exist, the defensible short list is NumPy CPU for the simplest low-latency baseline, or PyTorch CPU when its surrounding ecosystem is valuable.
