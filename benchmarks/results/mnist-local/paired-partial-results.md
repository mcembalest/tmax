# MNIST comparison results

This is the first runnable comparison built on Jade's existing benchmark. It does not modify any backend. The source is [`measurements.json`](measurements.json), and the flattening command is:

```sh
node compare.mjs measurements.json
```

The measurements are medians in milliseconds (50 synchronized inference calls after five warmups), using resident inputs and excluding input upload/output readback. The fixture is the shared 784 → 128 → 10 float32 ReLU model on an Apple M3 Max; each recorded run reached 91.4% accuracy.

## Recorded inference measurements

`id` is the source run key. This table contains every inference record emitted by `compare.mjs`.

| id | batch | median_ms |
| --- | ---: | ---: |
| numpy-cpu | 1 | 0.004958 |
| numpy-cpu | 128 | 0.040354 |
| numpy-cpu | 1000 | 0.241292 |
| torch-cpu | 1 | 0.006980 |
| torch-cpu | 128 | 0.036541 |
| torch-cpu | 1000 | 0.204479 |
| torch-gpu | 1 | 0.241626 |
| torch-gpu | 128 | 0.277188 |
| torch-gpu | 1000 | 0.324001 |
| mlx-cpu | 1 | 0.025709 |
| mlx-cpu | 128 | 0.056458 |
| mlx-cpu | 1000 | 0.228666 |
| mlx-gpu | 1 | 0.194542 |
| mlx-gpu | 128 | 0.231125 |
| mlx-gpu | 1000 | 0.282646 |
| jax-js-wasm | 1 | 0.060000 |
| jax-js-wasm | 128 | 0.275000 |
| jax-js-wasm | 1000 | 0.615000 |
| jax-js-webgpu | 1 | 0.410000 |
| jax-js-webgpu | 128 | 0.382500 |
| jax-js-webgpu | 1000 | 0.440000 |
| max-cpu | 1 | 0.120208 |
| max-cpu | 128 | 0.154729 |
| max-cpu | 1000 | 0.427813 |
| max-gpu | 1 | 0.447480 |
| max-gpu | 128 | 0.361459 |
| max-gpu | 1000 | 0.371479 |

## What the current data says

- For the likely MNIST use case (one image at a time), NumPy CPU is fastest at 0.004958 ms; PyTorch CPU is close at 0.006980 ms.
- At batch 128 and 1,000, PyTorch CPU is fastest (0.036541 ms and 0.204479 ms).
- GPU paths lose for this very small model. The overhead dominates the arithmetic.
- All recorded backends agree on the accuracy sanity check, but these are inference timings with identical **untrained** weights; they are not a production accuracy evaluation.
- There is no Rust run in the supplied measurements, so Rust cannot yet be ranked.

Training medians are also available in the source runs and README. They are secondary for choosing an inference-only recognizer.
