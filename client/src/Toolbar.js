import React, { useState, useEffect } from "react";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#e74c3c", "#3498db", "#2ecc71",
  "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
];

const SIZES = [2, 4, 8, 16, 32];

const TOOLS = [
  { id: "pen",    icon: "✏️", label: "Pen"    },
  { id: "eraser", icon: "🧹", label: "Eraser" },
  { id: "line",   icon: "╱",  label: "Line"   },
  { id: "rect",   icon: "▭",  label: "Rect"   },
  { id: "circle", icon: "◯",  label: "Circle" },
  { id: "text",   icon: "T",  label: "Text"   },
  { id: "sticky", icon: "📝", label: "Sticky" },
  { id: "select", icon: "↖",  label: "Select" },
  { id: "pan",    icon: "✋", label: "Pan"    },
];

const FILL_TOOLS = ["rect", "circle"];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function Toolbar(props) {
  const mobile = useIsMobile();
  return mobile ? <MobileToolbar {...props} /> : <DesktopToolbar {...props} />;
}

// ─── Desktop: left sidebar (unchanged layout) ─────────────────────────────────

function DesktopToolbar({
  tool, setTool, color, setColor, size, setSize,
  opacity, setOpacity, filled, setFilled,
  darkBg, setDarkBg, myColor,
  onClear, onUndo, onExport, onResetView, onPresent,
}) {
  const showColorAndSize = !["select", "pan", "sticky"].includes(tool);
  const showFill = FILL_TOOLS.includes(tool);

  return (
    <div style={ds.container}>
      <div style={ds.toolGrid}>
        {TOOLS.map((t) => (
          <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
            style={{ ...ds.toolBtn, background: tool === t.id ? "rgba(52,152,219,0.25)" : "transparent", border: tool === t.id ? "1px solid rgba(52,152,219,0.6)" : "1px solid transparent", color: tool === t.id ? "#3498db" : "#ccc" }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
          </button>
        ))}
      </div>

      {showColorAndSize && (
        <>
          <div style={ds.divider} />
          {showFill && (
            <button onClick={() => setFilled((v) => !v)}
              style={{ ...ds.fillBtn, background: filled ? "rgba(52,152,219,0.2)" : "rgba(255,255,255,0.04)", border: filled ? "1px solid rgba(52,152,219,0.5)" : "1px solid rgba(255,255,255,0.1)", color: filled ? "#3498db" : "#888" }}>
              {filled ? "⬛ Filled" : "⬜ Outline"}
            </button>
          )}
          <div style={ds.sliderRow}>
            <span style={ds.sliderLabel}>Opacity</span>
            <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={ds.slider} />
            <span style={ds.sliderVal}>{Math.round(opacity * 100)}%</span>
          </div>
          <div style={ds.divider} />
          <div style={ds.sizeRow}>
            {SIZES.map((s) => (
              <button key={s} onClick={() => setSize(s)}
                style={{ ...ds.sizeBtn, outline: size === s ? `2px solid ${myColor}` : "2px solid transparent" }}>
                <div style={{ width: Math.min(s, 20), height: Math.min(s, 20), borderRadius: "50%", background: color === "#ffffff" ? "#aaa" : color }} />
              </button>
            ))}
          </div>
          <div style={ds.divider} />
          <div style={ds.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                style={{ ...ds.colorSwatch, background: c, border: color === c ? `3px solid ${myColor}` : "2px solid #555", transform: color === c ? "scale(1.2)" : "scale(1)" }} />
            ))}
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }} style={ds.colorPicker} />
          </div>
        </>
      )}

      <div style={ds.divider} />
      <button onClick={() => setDarkBg((v) => !v)} style={{ ...ds.toggleBtn, color: darkBg ? "#f39c12" : "#888" }}>
        {darkBg ? "☀️ Light BG" : "🌙 Dark BG"}
      </button>
      <div style={ds.divider} />
      <div style={ds.actionCol}>
        <Abtn onClick={onUndo}>↩ Undo</Abtn>
        <Abtn onClick={onResetView}>⊡ Reset View</Abtn>
        <Abtn onClick={onExport}>⬇ Export</Abtn>
        <Abtn onClick={onPresent}>⛶ Present</Abtn>
        <Abtn onClick={onClear} danger>✕ Clear All</Abtn>
      </div>
      <div style={ds.myColor}>
        <span style={{ ...ds.myColorDot, background: myColor }} />
        <span style={ds.myColorText}>You</span>
      </div>
    </div>
  );
}

