import React, { useEffect, useRef } from "react";

export default function TextInput({ screenX, screenY, color, size, onSubmit, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(ref.current.value);
    }
    if (e.key === "Escape") onCancel();
  };

  const fontSize = size * 4 + 8;

  return (
    <textarea
      ref={ref}
      onKeyDown={onKeyDown}
      onBlur={() => onSubmit(ref.current.value)}
      style={{
        position: "fixed",
        left: screenX,
        top: screenY - fontSize,
        background: "transparent",
        border: "none",
        outline: "1px dashed rgba(52,152,219,0.6)",
        color,
        fontSize,
        fontFamily: "sans-serif",
        resize: "none",
        minWidth: 120,
        minHeight: fontSize + 4,
        zIndex: 200,
        padding: 2,
        lineHeight: 1.2,
        caretColor: color,
      }}
      rows={1}
      placeholder="Type here, Enter to place"
    />
  );
}
