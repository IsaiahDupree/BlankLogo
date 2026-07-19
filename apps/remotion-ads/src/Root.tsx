import { Composition, Still } from "remotion";
import { BeforeAfterAd } from "./BeforeAfterAd";
import { StaticAd } from "./StaticAd";

// Frame pairs for ads
export const framePairs = [
  {
    id: "sora-test",
    name: "Sora Test",
    before: "/frames/sora-test-before.png",
    after: "/frames/sora-test-after.png",
  },
  {
    id: "yellow-brick",
    name: "Yellow Brick Road",
    before: "/frames/yellow-brick-before.png",
    after: "/frames/yellow-brick-after.png",
  },
  {
    id: "sora-watermarked",
    name: "Sora Watermarked",
    before: "/frames/sora-watermarked-before.png",
    after: null, // No after available
  },
  {
    id: "runway",
    name: "Runway",
    before: "/frames/runway-before.png",
    after: null,
  },
  {
    id: "pika",
    name: "Pika",
    before: "/frames/pika-before.png",
    after: null,
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Animated Before/After Ad (Video) */}
      <Composition
        id="BeforeAfterAd"
        component={BeforeAfterAd}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          variant: "sora-test",
        }}
      />

      {/* Static Ad (Image) - 1080x1920 for Stories/Reels */}
      <Still
        id="StaticAd"
        component={StaticAd}
        width={1080}
        height={1920}
        defaultProps={{
          variant: "sora-test",
        }}
      />

      {/* Static Ad Square - 1080x1080 for Feed */}
      <Still
        id="StaticAdSquare"
        component={StaticAd}
        width={1080}
        height={1080}
        defaultProps={{
          variant: "sora-test",
          square: true,
        }}
      />

      {/* Landscape Ad - 1920x1080 for YouTube */}
      <Still
        id="StaticAdLandscape"
        component={StaticAd}
        width={1920}
        height={1080}
        defaultProps={{
          variant: "sora-test",
          landscape: true,
        }}
      />
    </>
  );
};
