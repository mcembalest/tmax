# MNIST recognizer comparison

This is a small comparison of Jade's recorded MNIST runs in `reference/examples/mnist/measurements.json`. It is a report of the existing fixture, not a new benchmark run. The machine was an Apple M3 Max; values are median inference time in milliseconds, with resident inputs and synchronized outputs, after five warmups and 50 calls.

| Source run | Stack / device | Batch 1 | Batch 128 | Batch 1,000 | Accuracy |
| --- | --- | ---: | ---: | ---: | ---: |
| `numpy-cpu` | NumPy / CPU | 0.00496 | 0.04035 | 0.24129 | 91.4% |
| `torch-cpu` | PyTorch / CPU | 0.00698 | 0.03654 | 0.20448 | 91.4% |
| `torch-gpu` | PyTorch / MPS | 0.24163 | 0.27719 | 0.32400 | 91.4% |
| `mlx-cpu` | MLX / CPU | 0.02571 | 0.05646 | 0.22867 | 91.4% |
| `mlx-gpu` | MLX / Metal | 0.19454 | 0.23112 | 0.28265 | 91.4% |
| `max-cpu` | Mojo / MAX / CPU | 0.12021 | 0.15473 | 0.42781 | 91.4% |
| `max-gpu` | Mojo / MAX / Metal | 0.44748 | 0.36146 | 0.37148 | 91.4% |
| `jax-js-wasm` | jax-js / WASM | 0.06000 | 0.27500 | 0.61500 | 91.4% |
| `jax-js-webgpu` | jax-js / WebGPU | 0.41000 | 0.38250 | 0.44000 | 91.4% |

## Reading this table for one-digit sessions

- NumPy is fastest for the measured one-at-a-time inference: 0.00496 ms once the process is already warm.
- PyTorch CPU wins only for larger batches, which are not the intended workload.
- For an open–infer–close session, startup, imports, model construction, and (for MAX) graph compilation may dominate the actual inference cell. The existing benchmark excludes process-launch time and does not measure a one-digit session end to end.
- All recorded runs passed the same 91.4% accuracy sanity check, so latency—not accuracy—separates these small models here.
- GPU/Metal is slower for this tiny network at batch 1; dispatch and synchronization overhead dominate.

A concrete next measurement is **cold end-to-end one-digit latency**: on the target MacBook, run each candidate in a fresh process 30 times, with the timer starting before process launch and ending after the first prediction, including imports, model loading, and teardown. Record median and p95 separately from warm batch-1 inference. For the existing Python candidates, a reproducible first pass is:

```sh
for backend in numpy torch mlx; do
  for n in $(seq 1 30); do
    /usr/bin/time -p uv run --script --locked reference/examples/mnist/compare.py \
      --backend "$backend" --device cpu --trials 1 \
      >/tmp/mnist-$backend-$n.log 2>/tmp/mnist-$backend-$n.time
  done
done
```

This is a deliberately conservative proxy because Jade's runner also trains; a small separate cold-start/infer harness should be used for the final number without changing `reference/`.

The raw records remain under `reference/` and were not modified. `compare.mjs` flattens every `runs[*].inference[*]` entry into the requested machine-readable form.
