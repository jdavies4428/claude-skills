import React from "react";

export const AdBadge: React.FC<{
  text: string;
  bgColor: string;
  textColor: string;
  style?: React.CSSProperties;
  fontSize?: number;
}> = ({ text, bgColor, textColor, style = {}, fontSize = 10 }) => {
  return (
    <div
      style={{
        display: "inline-block",
        background: bgColor,
        color: textColor,
        padding: "4px 12px",
        borderRadius: 4,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {text}
    </div>
  );
};
