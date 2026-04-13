import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FAL_QUEUE_API_URL = "https://queue.fal.run/fal-ai/imageutils/depth";
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 90_000;

function fileToDataUri(file: File, base64Data: string): string {
  const mime = file.type || "image/png";
  return `data:${mime};base64,${base64Data}`;
}

function bufferToDataUri(contentType: string | null, buffer: Buffer): string {
  const mime = contentType || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  const falKey = process.env.FAL_KEY ?? process.env.FAL_Key;

  if (!falKey) {
    return NextResponse.json(
      { error: "Missing FAL_KEY environment variable" },
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
    return NextResponse.json(
      { error: `fal.ai request failed: ${errorText}` },
      { status: submitResponse.status }
    );
  }

  const payload = await submitResponse.json();
  const responseUrl: string | undefined = payload?.response_url;

  if (!responseUrl) {
    return NextResponse.json(
      { error: "fal.ai queue response missing `response_url`", payload },
      { status: 502 }
    );
  }

  const startedAt = Date.now();
  let resultPayload: any = null;
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const resultResponse = await fetch(responseUrl, {
      headers: {
        Authorization: `Key ${falKey}`,
      },
      cache: "no-store",
    });

    if (resultResponse.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      return NextResponse.json(
        { error: `fal.ai polling failed: ${errorText}` },
        { status: resultResponse.status }
      );
    }

    resultPayload = await resultResponse.json();
    break;
  }

  if (!resultPayload) {
    return NextResponse.json(
      { error: "fal.ai queue timeout" },
      { status: 504 }
    );
  }

  const modelResult = resultPayload?.result ?? resultPayload?.output ?? resultPayload?.data ?? resultPayload;
  const depthUrl: string | undefined = modelResult?.image?.url ?? modelResult?.images?.[0]?.url;

  if (!depthUrl) {
    return NextResponse.json(
      { error: "fal.ai returned no depth image URL", payload: resultPayload },
      { status: 502 }
    );
  }

  const depthImageResponse = await fetch(depthUrl);
  if (!depthImageResponse.ok) {
    return NextResponse.json(
      { error: "Failed to download generated depth image from fal.ai" },
      { status: 502 }
    );
  }

  const depthBuffer = Buffer.from(await depthImageResponse.arrayBuffer());
  const depthDataUrl = bufferToDataUri(
    depthImageResponse.headers.get("content-type"),
    depthBuffer
  );

  return NextResponse.json({ depthUrl, depthDataUrl });
}
