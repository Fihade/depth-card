/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { photos } from "./lib/data";
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { depthSlicer } from "./lib/slice";

const CSS_PERSPECTIVE = 980;

const SPRING_TENSION = 0.82;
const WEAK_SPRING_TENSION = 0.94;

const SLICES_OPTIONS = [2, 3, 5, 8, 13, 21, 34];
const DEFAULT_SLICES = 34;

const SPREAD_OPTIONS = [0, 0.05, 0.1, 0.2, 0.4, 0.7, 1];
const DEFAULT_SPREAD = 0;

const VOLUME_SCALE = new Array(10).fill(0).map((_, i) => {
  return Math.round(128 * Math.pow(1.22, i) - 128);
});
const DEFAULT_VOLUME = VOLUME_SCALE[2];
const DEFAULT_PHOTO = "card1";

const LOCK_CURSOR_TIME = 128;
const SNAP_TIME = 650;

export default function Home() {
  const router = useRouter();
  const { originalImage, depthImage } = router.query;

  const dataRef = useRef({
    photo: DEFAULT_PHOTO,
    slices: DEFAULT_SLICES,
    volume: 0,
    renderLayerSeparation: 0,
    forceRender: false,
    targetX: 0,
    targetY: 0,
    renderX: 0,
    renderY: 0,
    focusing: Date.now(),
  });
  const [photo, setPhoto] = useState<keyof typeof photos>(DEFAULT_PHOTO);
  const [photoDepthMap, setPhotoDepthMap] = useState<string[]>([]);
  const [ui, setUI] = useState({
    slices: DEFAULT_SLICES,
    volume: DEFAULT_VOLUME,
    spread: DEFAULT_SPREAD,
  });

  function set(
    path: "slices" | "volume" | "renderLayerSeparation" | "photo" | "focusing",
    value: any
  ) {
    // @ts-ignore
    dataRef.current[path] = value;
    dataRef.current.forceRender = true;
  }

  useEffect(() => {
    if (originalImage && depthImage) {
      console.log('Original Image:', originalImage);
      console.log('Depth Image:', depthImage);
      // Here you would typically update your state or data to use these new images
      // For now, we'll just log them
    }
  }, [originalImage, depthImage]);

  useEffect(() => {
    set("photo", photo);
    set("volume", 0);
    set("renderLayerSeparation", 0);
    set("focusing", Date.now());

    const depthMapClamp = 82;
    async function updateDepthLayers(depthSrc: string) {
      const data = dataRef.current;
      console.log("SLICING!", ui.slices, data.slices);

      const spread = ui.spread * data.slices;

      const sliceArr: [number, number][] = new Array(data.slices)
        .fill(0)
        .map((_, i) => {
          const progress = ((i + 0.5) / data.slices) * depthMapClamp;
          const sliceDiff = (100 / data.slices) * spread;
          return [
            Math.max(progress - sliceDiff),
            Math.min(progress + sliceDiff, 100),
          ];
        });

      const newDepthMap = await depthSlicer(depthSrc, sliceArr);

      setPhotoDepthMap(newDepthMap);
      set("volume", ui.volume);
    }
    updateDepthLayers(photos[photo].depthSrc);
  }, [photo, ui.slices, ui.spread]);

  const photoData = photos[photo];

  // ... (rest of your existing code for cursor movement, style updates, etc.)

  return (
    <>
      <div id="depth" className="frame pointer-events-none">
        <img
          id="image"
          alt=""
          className="absolute top-0 left-0 layer"
          src={photoData.src}
        />

        {photoDepthMap.map((depth, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="absolute top-0 left-0 layer layer-masked"
            src={photoData.src}
            style={{
              maskImage: `url(${depth})`,
            }}
          />
        ))}
      </div>
      <div className="flex gap-1 p-2">
        <Select
          value={String(photo)}
          onValueChange={(e) => {
            dataRef.current.forceRender = true;
            setPhoto(e as keyof typeof photos);
          }}
        >
          <SelectTrigger className="w-[135px]">
            <SelectValue placeholder="Change photo" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Select Photo" className="w-[150px]">
                Select Photo
              </SelectItem>
              {Object.keys(photos).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* ... (rest of your select components) */}

      </div>
      <SidebarLayer layers={photoDepthMap} />
      <Link href="/upload" className="fixed bottom-4 right-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
        Upload New Images
      </Link>
    </>
  );
}

function SidebarLayer({ layers }: { layers: string[] }) {
  // ... (your existing SidebarLayer component)
}

function Footer() {
  // ... (your existing Footer component)
}