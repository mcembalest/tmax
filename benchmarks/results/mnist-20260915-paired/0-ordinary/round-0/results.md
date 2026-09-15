# MNIST comparison results

This is a small comparison built around Jade's recorded fixture in `reference/examples/mnist/`. The reference directory was not modified. `compare.mjs` is a read-only normalizer: it prints one `{id, batch, median_ms}` object for every inference measurement in the supplied JSON.

Run it with:

```sh
node compare.mjs reference/examples/mnist/measurements.json
```

## Recorded inference medians

Apple M3 Max; milliseconds; resident inputs; output synchronized; five warmups and 50 measured calls. `id` is the source key in `runs`.

| ID | Batch 1 | Batch 128 | Batch 1,000 |
| --- | ---: | ---: | ---: |
| numpy-cpu | 0.00496 | 0.04035 | 0.24129 |
| torch-cpu | 0.00698 | 0.03654 | 0.20448 |
| torch-gpu (MPS) | 0.24163 | 0.27719 | 0.32400 |
| mlx-cpu | 0.02571 | 0.05646 | 0.22867 |
| mlx-gpu (Metal) | 0.19454 | 0.23112 | 0.28265 |
| max-cpu | 0.12021 | 0.15473 | 0.42781 |
| max-gpu (Metal) | 0.44748 | 0.36146 | 0.37148 |
| jax-js-wasm | 0.06000 | 0.27500 | 0.61500 |
| jax-js-webgpu | 0.41000 | 0.38250 | 0.44000 |

## What is comparable

All recorded native runs use the same 784 → 128 → 10 float32 ReLU model, initial weights, MNIST fixture, and inference protocol. The fixture reports 0.914 accuracy for the native training trials. Inference excludes input upload and output readback, so application end-to-end latency will be higher. These are medians from one recorded Apple M3 Max session, not a fresh benchmark of this MacBook.

## Coverage gap

There is no Rust run in the supplied measurements. The table therefore compares NumPy, PyTorch, MLX, and Mojo/MAX (plus the recorded browser JAX runs), but it does not rank Rust.
