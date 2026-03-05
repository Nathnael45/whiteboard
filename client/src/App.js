import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import Toolbar from "./Toolbar";
import CursorLayer from "./CursorLayer";
import TextInput from "./TextInput";
import Minimap from "./Minimap";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

function getRoomId() {
  if (window.location.hash) return window.location.hash.slice(1);
  return null; // null = show lobby
}

// ─── Drawing helpers (module-level, no closure deps) ──────────────────────────

export function drawElement(ctx, el) {
  ctx.save();
  ctx.globalCompositeOperation =
    el.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = el.color || "#000";
  ctx.fillStyle = el.color || "#000";
  ctx.lineWidth = el.size || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.tool) {
    case "pen":
    case "eraser": {
      const pts = el.points;
      if (!pts || pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], c = pts[i];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
      }
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    }
    case "rect":
      ctx.strokeRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
      break;
    case "circle": {
      const rx = Math.abs(el.x2 - el.x1) / 2;
      const ry = Math.abs(el.y2 - el.y1) / 2;
      ctx.beginPath();
      ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "text":
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `${el.size * 4 + 8}px sans-serif`;
      ctx.fillStyle = el.color;
      ctx.fillText(el.text, el.x, el.y);
      break;
    default: break;
  }
  ctx.restore();
}

