"use client";

import type { RefObject } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Sklejka, durationInFrames, type SklejkaProps } from "@/remotion/Sklejka";
import { FORMAT_SIZE, FPS } from "@/lib/clips/plan";

// Live preview of the plan — same composition the renderer uses.
export default function Preview({ props, playerRef }: { props: SklejkaProps; playerRef?: RefObject<PlayerRef | null> }) {
  const size = FORMAT_SIZE[props.format];
  return (
    <Player
      ref={playerRef}
      component={Sklejka}
      inputProps={props}
      durationInFrames={durationInFrames(props.plan)}
      fps={FPS}
      compositionWidth={size.width}
      compositionHeight={size.height}
      controls
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: `${size.width} / ${size.height}`, borderRadius: 18, overflow: "hidden", backgroundColor: "#000" }}
    />
  );
}
