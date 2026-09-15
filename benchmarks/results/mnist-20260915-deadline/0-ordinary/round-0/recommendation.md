# Recommendation

## Choose now

For a small, single-image, on-device recognizer, start with **NumPy on CPU** if the priority is the lowest measured steady-state latency and the simple implementation is acceptable: **0.00496 ms** median for batch 1. It is also portable and avoids GPU/runtime transfer concerns.

If the application naturally processes batches, choose **PyTorch on CPU**: it leads the recorded batch-128 and batch-1,000 results (**0.03654 ms** and **0.20448 ms**) while matching the shared 91.4% accuracy. For a Metal-backed implementation, **MLX on Metal** is the current measured choice; it beats the recorded PyTorch MPS and Mojo/MAX Metal runs at every tested batch size.

Do not choose Mojo/MAX for this recognizer based on these data: its measured inference is slower and its graph compilation/setup cost is substantial. It may still be worth revisiting for a larger model or a deployment constraint not represented here.

## Still needs testing

- **Rust:** no Rust backend or measurement exists in the supplied work. Implement a small inference-only Rust candidate (for example, CPU matmul/ReLU or a Metal-capable runtime) and run the same fixture before ranking it.
- **Actual MacBook:** the measurements are from an M3 Max. Repeat on the exact target model, with release builds and the intended power/thermal mode.
- **End-to-end latency:** measure process startup, model loading, image decoding/preprocessing, input upload, inference, and output handling. The current medians deliberately exclude most of these.
- **Workload shape:** confirm whether traffic is mostly batch 1 or batched, and measure sustained throughput and tail latency (p95/p99), not only warm medians.
- **Production model:** validate the eventual trained weights, accuracy, memory use, package size, and cold-start behavior. The shared benchmark uses a small 784 → 128 → 10 float32 model and untrained weights for inference timing.

Therefore the defensible decision today is **NumPy CPU for simplest batch-1 deployment**, **PyTorch CPU for batching**, or **MLX Metal when GPU execution is required**. Rust remains an open comparison, and an end-to-end target-device test should decide the final choice.
