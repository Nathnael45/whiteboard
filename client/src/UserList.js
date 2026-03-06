import React, { useState, useEffect } from "react";

const BAR_H = 72;

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

export default function UserList({ cursors, mySocketId, myColor, onClose }) {
  const mobile = useIsMobile();
  const users = Object.entries(cursors);

  const panelStyle = mobile ? {
    ...styles.panel,
    right: 0, left: 0, bottom: BAR_H, top: "auto",
    transform: "none",
    width: "100%", maxWidth: "100%",
    borderRadius: "14px 14px 0 0",
  } : styles.panel;

  return (
    <div style={panelStyle}>
      <div style={styles.header}>
        <span style={styles.title}>People ({users.length})</span>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>
      <div style={styles.list}>
        {/* Me first */}
        <div style={styles.row}>
          <div style={{ ...styles.avatar, background: myColor }}>
            {mySocketId ? mySocketId.slice(-2).toUpperCase() : "ME"}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>You</span>
            <span style={styles.sub}>This device</span>
          </div>
          <span style={{ ...styles.dot, background: "#2ecc71" }} />
        </div>
        {users.filter(([id]) => id !== mySocketId).map(([id, cursor]) => (
          <div key={id} style={styles.row}>
            <div style={{ ...styles.avatar, background: cursor.color || "#888" }}>
              {(cursor.name || id).slice(0, 2).toUpperCase()}
            </div>
            <div style={styles.info}>
              <span style={styles.name}>{cursor.name || "Anonymous"}</span>
              <span style={styles.sub}>Online</span>
            </div>
            <span style={{ ...styles.dot, background: "#2ecc71" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
    width: 220,
    background: "rgba(18,18,30,0.95)", backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14,
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    zIndex: 150, overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  title: { color: "#ddd", fontSize: 13, fontWeight: 600 },
  closeBtn: { background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14 },
  list: { padding: "8px 0", maxHeight: "60vh", overflowY: "auto" },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" },
  avatar: {
    width: 30, height: 30, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
  },
  info: { flex: 1, display: "flex", flexDirection: "column" },
  name: { color: "#ddd", fontSize: 12, fontWeight: 500 },
  sub: { color: "#555", fontSize: 10 },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
};
