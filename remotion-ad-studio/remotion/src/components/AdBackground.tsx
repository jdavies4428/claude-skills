import React from "react";
import { AbsoluteFill } from "remotion";

export const AdBackground: React.FC<{
  gradientFrom: string;
  gradientTo: string;
  angle?: string;
  overlay?: boolean;
}> = ({ gradientFrom, gradientTo, angle = "180deg", overlay = false }) => {
  return (
    <AbsoluteFill
      style={{
        background: overlay
          ? `linear-gradient(${angle}, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.5) 100%), linear-gradient(${angle}, ${gradientFrom} 0%, ${gradientTo} 100%)`
          : `linear-gradient(${angle}, ${gradientFrom} 0%, ${gradientTo} 100%)`,
      }}
    />
  );
};
