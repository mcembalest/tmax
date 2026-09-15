# MNIST comparison results

This is a small read-only comparison of the measurements already recorded in `reference/examples/mnist/measurements.json`. The shared protocol is a 784 → 128 → 10 float32 ReLU model, with resident inputs and synchronized inference; medians are from 50 calls after five warmups. Values below are milliseconds per inference call.

Run the extractor with:

```sh
node compare.mjs reference/examples/mnist/measurements.json
```

That prints all 27 recorded inference measurements as `{ id, batch, median_ms }` objects. `id` is the source run key, not a newly assigned label.

| Source run | Stack / device | Train median (3 trials, ms) | Batch 1 | Batch 128 | Batch 1,000 | Accuracy |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `numpy-cpu` | NumPy / CPU | 61.87 | 0.0050 | 0.0404 | 0.2413 | 91.4% |
| `torch-cpu` | PyTorch / CPU | 62.41 | 0.0070 | 0.0365 | 0.2045 | 91.4% |
| `torch-gpu` | PyTorch / MPS | 381.59 | 0.2416 | 0.2772 | 0.3240 | 91.4% |
| `mlx-cpu` | MLX / CPU | 89.73 | 0.0257 | 0.0565 | 0.2287 | 91.4% |
| `mlx-gpu` | MLX / Metal | 152.84 | 0.1945 | 0.2311 | 0.2826 | 91.4% |
| `max-cpu` | Mojo / MAX / CPU | 177.27 | 0.1202 | 0.1547 | 0.4278 | 91.4% |
| `max-gpu` | Mojo / MAX / Metal | 866.10 | 0.4475 | 0.3615 | 0.3715 | 91.4% |
| `jax-js-wasm` | jax-js / WASM | 1,402.71 | 0.0600 | 0.2750 | 0.6150 | 91.4% |
| `jax-js-webgpu` | jax-js / WebGPU | 1,318.03 | 0.4100 | 0.3825 | 0.4400 | 91.4% |

## What these numbers say

- For the actual one-digit inference kernel, NumPy CPU is fastest at batch 1 (0.0050 ms), with PyTorch CPU next (0.0070 ms).
- That difference is negligible if the recognizer is opened and closed for every digit. The dominant metric is likely cold process startup plus runtime/model initialization, which this table deliberately excludes.
- The tested MPS/Metal paths do not beat the one-thread CPU paths for this very small model; accelerator launch/synchronization overhead dominates. Keeping a GPU runtime alive would matter more for a long-lived or high-throughput session, not this usage pattern.
- All recorded runs passed the same numerical checks and reached 91.4% on the 1,000-image check set.

These are existing measurements, not a new run on this machine. The protocol excludes imports, setup, compilation, and data preparation, so it is an inference-kernel comparison rather than an end-to-end app benchmark. For open-one-digit-close, do not treat the inference columns as a complete user-visible latency ranking.

## Concrete next measurement

Measure **cold end-to-end time to one prediction** for NumPy CPU and PyTorch CPU (then MLX CPU if desired): 30 fresh process launches per stack, each loading the model and one image, performing one prediction, and exiting. Record wall-clock time from process launch until the prediction is available, plus peak RSS and output accuracy; report median and p95. This directly tests the workflow that matters here. Keep the current kernel benchmark unchanged so the two kinds of latency are not conflated.
