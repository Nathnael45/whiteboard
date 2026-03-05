import React, { useState, useEffect } from "react";

export default function RoomBar({ roomId, connected, userCount, cursors, myColor, mySocketId }) {
  const [copied, setCopied] = useState(false);
  const [wide, setWide] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const link = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Avatars: show up to 5 other users
  const otherCursors = Object.entries(cursors).filter(([id]) => id !== mySocketId);

  return (
    <div style={styles.bar}>
      {/* Left: board ID */}
      <div style={styles.left}>
        <span style={styles.boardLabel}>Board</span>
        <button style={styles.idBtn} onClick={copyId} title="Click to copy board ID">
          <span style={styles.idText}>{roomId}</span>
          <span style={styles.idCopy}>{copied ? "✓" : "⎘"}</span>
        </button>
      </div>

      {/* Center (wide only): user avatars */}
      {wide && (
        <div style={styles.center}>
          {/* My dot */}
          <div style={{ ...styles.avatar, background: myColor }} title="You">
            {mySocketId ? mySocketId.slice(-2).toUpperCase() : "Me"}
          </div>
          {otherCursors.slice(0, 4).map(([id, cursor]) => (
            <div
              key={id}
              style={{ ...styles.avatar, background: cursor.color || "#888" }}
              title={cursor.name || id}
            >
              {(cursor.name || id).slice(0, 2).toUpperCase()}
            </div>
          ))}
          {otherCursors.length > 4 && (
            <div style={{ ...styles.avatar, background: "#555" }}>
              +{otherCursors.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Right: status + share */}
      <div style={styles.right}>
        <div style={styles.status}>
          <span style={{ ...styles.dot, background: connected ? "#2ecc71" : "#e74c3c" }} />
          <span style={styles.statusText}>
            {connected ? `${userCount} online` : "Offline"}
          </span>
        </div>
        <button style={styles.shareBtn} onClick={copyLink}>
          {copied ? "✓ Copied!" : wide ? "Copy invite link" : "Share"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    position: "fixed",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(18,18,30,0.92)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    padding: "6px 14px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    zIndex: 200,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    maxWidth: "90vw",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  boardLabel: {
    color: "#555",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  idBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#ddd",
    fontSize: 13,
    fontFamily: "monospace",
    padding: "3px 8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  idText: { letterSpacing: "0.5px" },
  idCopy: { color: "#555", fontSize: 12 },
  center: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    border: "2px solid rgba(18,18,30,0.9)",
    marginLeft: -4,
    flexShrink: 0,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    display: "block",
    flexShrink: 0,
  },
  statusText: {
    color: "#888",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  shareBtn: {
    background: "rgba(52,152,219,0.18)",
    border: "1px solid rgba(52,152,219,0.4)",
    color: "#3498db",
    borderRadius: 7,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
