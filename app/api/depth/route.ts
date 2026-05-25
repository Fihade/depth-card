import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FAL_QUEUE_API_URL = "https://queue.fal.run/fal-ai/imageutils/depth";
const REPLICATE_PREDICTIONS_URL =
  "https://api.replicate.com/v1/models/cjwbw/depth-anything/predictions";
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 90_000;

type DepthGenerationResult = {
  depthUrl: string;
  provider: "replicate" | "fal";
};

function fileToDataUri(file: File, base64Data: string): string {
  const mime = file.type || "image/png";
  return `data:${mime};base64,${base64Data}`;
}

function bufferToDataUri(contentType: string | null, buffer: Buffer): string {
  const mime = contentType || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function pollJson(
  url: string,
  init: RequestInit,
  timeoutMs = POLL_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS
): Promise<any> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(url, { ...init, cache: "no-store" });

    if (response.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Polling failed with status ${response.status}`);
    }

    return response.json();
  }

  throw new Error("queue timeout");
}

function extractFalDepthUrl(resultPayload: any): string | undefined {
  const modelResult =
    resultPayload?.result ??
    resultPayload?.output ??
    resultPayload?.data ??
    resultPayload;

  return modelResult?.image?.url ?? modelResult?.images?.[0]?.url;
}

function extractReplicateDepthUrl(payload: any): string | undefined {
  const output = payload?.output;

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }

  return undefined;
}

async function runReplicateDepth(
  dataUri: string,
  replicateToken: string
): Promise<DepthGenerationResult> {
  const submitResponse = await fetch(REPLICATE_PREDICTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        image: dataUri,
      },
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`replicate request failed: ${errorText}`);
  }

  const submittedPayload = await submitResponse.json();
  let resultPayload = submittedPayload;

  if (
    submittedPayload?.status &&
    ["starting", "processing"].includes(submittedPayload.status)
  ) {
    const getUrl: string | undefined = submittedPayload?.urls?.get;
    if (!getUrl) {
      throw new Error("replicate response missing status URL");
    }

    resultPayload = await pollJson(getUrl, {
      headers: {
        Authorization: `Bearer ${replicateToken}`,
      },
    });
  }

  if (["failed", "canceled"].includes(resultPayload?.status)) {
    throw new Error(
      `replicate prediction ${resultPayload.status}: ${
        resultPayload?.error || "unknown error"
      }`
    );
  }

  const depthUrl = extractReplicateDepthUrl(resultPayload);

  if (!depthUrl) {
    throw new Error("replicate returned no depth image URL");
  }

  return { depthUrl, provider: "replicate" };
}

async function runFalDepth(dataUri: string, falKey: string): Promise<DepthGenerationResult> {
  const submitResponse = await fetch(FAL_QUEUE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: dataUri,
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`fal.ai request failed: ${errorText}`);
  }

  const payload = await submitResponse.json();
  const responseUrl: string | undefined = payload?.response_url;

  if (!responseUrl) {
    throw new Error("fal.ai queue response missing `response_url`");
  }

  const resultPayload = await pollJson(responseUrl, {
    headers: {
      Authorization: `Key ${falKey}`,
    },
  });

  const depthUrl = extractFalDepthUrl(resultPayload);

  if (!depthUrl) {
    throw new Error("fal.ai returned no depth image URL");
  }

  return { depthUrl, provider: "fal" };
}

export async function POST(request: Request) {
  const falKey = process.env.FAL_KEY ?? process.env.FAL_Key;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken && !falKey) {
    return NextResponse.json(
      {
        error:
          "Missing environment variable. Set REPLICATE_API_TOKEN (recommended) or FAL_KEY.",
      },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Missing image file field `image`" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const dataUri = fileToDataUri(image, buffer.toString("base64"));

  try {
    const result = replicateToken
      ? await runReplicateDepth(dataUri, replicateToken)
      : await runFalDepth(dataUri, falKey as string);

    const depthImageResponse = await fetch(result.depthUrl);

    if (!depthImageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated depth image" },
        { status: 502 }
      );
    }

    const depthBuffer = Buffer.from(await depthImageResponse.arrayBuffer());
    const depthDataUrl = bufferToDataUri(
      depthImageResponse.headers.get("content-type"),
      depthBuffer
    );

    return NextResponse.json({
      depthUrl: result.depthUrl,
      depthDataUrl,
      provider: result.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Depth generation failed";

    const status = /timeout/i.test(message) ? 504 : 502;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}
