import React from "react";
import { Img } from "remotion";

export const AdPhoto: React.FC<{
  photoUrl: string;
  fallbackGradient?: string;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
}> = ({ photoUrl, fallbackGradient, style = {}, imgStyle = {} }) => {
  return (
    <div
      style={{
        overflow: "hidden",
        background: fallbackGradient || "linear-gradient(135deg, #42291f, #6e3c27, #d26739)",
        ...style,
      }}
    >
      {photoUrl ? (
        <Img
          src={photoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            ...imgStyle,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
          }}
        >
          No photo
        </div>
      )}
    </div>
  );
};
