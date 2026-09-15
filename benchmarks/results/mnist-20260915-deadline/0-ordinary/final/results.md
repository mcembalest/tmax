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

NumPy is the fastest recorded steady-state single-image inference (**0.00496 ms**), so it is the latency leader for the neural-network call itself. However, the intended use is one digit per launch: open the recognizer, recognize once, and close it. In that workflow, process startup, runtime import, model loading, preprocessing, and teardown will dominate these microsecond-scale medians. Batch-128 and batch-1,000 winners are not relevant. Among the recorded GPU/accelerator runs, MLX Metal is fastest at batch 1, but that does not establish that paying GPU/runtime startup costs is worthwhile for one digit.

## How to read this

These are medians after five warmups and 50 calls, with resident inputs and synchronized outputs. They exclude imports, setup, model loading, input preparation, input upload, and output readback. The fixture is a 784 → 128 → 10 float32 ReLU model, and all recorded runs reached 91.4% accuracy on the shared test slice.

The source machine was an Apple M3 Max, not necessarily the target MacBook. Training figures and compile/setup costs are intentionally not folded into the inference medians.

## One-digit, open-and-close next measurement

Build a minimal inference-only entry point for each finalist that accepts one image and exits. Then run 30 fresh processes per candidate, for example:

```sh
hyperfine --warmup 0 --runs 30 \
  'uv run --script recognizer_numpy.py digit.png' \
  'uv run --script recognizer_torch.py digit.png' \
  'uv run --script recognizer_mlx.py digit.png'
```

Record the median, p95, and peak RSS for the **whole command**, including import, model load, preprocessing, one inference, output, and process exit. Use the same image and release/pinned environments. If a Rust binary is available, add `'./recognizer-rust digit.png'`; its likely startup advantage is exactly what this measurement should test. Repeat once with a warm resident process only as a diagnostic, not as the selection metric.

The existing comparison records NumPy, PyTorch, MLX, jax-js, and Mojo/MAX. It has **no Rust run**, and it does not measure fresh-process one-digit use, so neither Rust nor the final open-and-close choice can be ranked yet.
