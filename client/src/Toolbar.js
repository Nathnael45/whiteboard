import React from "react";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#e74c3c", "#3498db", "#2ecc71",
  "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
];

const SIZES = [2, 4, 8, 16, 32];

const TOOLS = [
  { id: "pen",    icon: "✏️", label: "Pen",     key: "P" },
  { id: "eraser", icon: "🧹", label: "Eraser",  key: "E" },
  { id: "line",   icon: "╱",  label: "Line",    key: "L" },
  { id: "rect",   icon: "▭",  label: "Rect",    key: "R" },
  { id: "circle", icon: "◯",  label: "Circle",  key: "C" },
  { id: "text",   icon: "T",  label: "Text",    key: "T" },
  { id: "select", icon: "↖",  label: "Select",  key: "S" },
  { id: "pan",    icon: "✋", label: "Pan",     key: "H" },
];

export default function Toolbar({
  tool, setTool, color, setColor, size, setSize,
  myColor, onClear, onUndo, onExport, onResetView,
}) {
  const showColorAndSize = !["select", "pan"].includes(tool);

  return (
    <div style={styles.container}>

      {/* Tools grid */}
      <div style={styles.toolGrid}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.id)}
            style={{
              ...styles.toolBtn,
              background: tool === t.id ? "rgba(52,152,219,0.25)" : "transparent",
              border: tool === t.id ? "1px solid rgba(52,152,219,0.6)" : "1px solid transparent",
              color: tool === t.id ? "#3498db" : "#ccc",
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ fontSize: 8, opacity: 0.5, marginTop: 1 }}>{t.key}</span>
          </button>
        ))}
      </div>

      {showColorAndSize && (
        <>
          <div style={styles.divider} />

          {/* Brush size */}
          <div style={styles.sizeRow}>
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                title={`Size ${s}`}
                style={{
                  ...styles.sizeBtn,
                  outline: size === s ? `2px solid ${myColor}` : "2px solid transparent",
                }}
              >
                <div style={{
                  width: Math.min(s, 20),
                  height: Math.min(s, 20),
                  borderRadius: "50%",
                  background: color === "#ffffff" ? "#aaa" : color,
                }} />
              </button>
            ))}
          </div>

          <div style={styles.divider} />

          {/* Color palette */}
          <div style={styles.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                style={{
                  ...styles.colorSwatch,
                  background: c,
                  border: color === c ? `3px solid ${myColor}` : "2px solid #555",
                  transform: color === c ? "scale(1.2)" : "scale(1)",
                }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
              style={styles.colorPicker}
              title="Custom color"
            />
          </div>
        </>
      )}

      <div style={styles.divider} />

      {/* Actions */}
      <div style={styles.actionCol}>
        <ActionBtn onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</ActionBtn>
        <ActionBtn onClick={onResetView} title="Reset view (Ctrl+0)">⊡ Reset View</ActionBtn>
        <ActionBtn onClick={onExport} title="Export PNG">⬇ Export</ActionBtn>
        <ActionBtn onClick={onClear} title="Clear board" danger>✕ Clear All</ActionBtn>
      </div>

      {/* My color dot */}
      <div style={styles.myColor}>
        <span style={{ ...styles.myColorDot, background: myColor }} />
        <span style={styles.myColorText}>You</span>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, children, title, danger }) {
  return (
    <button onClick={onClick} title={title} style={{ ...styles.actionBtn, color: danger ? "#e74c3c" : "#aaa" }}>
      {children}
    </button>
  );
}

const styles = {
  container: {
    position: "fixed",
    left: 16,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(18, 18, 30, 0.93)",
    backdropFilter: "blur(14px)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    zIndex: 100,
    minWidth: 86,
    maxHeight: "95vh",
    overflowY: "auto",
  },
  divider: { width: "100%", height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 },
  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 3,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.1s",
  },
  sizeRow: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "center",
  },
  sizeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid transparent",
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 4,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 5,
    cursor: "pointer",
    transition: "transform 0.1s",
  },
  colorPicker: {
    width: 24,
    height: 24,
    borderRadius: 5,
    border: "2px solid #555",
    padding: 0,
    cursor: "pointer",
    background: "transparent",
  },
  actionCol: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: "100%",
  },
  actionBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 6px",
    borderRadius: 5,
    whiteSpace: "nowrap",
    textAlign: "left",
  },
  myColor: { display: "flex", alignItems: "center", gap: 4 },
  myColorDot: { width: 9, height: 9, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)" },
  myColorText: { color: "#555", fontSize: 10 },
};
