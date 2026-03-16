import React from "react";

export const AdCta: React.FC<{
  text: string;
  bgColor: string;
  textColor: string;
  borderRadius?: number;
  style?: React.CSSProperties;
}> = ({ text, bgColor, textColor, borderRadius = 8, style = {} }) => {
  return (
    <div
      style={{
        background: bgColor,
        color: textColor,
        padding: "12px 28px",
        borderRadius,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.03em",
        textAlign: "center" as const,
        whiteSpace: "nowrap" as const,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {text}
    </div>
  );
};
