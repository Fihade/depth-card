This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Depth Generation Strategy

The app now uses **WebGPU first** in the browser for depth generation (Depth Anything V2), and automatically falls back to server-side API if WebGPU is unavailable or fails.

- Browser (preferred): transformers.js from CDN + `onnx-community/depth-anything-v2-small`
- Server fallback: `/api/depth` using `REPLICATE_API_TOKEN` (recommended) or `FAL_KEY`

## Environment Variables

Set one of these on Vercel (or local `.env.local`) for fallback server generation:

```bash
# Recommended fallback provider
REPLICATE_API_TOKEN=your_replicate_api_token

# Optional fallback provider
FAL_KEY=your_fal_api_key
```

If both are set, the server route uses `REPLICATE_API_TOKEN` first.

## Deploy on Vercel

1. Add environment variables in **Project Settings → Environment Variables**.
2. Redeploy after changing environment variables.
3. Keep all keys server-side (frontend only calls `/api/depth`).