function hitTest(el, px, py) {
  const T = 8;
  switch (el.tool) {
    case "pen": case "eraser":
      return (el.points || []).some((p) => Math.hypot(p.x - px, p.y - py) < T + el.size);
    case "line":
      return distToSegment(px, py, el.x1, el.y1, el.x2, el.y2) < T;
    case "rect": case "circle":
      return px >= Math.min(el.x1, el.x2) - T && px <= Math.max(el.x1, el.x2) + T &&
             py >= Math.min(el.y1, el.y2) - T && py <= Math.max(el.y1, el.y2) + T;
    case "text":
      return Math.abs(px - el.x) < 100 && Math.abs(py - el.y) < (el.size * 4 + 12);
    default: return false;
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function translateElement(el, dx, dy) {
  switch (el.tool) {
    case "pen": case "eraser":
      return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "line": case "rect": case "circle":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "text":
      return { ...el, x: el.x + dx, y: el.y + dy };
    default: return el;
  }
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function Lobby({ onJoin }) {
  const [name, setName] = useState("");
  const [board, setBoard] = useState("");

  const join = (e) => {
    e.preventDefault();
    const roomId = board.trim() || Math.random().toString(36).slice(2, 8);
    const userName = name.trim() || `User-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    onJoin(roomId, userName);
  };

  return (
    <div style={lobbyStyles.overlay}>
      <div style={lobbyStyles.card}>
        <h1 style={lobbyStyles.title}>Whiteboard</h1>
        <p style={lobbyStyles.sub}>Real-time collaborative drawing</p>
        <form onSubmit={join} style={lobbyStyles.form}>
          <input
            style={lobbyStyles.input}
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />
          <input
            style={lobbyStyles.input}
            placeholder="Board ID (leave blank to create new)"
            value={board}
            onChange={(e) => setBoard(e.target.value.replace(/\s/g, ""))}
            maxLength={32}
          />
          <button style={lobbyStyles.btn} type="submit">
            {board.trim() ? "Join Board" : "Create New Board"}
          </button>
        </form>
      </div>
    </div>
  );
}

const lobbyStyles = {
  overlay: {
    position: "fixed", inset: 0,
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "40px 48px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    minWidth: 360,
  },
  title: { color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 },
  sub: { color: "#888", fontSize: 14, margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  input: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10, color: "#fff", fontSize: 15,
    padding: "12px 16px", outline: "none", width: "100%",
  },
  btn: {
    background: "#3498db", border: "none", borderRadius: 10,
    color: "#fff", fontSize: 15, fontWeight: 600,
    padding: "12px 0", cursor: "pointer", marginTop: 4,
  },
};

// ─── Main whiteboard ──────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(() => {
    const hash = getRoomId();
    return hash ? { roomId: hash, userName: `User-${Math.random().toString(36).slice(2, 5).toUpperCase()}` } : null;
  });

  if (!session) {
    return <Lobby onJoin={(roomId, userName) => {
      window.location.hash = roomId;
      setSession({ roomId, userName });
    }} />;
  }

  return <Board roomId={session.roomId} userName={session.userName} />;
}

function Board({ roomId, userName }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const elementsRef = useRef([]);
  const livePreviewsRef = useRef({});
  const animFrameRef = useRef(null);
  const needsRedrawRef = useRef(false);

  // Pan & zoom
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanning = useRef(false);
  const panStart = useRef(null);

  // Pinch-to-zoom state
  const pinchRef = useRef(null); // { dist, midX, midY, startZoom, startPan }

  // Selection
  const selectedIdRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(null);

  // Time-based throttle for stroke preview broadcasts
  const lastPreviewEmit = useRef(0);
  const lastCursorEmit = useRef(0);
  const PREVIEW_INTERVAL = 50; // ms — ~20fps for preview
  const CURSOR_INTERVAL = 33;  // ms — ~30fps for cursor

  const [textInput, setTextInput] = useState(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);
  const [cursors, setCursors] = useState({});
  const [myColor, setMyColor] = useState("#3498db");
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [zoom, setZoom] = useState(1);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // ─── Coordinate helpers ────────────────────────────────────────────────────

  const toWorld = useCallback((sx, sy) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - panRef.current.y) / zoomRef.current,
  }), []);

  const getScreenPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches.length > 0)
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ─── Render loop ───────────────────────────────────────────────────────────

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid in screen space
    const gridSize = 40 * zoomRef.current;
    const ox = panRef.current.x % gridSize, oy = panRef.current.y % gridSize;
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.045)";
    ctx.lineWidth = 1;
    for (let x = ox; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = oy; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.restore();

    // World-space drawing
    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);
    elementsRef.current.forEach((el) => drawElement(ctx, el));
    Object.values(livePreviewsRef.current).forEach((el) => el && drawElement(ctx, el));

    if (selectedIdRef.current) {
      const el = elementsRef.current.find((e) => e.id === selectedIdRef.current);
      if (el) {
        let b;
        if (el.tool === "pen" || el.tool === "eraser") {
          const xs = el.points.map((p) => p.x), ys = el.points.map((p) => p.y);
          b = { x: Math.min(...xs) - 8, y: Math.min(...ys) - 8, w: Math.max(...xs) - Math.min(...xs) + 16, h: Math.max(...ys) - Math.min(...ys) + 16 };
        } else if (el.tool === "text") {
          b = { x: el.x - 4, y: el.y - (el.size * 4 + 8), w: 120, h: el.size * 4 + 16 };
        } else {
          b = { x: Math.min(el.x1, el.x2) - 8, y: Math.min(el.y1, el.y2) - 8, w: Math.abs(el.x2 - el.x1) + 16, h: Math.abs(el.y2 - el.y1) + 16 };
        }
        ctx.save();
        ctx.strokeStyle = "#3498db";
        ctx.lineWidth = 1.5 / zoomRef.current;
        ctx.setLineDash([4 / zoomRef.current, 4 / zoomRef.current]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    ctx.restore();
  }, []);

  const scheduleRedraw = useCallback(() => { needsRedrawRef.current = true; }, []);

  useEffect(() => {
    const loop = () => {
      if (needsRedrawRef.current) { needsRedrawRef.current = false; redrawAll(); }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [redrawAll]);

  // ─── Canvas resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; scheduleRedraw(); };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [scheduleRedraw]);

  // ─── Socket.io ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", { roomId, userName });
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", ({ elements, userColor, cursors: ic }) => {
      elementsRef.current = elements || [];
      setMyColor(userColor);
      setCursors(ic);
      setUserCount(Object.keys(ic).length);
      scheduleRedraw();
    });

    socket.on("element", (el) => {
      elementsRef.current.push(el);
      delete livePreviewsRef.current[el.id?.split("-")[0]];
      scheduleRedraw();
    });

    socket.on("element-update", (el) => {
      const i = elementsRef.current.findIndex((e) => e.id === el.id);
      if (i !== -1) elementsRef.current[i] = el; else elementsRef.current.push(el);
      scheduleRedraw();
    });

    socket.on("draw-preview", ({ socketId, el }) => {
      livePreviewsRef.current[socketId] = el;
      scheduleRedraw();
    });

    socket.on("cursor-move", ({ socketId, x, y, color: c, name }) => {
      setCursors((prev) => ({ ...prev, [socketId]: { ...prev[socketId], x, y, color: c, name } }));
    });

    socket.on("user-joined", ({ socketId, cursor }) => {
      setCursors((prev) => ({ ...prev, [socketId]: cursor }));
      setUserCount((n) => n + 1);
    });

    socket.on("user-left", ({ socketId }) => {
      setCursors((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      delete livePreviewsRef.current[socketId];
      setUserCount((n) => Math.max(1, n - 1));
      scheduleRedraw();
    });

    socket.on("clear", () => {
      elementsRef.current = [];
      livePreviewsRef.current = {};
      selectedIdRef.current = null;
      scheduleRedraw();
    });

    socket.on("undo-element", ({ elementId }) => {
      elementsRef.current = elementsRef.current.filter((e) => e.id !== elementId);
      if (selectedIdRef.current === elementId) selectedIdRef.current = null;
      scheduleRedraw();
    });

    return () => socket.disconnect();
  }, [roomId, userName, scheduleRedraw]);

  // ─── Wheel zoom ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(10, Math.max(0.1, zoomRef.current * factor));
      panRef.current = {
        x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current),
        y: my - (my - panRef.current.y) * (newZoom / zoomRef.current),
      };
      zoomRef.current = newZoom;
      setZoom(newZoom);
      scheduleRedraw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw]);

  // ─── Pointer handlers ──────────────────────────────────────────────────────

  const startDraw = useCallback((e) => {
    e.preventDefault();

    // ── Pinch-to-zoom (2 touches) ──────────────────────────────────────────
    if (e.touches && e.touches.length === 2) {
      isDrawing.current = false;
      currentStroke.current = null;
      const t0 = e.touches[0], t1 = e.touches[1];
      const rect = canvasRef.current.getBoundingClientRect();
      const ax = t0.clientX - rect.left, ay = t0.clientY - rect.top;
      const bx = t1.clientX - rect.left, by = t1.clientY - rect.top;
      pinchRef.current = {
        dist: Math.hypot(bx - ax, by - ay),
        midX: (ax + bx) / 2,
        midY: (ay + by) / 2,
        startZoom: zoomRef.current,
        startPan: { ...panRef.current },
      };
      return;
    }

    const screen = getScreenPos(e);
    const world = toWorld(screen.x, screen.y);
    const t = toolRef.current;

    if (e.button === 1 || t === "pan") {
      isPanning.current = true;
      panStart.current = { sx: screen.x, sy: screen.y, px: panRef.current.x, py: panRef.current.y };
      return;
    }

    if (t === "text") {
      setTextInput({ x: world.x, y: world.y, sx: screen.x, sy: screen.y });
      return;
    }

    if (t === "select") {
      const hit = [...elementsRef.current].reverse().find((el) => hitTest(el, world.x, world.y));
      selectedIdRef.current = hit ? hit.id : null;
      if (hit) {
        isDragging.current = true;
        dragStart.current = { wx: world.x, wy: world.y, elId: hit.id };
      }
      scheduleRedraw();
      return;
    }

    isDrawing.current = true;
    const id = `${socketRef.current?.id}-${Date.now()}`;
    if (t === "pen" || t === "eraser") {
      currentStroke.current = { tool: t, color: t === "eraser" ? "#ffffff" : colorRef.current, size: t === "eraser" ? sizeRef.current * 4 : sizeRef.current, points: [world], id };
    } else {
      currentStroke.current = { tool: t, color: colorRef.current, size: sizeRef.current, x1: world.x, y1: world.y, x2: world.x, y2: world.y, id };
    }
  }, [toWorld, scheduleRedraw]);

  const draw = useCallback((e) => {
    e.preventDefault();

    // ── Pinch update ──────────────────────────────────────────────────────
    if (e.touches && e.touches.length === 2 && pinchRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const ax = t0.clientX - rect.left, ay = t0.clientY - rect.top;
      const bx = t1.clientX - rect.left, by = t1.clientY - rect.top;
      const newDist = Math.hypot(bx - ax, by - ay);
      const midX = (ax + bx) / 2, midY = (ay + by) / 2;
      const p = pinchRef.current;
      const newZoom = Math.min(10, Math.max(0.1, p.startZoom * (newDist / p.dist)));
      // Zoom toward pinch midpoint
      panRef.current = {
        x: midX - (p.midX - p.startPan.x) * (newZoom / p.startZoom),
        y: midY - (p.midY - p.startPan.y) * (newZoom / p.startZoom),
      };
      zoomRef.current = newZoom;
      setZoom(newZoom);
      scheduleRedraw();
      return;
    }

    const screen = getScreenPos(e);
    const world = toWorld(screen.x, screen.y);

    if (isPanning.current && panStart.current) {
      panRef.current = {
        x: panStart.current.px + screen.x - panStart.current.sx,
        y: panStart.current.py + screen.y - panStart.current.sy,
      };
      scheduleRedraw();
    }

    if (isDragging.current && dragStart.current) {
      const dx = world.x - dragStart.current.wx, dy = world.y - dragStart.current.wy;
      const i = elementsRef.current.findIndex((e) => e.id === dragStart.current.elId);
      if (i !== -1) {
        elementsRef.current[i] = translateElement(elementsRef.current[i], dx, dy);
        dragStart.current = { ...dragStart.current, wx: world.x, wy: world.y };
        scheduleRedraw();
      }
      return;
    }

    if (!isDrawing.current || !currentStroke.current) return;
    const t = toolRef.current;
    const now = Date.now();

    if (t === "pen" || t === "eraser") {
      currentStroke.current.points.push(world);

      // Optimistic incremental draw
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = currentStroke.current.color;
      ctx.lineWidth = currentStroke.current.size;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const pts = currentStroke.current.points;
      if (pts.length >= 2) {
        const p = pts[pts.length - 2], c = pts[pts.length - 1];
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.restore();

      // Time-based preview throttle
      if (now - lastPreviewEmit.current > PREVIEW_INTERVAL) {
        lastPreviewEmit.current = now;
        socketRef.current?.emit("draw-preview", { roomId, el: { ...currentStroke.current } });
      }
    } else {
      currentStroke.current = { ...currentStroke.current, x2: world.x, y2: world.y };
      livePreviewsRef.current["__self__"] = currentStroke.current;
      scheduleRedraw();
      if (now - lastPreviewEmit.current > PREVIEW_INTERVAL) {
        lastPreviewEmit.current = now;
        socketRef.current?.emit("draw-preview", { roomId, el: { ...currentStroke.current } });
      }
    }

    // Cursor broadcast
    if (now - lastCursorEmit.current > CURSOR_INTERVAL) {
      lastCursorEmit.current = now;
      socketRef.current?.emit("cursor-move", { roomId, x: world.x, y: world.y });
    }
  }, [toWorld, scheduleRedraw, roomId]);

  const stopDraw = useCallback((e) => {
    // Clear pinch on touch end
    if (e.touches && e.touches.length < 2) pinchRef.current = null;

    isPanning.current = false;
    panStart.current = null;

    if (isDragging.current && dragStart.current) {
      isDragging.current = false;
      const el = elementsRef.current.find((e) => e.id === dragStart.current.elId);
      if (el) socketRef.current?.emit("element-update", { roomId, el });
      dragStart.current = null;
      return;
    }

    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;

    const el = { ...currentStroke.current };
    delete livePreviewsRef.current["__self__"];

    const meaningful = (el.tool === "pen" || el.tool === "eraser")
      ? el.points?.length >= 2
      : el.x1 !== el.x2 || el.y1 !== el.y2;

    if (meaningful) {
      elementsRef.current.push(el);
      socketRef.current?.emit("element", { roomId, el });
    }
    currentStroke.current = null;
    scheduleRedraw();
  }, [roomId, scheduleRedraw]);

  // ─── Text ──────────────────────────────────────────────────────────────────

  const handleTextSubmit = useCallback((text) => {
    setTextInput(null);
    if (!text.trim()) return;
    const el = {
      tool: "text", text,
      x: textInput.x, y: textInput.y,
      color: colorRef.current, size: sizeRef.current,
      id: `${socketRef.current?.id}-${Date.now()}`,
    };
    elementsRef.current.push(el);
    socketRef.current?.emit("element", { roomId, el });
    scheduleRedraw();
  }, [textInput, roomId, scheduleRedraw]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    elementsRef.current = []; livePreviewsRef.current = {}; selectedIdRef.current = null;
    scheduleRedraw();
    socketRef.current?.emit("clear", { roomId });
  }, [roomId, scheduleRedraw]);

  const handleUndo = useCallback(() => {
    const myId = socketRef.current?.id;
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      if (elementsRef.current[i].id?.startsWith(myId)) {
        const [removed] = elementsRef.current.splice(i, 1);
        if (selectedIdRef.current === removed.id) selectedIdRef.current = null;
        socketRef.current?.emit("undo", { roomId });
        break;
      }
    }
    scheduleRedraw();
  }, [roomId, scheduleRedraw]);

  const handleExport = useCallback(() => {
    const src = canvasRef.current;
    const out = document.createElement("canvas");
    out.width = src.width * 2; out.height = src.height * 2;
    const ctx = out.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, src.width, src.height);
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);
    elementsRef.current.forEach((el) => drawElement(ctx, el));
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `whiteboard-${roomId}.png`;
    a.click();
  }, [roomId]);

  const handleResetView = useCallback(() => {
    panRef.current = { x: 0, y: 0 }; zoomRef.current = 1; setZoom(1); scheduleRedraw();
  }, [scheduleRedraw]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (textInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (!e.ctrlKey && !e.metaKey) {
        const map = { p: "pen", e: "eraser", r: "rect", c: "circle", l: "line", t: "text", s: "select", h: "pan" };
        if (map[e.key]) setTool(map[e.key]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); handleResetView(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        const id = selectedIdRef.current;
        elementsRef.current = elementsRef.current.filter((el) => el.id !== id);
        socketRef.current?.emit("undo", { roomId });
        selectedIdRef.current = null;
        scheduleRedraw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleResetView, textInput, roomId, scheduleRedraw]);

  const getCursor = () => {
    if (tool === "pan") return isPanning.current ? "grabbing" : "grab";
    if (tool === "eraser") return "cell";
    if (tool === "select") return "default";
    if (tool === "text") return "text";
    return "crosshair";
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", cursor: getCursor(), touchAction: "none" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        onTouchCancel={stopDraw}
      />

      <CursorLayer cursors={cursors} mySocketId={socketRef.current?.id} />

      {textInput && (
        <TextInput
          screenX={textInput.sx} screenY={textInput.sy}
          color={color} size={size}
          onSubmit={handleTextSubmit}
          onCancel={() => setTextInput(null)}
        />
      )}

      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        size={size} setSize={setSize}
        myColor={myColor}
        onClear={handleClear} onUndo={handleUndo}
        onExport={handleExport} onResetView={handleResetView}
        connected={connected} userCount={userCount}
        roomId={roomId} zoom={zoom}
      />

      <Minimap
        elementsRef={elementsRef}
        canvasRef={canvasRef}
        panRef={panRef}
        zoomRef={zoomRef}
        onNavigate={(newPan) => { panRef.current = newPan; scheduleRedraw(); }}
      />

      <div style={zoomBadge}>{Math.round(zoom * 100)}%</div>
    </div>
  );
}

const zoomBadge = {
  position: "fixed", bottom: 16, right: 16,
  background: "rgba(20,20,35,0.8)", color: "#aaa",
  fontSize: 12, padding: "4px 10px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  pointerEvents: "none", zIndex: 100,
};
