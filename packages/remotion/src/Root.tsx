import { Composition } from "remotion";
import { CanvasCastVideo, type Props } from "./compositions/CanvasCastVideo";
import type { TimelineV1 } from "@canvascast/shared";

const defaultTimeline: TimelineV1 = {
  version: 1,
  fps: 30,
  width: 1920,
  height: 1080,
  durationFrames: 780,
  theme: {
    primary: "#2F2B4A",
    secondary: "#4B6B4D",
    accent: "#3E356C",
    text: "#111827",
    fontFamily: "Inter",
  },
  tracks: [
    { type: "audio", src: "", volume: 1 },
  ],
  captions: {
    src: "",
    style: {
      enabled: true,
      position: "bottom",
      maxWidthPct: 0.86,
      fontSize: 44,
      lineHeight: 1.15,
      textColor: "#F7F7F7",
      strokeColor: "#111827",
      strokeWidth: 3,
      bgColor: "rgba(17,24,39,0.35)",
      bgPadding: 16,
      borderRadius: 18,
    },
  },
  segments: [
    {
      id: "seg_000",
      startFrame: 0,
      endFrame: 240,
      text: "Most people fail on YouTube because they can't ship consistently.",
      image: {
        src: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1920&h=1080&fit=crop",
        fit: "cover",
        zoom: 1.05,
      },
      overlays: [
        { text: "Ship consistently.", x: 0.08, y: 0.78, size: 56, weight: 800 },
      ],
      transition: { type: "cut", durationFrames: 0 },
    },
    {
      id: "seg_001",
      startFrame: 240,
      endFrame: 510,
      text: "CanvasCast turns your docs into a full 10-minute video with narration and visuals.",
      image: {
        src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1920&h=1080&fit=crop",
        fit: "cover",
        zoom: 1.03,
      },
      overlays: [],
      transition: { type: "fade", durationFrames: 12 },
    },
    {
      id: "seg_002",
      startFrame: 510,
      endFrame: 780,
      text: "You pick a niche, we generate the script, voice, captions, and timeline.",
      image: {
        src: "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1920&h=1080&fit=crop",
        fit: "cover",
        zoom: 1.02,
      },
      overlays: [],
      transition: { type: "cut", durationFrames: 0 },
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CanvasCastVideo"
        component={CanvasCastVideo as unknown as React.FC<Record<string, unknown>>}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={780}
        defaultProps={{
          timeline: defaultTimeline,
        }}
      />
    </>
  );
};
