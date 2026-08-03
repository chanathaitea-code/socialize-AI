import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type React from "react";
import { ImageResponse } from "next/og";
import type { Ligne, Theme } from "./story";
import { STORY_H, STORY_L, storyImageElement } from "./story-image";

async function police(nom: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(process.cwd(), "public", "fonts", nom));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Rend n'importe quel visuel en 1080x1920, avec les polices de la marque. */
export async function rendreElement(element: React.ReactElement): Promise<ImageResponse> {
  const [regular, extrabold] = await Promise.all([
    police("inter-regular.ttf"),
    police("inter-extrabold.ttf"),
  ]);
  return new ImageResponse(element, {
    width: STORY_L,
    height: STORY_H,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: extrabold, weight: 800, style: "normal" },
    ],
  });
}

/** Rend la story en image 1080x1920, utilisée par le téléchargement et la publication. */
export async function rendreStory(opts: {
  theme: Theme;
  lignes: Ligne[];
  periode: string;
  photoUrl: string | null;
  fond: string | null;
}): Promise<ImageResponse> {
  const [regular, extrabold] = await Promise.all([
    police("inter-regular.ttf"),
    police("inter-extrabold.ttf"),
  ]);
  return new ImageResponse(storyImageElement(opts), {
    width: STORY_L,
    height: STORY_H,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: extrabold, weight: 800, style: "normal" },
    ],
  });
}
