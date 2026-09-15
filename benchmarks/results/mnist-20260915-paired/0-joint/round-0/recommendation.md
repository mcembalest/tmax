# Recommendation

## What we can choose now

Choose **PyTorch on CPU** as the default if the recognizer will process batches: it is the fastest recorded option at batch 128 (0.03654 ms) and 1,000 (0.20448 ms), while reaching the same 91.4% sanity-check accuracy. Choose **NumPy on CPU** instead for the smallest/simple deployment and single-image calls: it is the fastest recorded batch-1 option (0.00496 ms).

MLX is a reasonable Apple-native alternative, but it is slower than those CPU choices in this tiny model. Mojo/MAX is interesting when compiled graphs or Mojo kernels are a product requirement, not the current latency winner. The recorded Metal runs do not justify GPU use for this workload. Rust is not present in Jade's existing MNIST comparison, so it cannot be selected on evidence yet.

## What still needs testing

Before locking in a production choice, add a Rust implementation without changing the reference backends and measure it with the same fixture and protocol. Also test the actual application shape: single-image latency including preprocessing and model invocation, realistic batch sizes, sustained throughput, p95/tail latency, and cold-start/setup time. Repeat on the target MacBook model (the records are from an M3 Max), and include memory footprint, binary/package size, and development/deployment ergonomics.

The current measurements use untrained, identical weights for inference and report a small 784→128→10 network. They establish a useful first ranking, not a universal ranking for a larger recognizer or a different Mac. Use `node compare.mjs reference/examples/mnist/measurements.json` to obtain all recorded inference rows as JSON.
