# Recommendation

## Choose now

Because the recognizer is opened for one digit and then closed, the relevant metric is **fresh-process end-to-end latency**, not the recorded warm inference median. NumPy CPU is the provisional choice: it has the lowest measured batch-1 kernel time (**0.00496 ms**), avoids GPU transfers, and is likely to have the least runtime overhead. But the existing data do not prove it wins once process startup, imports, model loading, preprocessing, and teardown are included.

Do not optimize for the batch-128 or batch-1,000 PyTorch CPU wins; batching is not your workload. MLX Metal is the fastest recorded accelerator at batch 1, but its GPU/runtime initialization can overwhelm a single tiny inference. PyTorch MPS and Mojo/MAX are likewise not justified for this use based on the current evidence.

## Concrete next measurement

Create a minimal inference-only CLI for NumPy, PyTorch, MLX, and Rust (when implemented), each taking the same `digit.png` and exiting after printing one prediction. Run:

```sh
hyperfine --warmup 0 --runs 30 \
  'uv run --script recognizer_numpy.py digit.png' \
  'uv run --script recognizer_torch.py digit.png' \
  'uv run --script recognizer_mlx.py digit.png' \
  './recognizer-rust digit.png'
```

Compare whole-command median, p95, and peak RSS. This directly measures the decision you need: open → load → preprocess → infer one digit → close. Run the same test on the actual MacBook, with pinned/release builds; report Rust separately if it is not ready. A warm resident-process run can be useful diagnostically, but should not decide this open-and-close choice.

## Still needs testing

- **Rust:** no Rust backend or measurement exists in the supplied work. Implement a small inference-only Rust candidate (for example, CPU matmul/ReLU or a Metal-capable runtime) and run the same fixture before ranking it.
- **Actual MacBook:** the measurements are from an M3 Max. Repeat on the exact target model, with release builds and the intended power/thermal mode.
- **End-to-end latency:** measure process startup, model loading, image decoding/preprocessing, input upload, inference, and output handling. The current medians deliberately exclude most of these.
- **Workload shape:** confirm whether traffic is mostly batch 1 or batched, and measure sustained throughput and tail latency (p95/p99), not only warm medians.
- **Production model:** validate the eventual trained weights, accuracy, memory use, package size, and cold-start behavior. The shared benchmark uses a small 784 → 128 → 10 float32 model and untrained weights for inference timing.

Therefore the defensible decision today is **NumPy CPU for simplest batch-1 deployment**, **PyTorch CPU for batching**, or **MLX Metal when GPU execution is required**. Rust remains an open comparison, and an end-to-end target-device test should decide the final choice.
