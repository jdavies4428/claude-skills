import React from "react";

export const AdSupport: React.FC<{
  text: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ text, color, style = {} }) => {
  return (
    <div
      style={{
        fontSize: 11,
        color,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
