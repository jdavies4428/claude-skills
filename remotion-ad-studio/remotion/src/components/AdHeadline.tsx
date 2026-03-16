import React from "react";
import { splitHighlight } from "../helpers";

export const AdHeadline: React.FC<{
  text: string;
  highlight: string;
  color: string;
  highlightBg: string;
  highlightTextColor?: string;
  style?: React.CSSProperties;
}> = ({ text, highlight, color, highlightBg, highlightTextColor = "#efe7db", style = {} }) => {
  const parts = splitHighlight(text, highlight);
  return (
    <div
      style={{
        fontSize: 16,
        fontWeight: 800,
        color,
        lineHeight: 1.3,
        ...style,
      }}
    >
      {parts.map((part, i) =>
        part.isHighlight ? (
          <span
            key={i}
            style={{
              background: highlightBg,
              color: highlightTextColor,
              borderRadius: 4,
              padding: "0 4px",
            }}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </div>
  );
};
