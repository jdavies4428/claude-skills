import React from "react";
import { Img } from "remotion";

export const AdLogo: React.FC<{
  logoUrl: string;
  brandName: string;
  style?: React.CSSProperties;
  maxHeight?: number;
  color?: string;
}> = ({ logoUrl, brandName, style = {}, maxHeight = 36, color = "#efe7db" }) => {
  if (logoUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
        <Img src={logoUrl} style={{ maxHeight, objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        fontWeight: 800,
        letterSpacing: "0.12em",
        color,
        textTransform: "uppercase" as const,
        fontSize: 13,
        ...style,
      }}
    >
      {brandName}
    </div>
  );
};
