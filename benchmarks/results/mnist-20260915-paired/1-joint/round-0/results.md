# MNIST comparison results

Source: `reference/examples/mnist/measurements.json` (Jade's recorded fixture). These are median inference times in milliseconds on an Apple M3 Max, using the shared 784 → 128 → 10 float32 model and resident inputs. The measurements are not new runs in this directory.

| Source run | Batch 1 (ms) | Batch 128 (ms) | Batch 1,000 (ms) |
|---|---:|---:|---:|
| numpy-cpu | 0.00496 | 0.04035 | 0.24129 |
| torch-cpu | 0.00698 | 0.03654 | 0.20448 |
| torch-gpu (MPS) | 0.24163 | 0.27719 | 0.32400 |
| mlx-cpu | 0.02571 | 0.05646 | 0.22867 |
| mlx-gpu (Metal) | 0.19454 | 0.23112 | 0.28265 |
| jax-js-wasm | 0.06000 | 0.27500 | 0.61500 |
| jax-js-webgpu | 0.41000 | 0.38250 | 0.44000 |
| max-cpu | 0.12021 | 0.15473 | 0.42781 |
| max-gpu (Metal) | 0.44748 | 0.36146 | 0.37148 |

All recorded rows can be flattened to `{id, batch, median_ms}` with:

```sh
node compare.mjs reference/examples/mnist/measurements.json
```

The fixture reports 91.4% accuracy for every recorded backend after the shared three-epoch training protocol. Its timing excludes input upload and output readback for inference, and excludes setup/compilation; the MAX measurements additionally have substantial graph compilation (especially on Metal).

## Scope

The requested Rust implementation is not present in the reference fixture, so Rust has no result here. The table also includes Jade's jax-js rows because the utility intentionally prints every inference measurement in the supplied JSON.