function Abtn({ onClick, children, danger }) {
  return <button onClick={onClick} style={{ ...ds.actionBtn, color: danger ? "#e74c3c" : "#aaa" }}>{children}</button>;
}

const ds = {
  container: { position: "fixed", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(18,18,30,0.93)", backdropFilter: "blur(14px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "12px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", zIndex: 100, minWidth: 86, maxHeight: "92vh", overflowY: "auto" },
  divider: { width: "100%", height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 },
  toolGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 3 },
  toolBtn: { width: 38, height: 38, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" },
  fillBtn: { width: "100%", borderRadius: 6, cursor: "pointer", fontSize: 10, padding: "4px 0", fontWeight: 600 },
  sliderRow: { display: "flex", alignItems: "center", gap: 4, width: "100%" },
  sliderLabel: { color: "#666", fontSize: 9, whiteSpace: "nowrap" },
  slider: { flex: 1, accentColor: "#3498db", cursor: "pointer" },
  sliderVal: { color: "#888", fontSize: 9, minWidth: 24, textAlign: "right" },
  sizeRow: { display: "flex", flexDirection: "column", gap: 3, alignItems: "center" },
  sizeBtn: { width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid transparent" },
  colorGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 },
  colorSwatch: { width: 24, height: 24, borderRadius: 5, cursor: "pointer", transition: "transform 0.1s" },
  colorPicker: { width: 24, height: 24, borderRadius: 5, border: "2px solid #555", padding: 0, cursor: "pointer", background: "transparent" },
  toggleBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: 10, padding: "2px 4px", whiteSpace: "nowrap" },
  actionCol: { display: "flex", flexDirection: "column", gap: 2, width: "100%" },
  actionBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: 11, padding: "4px 6px", borderRadius: 5, whiteSpace: "nowrap", textAlign: "left" },
  myColor: { display: "flex", alignItems: "center", gap: 4 },
  myColorDot: { width: 9, height: 9, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)" },
  myColorText: { color: "#555", fontSize: 10 },
};

// ─── Mobile: bottom bar + slide-up drawer ─────────────────────────────────────

function MobileToolbar({
  tool, setTool, color, setColor, size, setSize,
  opacity, setOpacity, filled, setFilled,
  darkBg, setDarkBg, myColor,
  onClear, onUndo, onExport, onResetView, onPresent,
}) {
  const [drawer, setDrawer] = useState(null); // null | "colors" | "size" | "actions"
  const showFill = FILL_TOOLS.includes(tool);
  const showColorAndSize = !["select", "pan", "sticky"].includes(tool);

  const closeDrawer = () => setDrawer(null);
  const toggleDrawer = (name) => setDrawer((d) => d === name ? null : name);

  return (
    <>
      {/* Slide-up drawer */}
      {drawer && (
        <>
          {/* Backdrop */}
          <div onClick={closeDrawer} style={ms.backdrop} />
          <div style={ms.drawer}>
            {drawer === "colors" && (
              <div style={ms.drawerContent}>
                <div style={ms.drawerTitle}>Color & Size</div>

                {/* Opacity */}
                <div style={ms.row}>
                  <span style={ms.label}>Opacity: {Math.round(opacity * 100)}%</span>
                  <input type="range" min={0.05} max={1} step={0.05} value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "#3498db" }} />
                </div>

                {/* Fill toggle */}
                {showFill && (
                  <button onClick={() => setFilled((v) => !v)}
                    style={{ ...ms.chip, background: filled ? "rgba(52,152,219,0.2)" : "rgba(255,255,255,0.06)", border: filled ? "1px solid #3498db" : "1px solid rgba(255,255,255,0.1)", color: filled ? "#3498db" : "#aaa" }}>
                    {filled ? "⬛ Filled" : "⬜ Outline"}
                  </button>
                )}

                {/* Sizes */}
                <div style={ms.sizeStrip}>
                  {SIZES.map((s) => (
                    <button key={s} onClick={() => setSize(s)}
                      style={{ ...ms.sizeBtn, outline: size === s ? `2px solid ${myColor}` : "2px solid transparent" }}>
                      <div style={{ width: Math.min(s, 22), height: Math.min(s, 22), borderRadius: "50%", background: color === "#ffffff" ? "#aaa" : color }} />
                    </button>
                  ))}
                </div>

                {/* Colors */}
                <div style={ms.colorStrip}>
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                      style={{ ...ms.colorDot, background: c, border: color === c ? `3px solid ${myColor}` : "2px solid #555", transform: color === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                  <input type="color" value={color}
                    onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
                    style={ms.colorPicker} />
                </div>
              </div>
            )}

            {drawer === "actions" && (
              <div style={ms.drawerContent}>
                <div style={ms.drawerTitle}>Actions</div>
                <div style={ms.actionGrid}>
                  <MobileActionBtn icon="↩" label="Undo" onClick={() => { onUndo(); closeDrawer(); }} />
                  <MobileActionBtn icon="⊡" label="Reset" onClick={() => { onResetView(); closeDrawer(); }} />
                  <MobileActionBtn icon="⬇" label="Export" onClick={() => { onExport(); closeDrawer(); }} />
                  <MobileActionBtn icon="⛶" label="Present" onClick={() => { onPresent(); closeDrawer(); }} />
                  <MobileActionBtn icon={darkBg ? "☀️" : "🌙"} label={darkBg ? "Light" : "Dark"} onClick={() => setDarkBg((v) => !v)} />
                  <MobileActionBtn icon="✕" label="Clear" onClick={() => { onClear(); closeDrawer(); }} danger />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={ms.bar}>
        {/* Tool scroll strip */}
        <div style={ms.toolStrip}>
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => { setTool(t.id); if (drawer === "colors" && !showColorAndSize) closeDrawer(); }}
              style={{ ...ms.toolBtn, background: tool === t.id ? "rgba(52,152,219,0.25)" : "transparent", border: tool === t.id ? "1px solid rgba(52,152,219,0.6)" : "1px solid transparent" }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 9, color: tool === t.id ? "#3498db" : "#666", marginTop: 2 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div style={ms.rightBtns}>
          {/* Active color dot — opens color drawer */}
          {showColorAndSize && (
            <button onClick={() => toggleDrawer("colors")}
              style={{ ...ms.colorIndicator, background: color, boxShadow: drawer === "colors" ? `0 0 0 2px ${myColor}` : "0 0 0 2px #444" }} />
          )}
          {/* Actions menu */}
          <button onClick={() => toggleDrawer("actions")}
            style={{ ...ms.iconBtn, background: drawer === "actions" ? "rgba(52,152,219,0.2)" : "rgba(255,255,255,0.07)" }}>
            ···
          </button>
        </div>
      </div>
    </>
  );
}

function MobileActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ ...ms.actionCell, color: danger ? "#e74c3c" : "#ccc" }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 10, marginTop: 3 }}>{label}</span>
    </button>
  );
}

