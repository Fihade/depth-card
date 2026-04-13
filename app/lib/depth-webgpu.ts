"use client";

const TRANSFORMERS_ESM_URL =
  "https://esm.sh/@huggingface/transformers@3.7.2?bundle";

let estimatorPromise: Promise<any> | null = null;

export function isWebGpuAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean((navigator as Navigator & { gpu?: unknown }).gpu)
  );
}

async function loadPipelineFactory() {
  const mod = await import(
    /* webpackIgnore: true */ TRANSFORMERS_ESM_URL
  );

  const pipeline = mod?.pipeline;
  if (!pipeline) {
    throw new Error("无法加载浏览器端 transformers pipeline");
  }

  return pipeline;
}

async function getEstimator() {
  if (!estimatorPromise) {
    estimatorPromise = (async () => {
      const pipeline = await loadPipelineFactory();

      return pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
        device: isWebGpuAvailable() ? "webgpu" : "wasm",
      });
    })();
  }

  return estimatorPromise;
}

function normalizeToDataUrl(
  width: number,
  height: number,
  raw: Float32Array | number[]
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 Canvas 上下文");
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < raw.length; i++) {
    const v = Number(raw[i]);
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = Math.max(max - min, 1e-6);
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const normalized = Math.round(((Number(raw[i]) - min) / range) * 255);
    const offset = i * 4;
    imageData.data[offset] = normalized;
    imageData.data[offset + 1] = normalized;
    imageData.data[offset + 2] = normalized;
    imageData.data[offset + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function generateDepthDataUrlInBrowser(image: File): Promise<string> {
  const estimator = await getEstimator();
  const source = URL.createObjectURL(image);

  try {
    const output = await estimator(source);
    const depthImage = output?.depth ?? output?.predicted_depth ?? output;

    if (depthImage?.toCanvas) {
      const canvas = await depthImage.toCanvas();
      return canvas.toDataURL("image/png");
    }

    if (depthImage?.data && depthImage?.width && depthImage?.height) {
      return normalizeToDataUrl(
        depthImage.width,
        depthImage.height,
        depthImage.data
      );
    }

    throw new Error("WebGPU 深度模型返回格式不支持");
  } finally {
    URL.revokeObjectURL(source);
  }
}
