# Recommendation

## What we can choose now

For the stated **open, recognize one digit, close** workflow, choose **NumPy on CPU as the leading candidate**. It has the fastest recorded warm batch-1 inference (0.00496 ms), the simplest dependency story, and a much lower recorded setup time (about 19 ms) than PyTorch CPU (about 882 ms). The warm inference gap is tiny, so this recommendation is primarily about expected cold-start simplicity—not just the table's inference cell.

PyTorch CPU remains the choice for a long-lived process or batched work: it wins the recorded batch-128 and batch-1,000 tests. MLX is a reasonable Apple-native alternative, but is slower at batch 1 and has not been measured here as an end-to-end open/close session. Mojo/MAX is not a fit for this lifecycle on current evidence: graph compilation is substantial, and its warm batch-1 result is already slower. The recorded Metal runs do not justify GPU use for one digit. Rust is not present in Jade's existing MNIST comparison, so it cannot be selected on evidence yet.

## What still needs testing

The decisive missing number is cold end-to-end latency on the actual MacBook: process launch → imports/model load → one prediction → exit, including preprocessing. Run 30 fresh processes per candidate and compare median and p95; use the concrete first-pass loop in `results.md`, then replace the full training runner with a minimal harness for the final measurement. Also add a Rust implementation using the same fixture, and check memory footprint, binary/package size, and accuracy. Repeat after any model-size change: this ranking is for the small 784→128→10 network and the recorded M3 Max, not a universal deployment result.

The current measurements use untrained, identical weights for inference and report a small 784→128→10 network. They establish a useful first ranking, not a universal ranking for a larger recognizer or a different Mac. Use `node compare.mjs reference/examples/mnist/measurements.json` to obtain all recorded inference rows as JSON.
