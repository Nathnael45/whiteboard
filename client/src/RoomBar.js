import React, { useState, useEffect, useRef } from "react";

export default function RoomBar({
  roomId, boardName, onRename,
  connected, userCount, cursors, myColor, mySocketId,
  onToggleUsers, onToggleChat, unread,
}) {
  const [copied, setCopied] = useState(false);
  const [wide, setWide] = useState(window.innerWidth >= 768);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(boardName);
  const inputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { setNameInput(boardName); }, [boardName]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const commitRename = () => {
    setEditing(false);
    const name = nameInput.trim() || roomId;
    setNameInput(name);
    onRename(name);
  };

  const otherCursors = Object.entries(cursors).filter(([id]) => id !== mySocketId);

  return (
    <div style={styles.bar}>
      {/* Board name (editable) */}
      <div style={styles.left}>
        <span style={styles.boardLabel}>Board</span>
        {editing ? (
          <input
            ref={inputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditing(false); setNameInput(boardName); } }}
            style={styles.nameInput}
            maxLength={40}
          />
        ) : (
          <button style={styles.nameBtn} onClick={() => setEditing(true)} title="Click to rename board">
            <span style={styles.nameText}>{boardName || roomId}</span>
            <span style={styles.editIcon}>✎</span>
          </button>
        )}
      </div>

      {/* Center: avatars (wide screens) */}
      {wide && (
        <div style={styles.center}>
          <div style={{ ...styles.avatar, background: myColor }} title="You">
            {mySocketId ? mySocketId.slice(-2).toUpperCase() : "Me"}
          </div>
          {otherCursors.slice(0, 4).map(([id, cursor]) => (
            <div key={id} style={{ ...styles.avatar, background: cursor.color || "#888" }} title={cursor.name || id}>
              {(cursor.name || id).slice(0, 2).toUpperCase()}
            </div>
          ))}
          {otherCursors.length > 4 && (
            <div style={{ ...styles.avatar, background: "#555" }}>+{otherCursors.length - 4}</div>
          )}
        </div>
      )}

      {/* Right: status + actions */}
      <div style={styles.right}>
        <div style={styles.status}>
          <span style={{ ...styles.dot, background: connected ? "#2ecc71" : "#e74c3c" }} />
          {wide && <span style={styles.statusText}>{connected ? `${userCount} online` : "Offline"}</span>}
        </div>

        {/* People button */}
        <button style={styles.iconBtn} onClick={onToggleUsers} title="People">
          👥
        </button>

        {/* Chat button with unread badge */}
        <button style={styles.iconBtn} onClick={onToggleChat} title="Chat">
          💬
          {unread > 0 && <span style={styles.badge}>{unread > 9 ? "9+" : unread}</span>}
        </button>

        <button style={styles.shareBtn} onClick={copyLink}>
          {copied ? "✓ Copied!" : wide ? "Copy Link" : "Share"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
    background: "rgba(18,18,30,0.92)", backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
    padding: "6px 14px", display: "flex", alignItems: "center", gap: 14,
    zIndex: 200, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: "90vw",
  },
  left: { display: "flex", alignItems: "center", gap: 6 },
  boardLabel: { color: "#555", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 },
  nameBtn: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 6, color: "#ddd", fontSize: 13, padding: "3px 8px",
    cursor: "pointer", display: "flex", alignItems: "center", gap: 5, maxWidth: 160,
  },
  nameText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 },
  editIcon: { color: "#444", fontSize: 11, flexShrink: 0 },
  nameInput: {
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(52,152,219,0.5)",
    borderRadius: 6, color: "#fff", fontSize: 13, padding: "3px 8px",
    outline: "none", width: 150,
  },
  center: { display: "flex", alignItems: "center", gap: 2 },
  avatar: {
    width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, fontWeight: 700, color: "#fff",
    border: "2px solid rgba(18,18,30,0.9)", marginLeft: -4, flexShrink: 0,
  },
  right: { display: "flex", alignItems: "center", gap: 8 },
  status: { display: "flex", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: "50%", display: "block", flexShrink: 0 },
  statusText: { color: "#888", fontSize: 11, whiteSpace: "nowrap" },
  iconBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 16, position: "relative", padding: "0 2px", lineHeight: 1,
  },
  badge: {
    position: "absolute", top: -4, right: -4,
    background: "#e74c3c", color: "#fff",
    fontSize: 8, fontWeight: 700,
    borderRadius: 8, padding: "1px 4px", lineHeight: 1.4,
  },
  shareBtn: {
    background: "rgba(52,152,219,0.18)", border: "1px solid rgba(52,152,219,0.4)",
    color: "#3498db", borderRadius: 7, padding: "4px 12px",
    fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  },
};
