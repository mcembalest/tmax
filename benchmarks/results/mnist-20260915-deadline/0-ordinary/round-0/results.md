# MNIST comparison results

This is a small, runnable view of Jade's existing MNIST measurements. The source is read-only at `reference/examples/mnist/measurements.json`; no backend was changed. To print every recorded inference point:

```sh
node compare.mjs reference/examples/mnist/measurements.json
```

The output is a JSON array with `id` (the source run key), `batch`, and `median_ms`. It currently contains 27 points: three batch sizes for each of nine recorded runs.

## Recorded inference medians

| Run | Batch 1 (ms) | Batch 128 (ms) | Batch 1,000 (ms) |
| --- | ---: | ---: | ---: |
| NumPy · CPU | 0.00496 | 0.04035 | 0.24129 |
| PyTorch · CPU | 0.00698 | **0.03654** | **0.20448** |
| PyTorch · MPS | 0.24163 | 0.27719 | 0.32400 |
| MLX · CPU | 0.02571 | 0.05646 | 0.22867 |
| MLX · Metal | 0.19454 | 0.23112 | 0.28265 |
| jax-js · WASM | 0.06000 | 0.27500 | 0.61500 |
| jax-js · WebGPU | 0.41000 | 0.38250 | 0.44000 |
| Mojo / MAX · CPU | 0.12021 | 0.15473 | 0.42781 |
| Mojo / MAX · Metal | 0.44748 | 0.36146 | 0.37148 |

NumPy is the fastest recorded single-image inference. PyTorch CPU is fastest at batches 128 and 1,000; NumPy remains close. Among the recorded GPU/accelerator runs, MLX Metal is fastest at all three batch sizes.

## How to read this

These are medians after five warmups and 50 calls, with resident inputs and synchronized outputs. They exclude imports, setup, model loading, input preparation, input upload, and output readback. The fixture is a 784 → 128 → 10 float32 ReLU model, and all recorded runs reached 91.4% accuracy on the shared test slice.

The source machine was an Apple M3 Max, not necessarily the target MacBook. Training figures and compile/setup costs are intentionally not folded into the inference medians.

## Coverage

The existing comparison records NumPy, PyTorch, MLX, jax-js, and Mojo/MAX. It has **no Rust run**, so Rust cannot be ranked from these results yet.
