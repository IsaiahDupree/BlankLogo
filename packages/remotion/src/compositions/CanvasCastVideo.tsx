import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TimelineContractV1, type TimelineV1, type TimelineSegmentType, type TimelineThemeType } from "@canvascast/shared";

export interface Props {
  timeline: TimelineV1;
}

export const CanvasCastVideo: React.FC<Props> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Validate timeline
  const tl = useMemo(() => TimelineContractV1.parse(timeline), [timeline]);

  // Find active segment
  const active = tl.segments.find((s) => frame >= s.startFrame && frame < s.endFrame) ?? tl.segments[0];
  const localFrame = frame - active.startFrame;
  const segmentDuration = Math.max(1, active.endFrame - active.startFrame);

  // Calculate zoom effect
  const zoom = active.image?.zoom ?? 1;
  const scale = interpolate(localFrame, [0, segmentDuration], [1, zoom], {
    extrapolateRight: "clamp",
  });

  // Calculate fade transition
  const transitionFrames = active.transition?.durationFrames ?? 0;
  const opacity = active.transition?.type === "fade" && transitionFrames > 0
    ? interpolate(localFrame, [0, transitionFrames], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  // Get audio track
  const audioTrack = tl.tracks?.find((t) => t.type === "audio");

  return (
    <AbsoluteFill style={{ backgroundColor: tl.theme.text, width, height }}>
      {/* Audio track */}
      {audioTrack?.src && (
        <Audio src={audioTrack.src} volume={audioTrack.volume ?? 1} />
      )}

      {/* Background image */}
      {active.image?.src && (
        <AbsoluteFill style={{ opacity }}>
          <Img
            src={active.image.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: active.image.fit ?? "cover",
              transform: `scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Fallback gradient background */}
      {!active.image?.src && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${tl.theme.primary} 0%, ${tl.theme.secondary} 100%)`,
          }}
        />
      )}

      {/* Text overlays */}
      {active.overlays?.map((overlay, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: `${(overlay.x ?? 0.08) * 100}%`,
            top: `${(overlay.y ?? 0.78) * 100}%`,
            fontSize: overlay.size ?? 44,
            fontWeight: overlay.weight ?? 700,
            fontFamily: tl.theme.fontFamily,
            color: "#F7F7F7",
            textShadow: `0 2px 6px ${tl.theme.text}`,
          }}
        >
          {overlay.text}
        </div>
      ))}

      {/* Captions (simplified - SRT parsing would be done externally) */}
      {active.text && tl.captions?.style?.enabled !== false && (
        <CaptionDisplay text={active.text} style={tl.captions.style} theme={tl.theme} />
      )}
    </AbsoluteFill>
  );
};

interface CaptionDisplayProps {
  text: string;
  style: TimelineV1["captions"]["style"];
  theme: TimelineThemeType;
}

const CaptionDisplay: React.FC<CaptionDisplayProps> = ({ text, style, theme }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: style.position === "center" ? "center" : "flex-end",
        alignItems: "center",
        padding: style.position === "center" ? 0 : 60,
      }}
    >
      <div
        style={{
          fontSize: style.fontSize,
          fontWeight: 700,
          fontFamily: theme.fontFamily,
          color: style.textColor,
          textAlign: "center",
          lineHeight: style.lineHeight,
          maxWidth: `${style.maxWidthPct * 100}%`,
          padding: style.bgPadding,
          backgroundColor: style.bgColor,
          borderRadius: style.borderRadius,
          WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
          paintOrder: "stroke fill",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
