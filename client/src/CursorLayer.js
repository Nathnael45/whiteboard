import React from "react";

export default function CursorLayer({ cursors, mySocketId }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {Object.entries(cursors).map(([socketId, cursor]) => {
        if (socketId === mySocketId) return null;
        if (!cursor || cursor.x === undefined) return null;
        return (
          <div
            key={socketId}
            style={{
              position: "absolute",
              left: cursor.x,
              top: cursor.y,
              transform: "translate(-2px, -2px)",
              pointerEvents: "none",
              transition: "left 0.05s linear, top 0.05s linear",
            }}
          >
            {/* SVG cursor */}
            <svg width="20" height="20" viewBox="0 0 20 20" style={{ filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.5))" }}>
              <path
                d="M2 2 L2 14 L6 10 L10 18 L12 17 L8 9 L14 9 Z"
                fill={cursor.color || "#fff"}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              style={{
                position: "absolute",
                top: 18,
                left: 12,
                background: cursor.color || "#fff",
                color: isLight(cursor.color) ? "#000" : "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}
            >
              {cursor.name || "Anonymous"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Determine if a hex color is light (for text contrast)
function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
