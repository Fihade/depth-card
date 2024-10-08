/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { photos } from "./lib/data";
import { Analytics } from "@vercel/analytics/react"

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

  // 新增状态用于存储上传的图片
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [depthImage, setDepthImage] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedDepthUrl, setUploadedDepthUrl] = useState<string | null>(null);


  function set(
    path: "slices" | "volume" | "renderLayerSeparation" | "photo" | "focusing",
    value: any
  ) {
    // @ts-ignore
    dataRef.current[path] = value;
    dataRef.current.forceRender = true;
  }

  // 处理文件上传
  const handleOriginalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOriginalImage(e.target.files[0]);
    }
  };

  const handleDepthImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDepthImage(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (originalImage && depthImage) {
      const originalUrl = URL.createObjectURL(originalImage);
      const depthUrl = URL.createObjectURL(depthImage);
      
      setUploadedImageUrl(originalUrl);
      setUploadedDepthUrl(depthUrl);
      setPhoto('uploaded');
      
      console.log('Original Image URL:', originalUrl);
      console.log('Depth Image URL:', depthUrl);
      
      // 触发深度图片处理
      updateDepthLayers(depthUrl);
    } else {
      alert('Please upload both images');
    }
  };

  async function updateDepthLayers(depthSrc: string) {
    const data = dataRef.current;
    console.log("SLICING!", ui.slices, data.slices);

    const depthMapClamp = 82;
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

  useEffect(() => {
    set("photo", photo);
    set("volume", 0);
    set("renderLayerSeparation", 0);
    set("focusing", Date.now());

    let depthSrc: string;
    if (photo === 'uploaded') {
      if (uploadedDepthUrl) {
        depthSrc = uploadedDepthUrl;
      } else {
        console.log('No uploaded depth image available');
        return; // Exit early if no uploaded depth image
      }
    } else {
      depthSrc = photos[photo as keyof typeof photos]?.depthSrc;
      if (!depthSrc) {
        console.log('No depth source available for selected photo');
        return; // Exit early if no depth source available
      }
    }

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
    updateDepthLayers(depthSrc);
  }, [photo, ui.slices, ui.spread, uploadedDepthUrl]);

  const photoData = photo === 'uploaded' && uploadedImageUrl
  ? { src: uploadedImageUrl } 
  : photos[photo as keyof typeof photos] || photos[DEFAULT_PHOTO];

  useEffect(() => {
    function onCursorMove(e: MouseEvent) {
      const data = dataRef.current;

      const { innerWidth, innerHeight } = window;

      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;

      const scaleX = innerHeight > innerWidth ? 1.25 : 1;

      data.targetX =
        ((e.clientX - centerX) / (innerWidth + innerHeight)) * scaleX;
      data.targetY = (e.clientY - centerY) / (innerWidth + innerHeight);
    }
    function onCursorMoveTouch(e: TouchEvent) {
      // @ts-ignore
      onCursorMove(e.touches[0]);
    }

    window.addEventListener("mousemove", onCursorMove);
    window.addEventListener("touchmove", onCursorMoveTouch);

    return () => {
      window.removeEventListener("mousemove", onCursorMove);
      window.removeEventListener("touchmove", onCursorMoveTouch);
    };
  }, []);

  useEffect(() => {
    const imgContainer = document.querySelector<HTMLElement>("#depth");

    if (!imgContainer) {
      return;
    }

    function updateStyles() {
      const data = dataRef.current;
      if (!imgContainer) {
        return;
      }

      const allImgElements = imgContainer.querySelectorAll("img");

      const imgLayerBase = allImgElements[0];
      const imgLayers = Array.from(allImgElements).slice(1);

      if (!imgLayerBase) {
        return;
      }

      const targetLayerSeparation = data.volume / data.slices;

      let targetX = data.targetX;
      let targetY = data.targetY;

      // @ts-ignore
      //x: -0.075,
      // y: 0.054,
      const targetFocus = data.photo === 'uploaded' ? { x: window.innerWidth / 2, y: window.innerHeight / 2 } : photos[data.photo as keyof typeof photos]?.focus;
      if (data.focusing && targetFocus) {
        const now = Date.now();

        if (now > data.focusing + SNAP_TIME) {
          data.focusing = 0;
        } else {
          if (now < data.focusing + LOCK_CURSOR_TIME) {
            targetX = data.renderX;
            targetY = data.renderY;
          } else {
            targetX = (targetFocus.x * window.innerWidth) / 1512;
            targetY = (targetFocus.y * window.innerHeight) / 857;
          }

          data.targetX = targetX;
          data.targetY = targetY;
        }
      }

      const checkTotalDiff =
        Math.abs(targetX - data.renderX) + Math.abs(targetY - data.renderY);
      const checkLayerDiff = Math.abs(
        targetLayerSeparation - data.renderLayerSeparation
      );
      if (
        checkTotalDiff < 0.01 &&
        checkLayerDiff < 0.1 &&
        !data.forceRender &&
        !data.focusing
      ) {
        data.forceRender = false;
        window.requestAnimationFrame(updateStyles);
        return;
      }
      data.forceRender = false;

      const movementTension = data.focusing
        ? WEAK_SPRING_TENSION
        : SPRING_TENSION;

      data.renderX =
        data.renderX * movementTension + targetX * (1 - movementTension);
      data.renderY =
        data.renderY * movementTension + targetY * (1 - movementTension);

      data.renderLayerSeparation =
        data.renderLayerSeparation * WEAK_SPRING_TENSION +
        targetLayerSeparation * (1 - WEAK_SPRING_TENSION);

      const x = data.renderX * 0.618;
      const y = data.renderY * 0.618;

      const xDeg = Math.round(x * 180 * 100) / 100;
      const yDeg = Math.round(-y * 180 * 100) / 100;

      const offset = data.renderLayerSeparation;
      const baseOffset = Math.round(
        data.renderLayerSeparation * data.slices * -0.33
      );

      imgLayerBase.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${baseOffset}px)`;

      for (let i = 0; i < imgLayers.length; i++) {
        // hack - first layer looks better if it is closer than the others
        const imgLayer = imgLayers[i];
        imgLayer.style.transform = `perspective(${CSS_PERSPECTIVE}px) rotateX(${yDeg}deg) rotateY(${xDeg}deg) translateZ(${
          offset * (i + 0.5) + baseOffset
        }px)`;
      }

      window.requestAnimationFrame(updateStyles);
    }
    updateStyles();
  }, []);

  return (
    <>
      <div id="depth" className="frame pointer-events-none">
      {photoData.src && (
        <img
          id="image"
          alt=""
          className="absolute top-0 left-0 layer"
          src={photoData.src}
        />
      )}

        {photoDepthMap.map((depth, i) => (
          photoData.src && (<img
            key={i}
            id={`image-${i}`}
            alt=""
            className="absolute top-0 left-0 layer layer-masked"
            src={photoData.src}
            style={{
              maskImage: `url(${depth})`,
            }}
          />)
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

        <Select
          value={String(ui.volume)}
          onValueChange={(e) => {
            set("volume", Number(e));
            setUI((ui) => ({ ...ui, volume: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[82px]">
            <SelectValue placeholder="Volume" />
          </SelectTrigger>
          <SelectContent
            onBlur={() => {
              set("volume", ui.volume);
            }}
          >
            <SelectGroup>
              <SelectItem disabled value="Volume">
                Volume
              </SelectItem>

              {VOLUME_SCALE.map((separation) => (
                <SelectItem
                  key={separation}
                  onFocus={() => {
                    set("volume", separation);
                  }}
                  value={String(separation)}
                >
                  {separation}px
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(ui.slices)}
          onValueChange={(e) => {
            set("slices", Number(e));
            setUI((ui) => ({ ...ui, slices: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[60px]">
            <SelectValue placeholder="Layer Separation" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Slices">
                Slices
              </SelectItem>
              {SLICES_OPTIONS.map((slices) => (
                <SelectItem key={slices} value={String(slices)}>
                  {slices}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={String(ui.spread)}
          onValueChange={(e) => {
            setUI((ui) => ({ ...ui, spread: Number(e) }));
          }}
        >
          <SelectTrigger className="w-[82px]">
            <SelectValue placeholder="Layer Spread" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem disabled value="Layer Spread">
                Layer Spread
              </SelectItem>
              {SPREAD_OPTIONS.map((spread) => (
                <SelectItem key={spread} value={String(spread)}>
                  {spread * 100}%
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <SidebarLayer layers={photoDepthMap} />
      <Analytics />

      {/* 新增的上传部分 */}
      <div className="fixed bottom-4 left-4 bg-transparent">
        <h2 className="text-lg font-bold mb-2">Upload Images</h2>
        <div className="mb-2">
          <label htmlFor="originalImage" className="block mb-1">Original Image:</label>
          <input
            type="file"
            id="originalImage"
            accept="image/*"
            onChange={handleOriginalImageUpload}
            className="w-full"
          />
        </div>
        {/* https://huggingface.co/spaces/depth-anything/Depth-Anything-V2 */}
        <div className="mb-2">
          <label htmlFor="depthImage" className="block mb-1">Depth Image:</label>
          <input
            type="file"
            id="depthImage"
            accept="image/*"
            onChange={handleDepthImageUpload}
            className="w-full"
          />
          <span className="text-sm text-gray-600 italic">
  {"You can get GrayScale depth map from "}
  <a className="underline" href="https://depth-anything-v2.github.io/">Depth Anything V2</a>
</span>
        </div>
        <button
          onClick={handleUpload}
          style={{ backgroundColor: '#00d157' }}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Depth it！
        </button>
      </div>




    </>
  );
}

function SidebarLayer({ layers }: { layers: string[] }) {
  return (
    <div
      className="hidden lg:block fixed h-dvh"
      style={{
        overflowY: "auto",
        overflowX: "hidden",
        top: 0,
        right: 0,
      }}
    >
      <div className="flex flex-col gap-2 p-2 rounded-3xl m-2 bg-gray-200">
        {layers.map((layer, i) => (
          <img
            key={i}
            id={`image-${i}`}
            alt=""
            className="rounded-2xl block bg-gray-400"
            style={{
              backgroundImage: `url("/checkers.svg")`,
              backgroundRepeat: `repeat`,
              width: 80 * 2,
              height: 100 * 2,
            }}
            src={layer}
          />
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="fixed bottom-4 left-4 text-sm">
      Depth map rendered with CSSS masks proof of concept.
      <br />
      {"By "}
      <a className="underline" href="https://twitter.com/javierbyte">
        @javierbyte
      </a>
      {". Depth map by "}
      <a className="underline" href="https://depth-anything-v2.github.io/">
        Depth Anything
      </a>
      {". "}
      <a
        className="underline"
        href="https://github.com/javierbyte/depth-of-field"
      >
        Source
      </a>
      {"."}
    </div>
  );
}
