# Handwritten-digit recognizer: implementation comparison

## Evidence reviewed

The target is a one-shot app: launch, recognize one digit, and exit. That makes cold startup/setup and batch-1 inference more important than training time or large-batch throughput.

The reference implementation compares a `784 → 128 → 10` float32 ReLU MLP on an Apple M3 Max. It uses the first 10,000 MNIST training images, 1,000 test images, Adam, 3 epochs/237 updates, three trials, and identical NumPy-generated initialization/order. Training includes batch transfers and synchronization; inference uses resident inputs and excludes transfers. Every recorded backend reached 91.4% accuracy on the fixed test slice.

The table below reports the reference medians. Training is total time for three epochs; inference is one call. These are measurements of this small workload, not a general hardware ranking.

| Candidate | Reference evidence | Maintenance / fit assessment | Main concern |
|---|---|---|---|
| **Python / NumPy** | CPU: **61.87 ms** train; **0.00496 ms** (batch 1), **40.35 / 241.29 µs** (batches 128/1000). Recorded setup: **19 ms**. | Best evidence-backed fit for one-shot use: tiny batch-1 compute, minimal stack, and the lowest recorded setup among the Python stacks. Explicit forward/backprop/Adam is easy to inspect and validate. | Actual process launch/UI packaging is not measured. Manual gradients and optimizer code become liabilities as the model grows; CPU-only here. |
| **PyTorch** | CPU: **62.41 ms**; **0.00698 ms** (batch 1), **36.54 / 204.48 µs** (128/1000). MPS: **381.59 ms**; **0.24163 ms** (batch 1), **277.19 / 324.00 µs** (128/1000). Recorded setup: **882 ms** CPU, **990 ms** MPS. | Strongest growth path, but its recorded setup is much larger than NumPy’s for a one-shot app. It has autograd, mature tooling, tests, serialization, and a large ecosystem. | Larger install/runtime surface; MPS is slower and has higher tail variability here, so GPU is not an automatic win. |
| **MLX** | CPU: **89.73 ms**; **0.02571 ms** (batch 1), **56.46 / 228.67 µs** (128/1000). Metal: **152.84 ms**; **0.19454 ms** (batch 1), **231.12 / 282.65 µs** (128/1000). Recorded setup: **59 ms** CPU, **140 ms** Metal. | Reasonable Apple-native alternative, but slower setup and batch-1 inference than NumPy in this evidence. | Smaller ecosystem; Metal loses to CPU for this workload and adds no one-shot advantage. |
| **Rust** | **No Rust implementation or measurement is in the reference.** | Could ultimately give the best self-contained launch/exit experience, but that is an untested hypothesis here. | Training/autodiff/data tooling is less standard; building and validating the model would add scope. Need a cold-start and batch-1 measurement before choosing it for this target. |
| **Mojo / MAX** | CPU: **177.27 ms**; **0.12021 ms** (batch 1), **154.73 / 427.81 µs** (128/1000). Metal: **866.10 ms**; **0.44748 ms** (batch 1), **361.46 / 371.48 µs** (128/1000). Accuracy 91.4%. Recorded setup was ~7.2 s CPU / ~61.5 s Metal, including ~7.1/~61.3 s graph compilation. | Compiled deployment is conceptually relevant, but the measured cold/setup cost is a decisive mismatch for open-recognize-close. | Poor fit for this tiny one-shot app; graph compilation dominates and maintainability/toolchain risk is higher. |

## Caveats

- The protocol is intentionally narrow: a tiny MLP, short training run, fixed data subset, and one M3 Max. It says little about CNNs, full-MNIST training, larger batches, or application startup/memory.
- The reference also records jax-js, but it is not a candidate requested here. Browser training was much slower (1,402.71 ms WASM; 1,318.03 ms WebGPU), so it does not change this local-Mac comparison.
- Results are medians after warmup; imports, data preparation, graph compilation, and setup are excluded from the timed training metric. The recorded setup values above are the closest available cold-start proxy, not a complete packaged-app launch measurement. MAX graphs compile separately.
- No fresh benchmarks or package installations were performed for this review. Rust has no apples-to-apples evidence yet.
