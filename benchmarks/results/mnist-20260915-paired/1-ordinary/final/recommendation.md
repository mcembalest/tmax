# Recommendation

## Choice available now

For a recognizer that is opened for one digit and then closed, start with **NumPy on CPU**, provided its cold-start footprint is acceptable. It has the best recorded batch-1 kernel latency (0.0050 ms), but that is not the reason to choose it: the important advantage to verify is likely lower startup and initialization cost.

**PyTorch on CPU** is the fallback if its packaging, model-loading, or deployment ecosystem is more convenient. Its 0.0070 ms batch-1 kernel is effectively tied for this workflow; its batch-throughput advantage is irrelevant when only one digit is processed.

Do not choose MPS/Metal, Mojo/MAX, or browser JAX for this open-one-close use case based on these measurements. Their accelerator/runtime overhead is especially unlikely to repay itself for one small inference. MLX CPU is worth a cold-start test only if Apple-native packaging is a requirement.

## What is not decided

- **Rust has no recorded run** in the supplied fixture, so it cannot be ranked. It needs an implementation using the same weights and accuracy check.
- This does not measure the end-to-end shipped-app path: startup/import time, model loading, memory, packaging, and input/output conversion are excluded.
- Only one machine, a reported Apple M3 Max, and one small model were measured. The kernel result may change for a larger network, but that is secondary for one digit per launch.
- The measurements are historical fixture data; rerun the existing backends on the target Mac before treating close CPU results as a decision.

## Next test

Run 30 fresh NumPy-CPU and PyTorch-CPU processes (optionally MLX CPU), each loading the model, predicting one digit, and exiting. Capture wall time to prediction, p95, peak RSS, and accuracy. Choose the runtime with the best acceptable cold-start/user-visible latency—not the few-microsecond kernel winner. Then add Rust to the same cold-start test if its smaller native footprint is attractive.