const DRAWER_H = 260;
const BAR_H = 72;

const ms = {
  backdrop: { position: "fixed", inset: 0, zIndex: 110 },
  drawer: {
    position: "fixed", bottom: BAR_H, left: 0, right: 0,
    background: "rgba(18,18,30,0.97)", backdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px 16px 0 0",
    height: DRAWER_H, zIndex: 120,
    boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
    padding: "0 16px 16px",
    overflowY: "auto",
  },
  drawerContent: { display: "flex", flexDirection: "column", gap: 12 },
  drawerTitle: { color: "#666", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", paddingTop: 14, paddingBottom: 2 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  label: { color: "#888", fontSize: 12, whiteSpace: "nowrap" },
  chip: { borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, alignSelf: "flex-start" },
  sizeStrip: { display: "flex", gap: 10, alignItems: "center" },
  sizeBtn: { width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  colorStrip: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  colorDot: { width: 30, height: 30, borderRadius: "50%", cursor: "pointer", transition: "transform 0.1s", border: "2px solid #555" },
  colorPicker: { width: 30, height: 30, borderRadius: "50%", border: "2px solid #555", padding: 0, cursor: "pointer", background: "transparent" },
  actionGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  actionCell: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 0", cursor: "pointer" },

  bar: {
    position: "fixed", bottom: 0, left: 0, right: 0, height: BAR_H,
    background: "rgba(18,18,30,0.97)", backdropFilter: "blur(14px)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex", alignItems: "center",
    zIndex: 130, paddingBottom: "env(safe-area-inset-bottom)",
  },
  toolStrip: {
    display: "flex", overflowX: "auto", flex: 1,
    gap: 2, padding: "0 8px",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
  },
  toolBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minWidth: 54, height: 54, borderRadius: 12, cursor: "pointer",
    flexShrink: 0, border: "1px solid transparent", padding: "4px 2px",
  },
  rightBtns: { display: "flex", alignItems: "center", gap: 6, paddingRight: 10, flexShrink: 0 },
  colorIndicator: { width: 30, height: 30, borderRadius: "50%", border: "2px solid #444", cursor: "pointer", flexShrink: 0 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 18, color: "#aaa", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 2 },
};
