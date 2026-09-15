# Developing recommendation

## Use case

The app will launch, recognize **one digit**, and exit. This changes the priority: cold launch/setup and packaging matter more than training speed or throughput. The recorded batch-1 kernel times are all tiny; runtime startup is likely the dominant variable.

## What we can choose now

Choose **Python / NumPy** for the first implementation. It has the best evidence-backed fit for this one-shot workflow:

- batch-1 inference is **0.00496 ms** in the reference;
- recorded setup is about **19 ms**, versus about **59 ms** for MLX CPU and **882 ms** for PyTorch CPU;
- it has the smallest, most transparent implementation and already provides the validated numerical reference;
- it avoids unnecessary Metal/GPU startup for a tiny computation.

This is a recommendation for the current scope, not a claim that NumPy is the best general ML platform. If the model will grow substantially, **PyTorch CPU** remains the best maintainability alternative: its batch-1 kernel is also tiny (**0.00698 ms**) and its ecosystem/autograd story is stronger, but its recorded setup cost is much higher for this open-and-close pattern.

Do not choose MPS, MLX Metal, or MAX/Metal just because the Mac has a GPU. The reference shows slower batch-1 inference than CPU and/or meaningful setup/compilation cost for this tiny model.

## What still needs checking

The current evidence does **not** measure the complete user-visible operation. Before locking the shipping architecture, check:

1. **Packaged cold launch:** time from double-click/CLI invocation to ready UI and process exit, including interpreter/runtime startup, imports, model loading, and signing/notarization overhead.
2. **End-to-end recognition:** include image capture or file read, preprocessing/resize/normalization, inference, result rendering, and shutdown—not just the resident-input kernel.
3. **Packaging size and distribution:** compare a bundled Python/NumPy app with a native Rust option; verify installation and macOS signing behavior.
4. **Accuracy on real input:** the recorded 91.4% is only the fixed 1,000-image MNIST slice. Test the actual handwriting/input path and full validation data.
5. **Backend portability and maintenance:** confirm whether manual NumPy gradients are acceptable, or whether future model changes justify PyTorch.
6. **Rust option:** implement only if a self-contained native binary or launch time is a hard requirement; it has no comparable result in the reference and needs a protocol-matched cold-start/end-to-end test.

## Decision gate

Proceed with NumPy now for a thin proof of concept, preserving a backend-independent input/output contract and checkpoint format. Revisit PyTorch or Rust only if the packaged end-to-end test shows a launch, distribution, or model-evolution problem. Revisit MLX/MAX only if a larger workload demonstrates a concrete Apple-GPU or compiled-deployment win.

**Status:** developing recommendation based only on the existing reference evidence; no packages were installed and no fresh model benchmarks were run.
