import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import Toolbar from "./Toolbar";
import CursorLayer from "./CursorLayer";
import TextInput from "./TextInput";
import RoomBar from "./RoomBar";
import Chat from "./Chat";
import UserList from "./UserList";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

function getRoomId() {
  if (window.location.hash) return window.location.hash.slice(1);
  return null;
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

export function drawElement(ctx, el) {
  ctx.save();
  ctx.globalCompositeOperation =
    el.tool === "eraser" ? "destination-out" : "source-over";
  if (el.opacity !== undefined && el.opacity < 1 && el.tool !== "eraser") {
    ctx.globalAlpha = el.opacity;
  }
  const col = el.color || "#000";
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
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
    case "line":
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    case "rect":
      if (el.filled) ctx.fillRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
      else ctx.strokeRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
      break;
    case "circle": {
      const rx = Math.abs(el.x2 - el.x1) / 2, ry = Math.abs(el.y2 - el.y1) / 2;
      ctx.beginPath();
      ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, rx, ry, 0, 0, Math.PI * 2);
      if (el.filled) ctx.fill(); else ctx.stroke();
      break;
    }
    case "text":
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `${el.size * 4 + 8}px sans-serif`;
      ctx.fillStyle = col;
      ctx.fillText(el.text, el.x, el.y);
      break;
    case "sticky": {
      const W = 180, H = 120;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = el.bgColor || "#fef08a";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(el.x, el.y, W, H, 6);
      else ctx.rect(el.x, el.y, W, H);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(el.x + W - 16, el.y); ctx.lineTo(el.x + W, el.y + 16); ctx.lineTo(el.x + W - 16, el.y + 16);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#333"; ctx.font = "13px sans-serif";
      (el.text || "").split("\n").slice(0, 6).forEach((line, i) => ctx.fillText(line, el.x + 10, el.y + 22 + i * 16));
      break;
    }
    case "image":
      if (el._img) ctx.drawImage(el._img, el.x, el.y, el.w, el.h);
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
    case "sticky":
      return px >= el.x && px <= el.x + 180 && py >= el.y && py <= el.y + 120;
    case "image":
      return px >= el.x && px <= el.x + (el.w || 200) && py >= el.y && py <= el.y + (el.h || 200);
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
    case "text": case "sticky": case "image":
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
    <div style={ls.overlay}>
      <div style={ls.card}>
        <h1 style={ls.title}>Whiteboard</h1>
        <p style={ls.sub}>Real-time collaborative drawing</p>
        <form onSubmit={join} style={ls.form}>
          <input style={ls.input} placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
          <input style={ls.input} placeholder="Board ID (blank = new board)" value={board} onChange={(e) => setBoard(e.target.value.replace(/\s/g, ""))} maxLength={32} />
          <button style={ls.btn} type="submit">{board.trim() ? "Join Board" : "Create New Board"}</button>
        </form>
      </div>
    </div>
  );
}
const ls = {
  overlay: { position: "fixed", inset: 0, background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "40px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", minWidth: 320 },
  title: { color: "#fff", fontSize: 32, fontWeight: 700, margin: 0 },
  sub: { color: "#888", fontSize: 14, margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  input: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "12px 16px", outline: "none", width: "100%" },
  btn: { background: "#3498db", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600, padding: "12px 0", cursor: "pointer", marginTop: 4 },
};

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(() => {
    const hash = getRoomId();
    return hash ? { roomId: hash, userName: `User-${Math.random().toString(36).slice(2, 5).toUpperCase()}` } : null;
  });
  if (!session) {
    return <Lobby onJoin={(roomId, userName) => { window.location.hash = roomId; setSession({ roomId, userName }); }} />;
  }
  return <Board roomId={session.roomId} userName={session.userName} />;
}

// ─── Board ────────────────────────────────────────────────────────────────────

function Board({ roomId, userName }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const elementsRef = useRef([]);
  const livePreviewsRef = useRef({});
  const animFrameRef = useRef(null);
  const needsRedrawRef = useRef(false);
  const imagesRef = useRef({});

  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanning = useRef(false);
  const panStart = useRef(null);
  const pinchRef = useRef(null);

  const selectedIdRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(null);

  const lastPreviewEmit = useRef(0);
  const lastCursorEmit = useRef(0);
  const PREVIEW_INTERVAL = 50;
  const CURSOR_INTERVAL = 33;

  const [textInput, setTextInput] = useState(null);
  const [stickyInput, setStickyInput] = useState(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [filled, setFilled] = useState(false);
  const [darkBg, setDarkBg] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [cursors, setCursors] = useState({});
  const [myColor, setMyColor] = useState("#3498db");
  const [connected, setConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [boardName, setBoardName] = useState(roomId);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const opacityRef = useRef(opacity);
  const filledRef = useRef(filled);
  const darkBgRef = useRef(darkBg);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { filledRef.current = filled; }, [filled]);
  useEffect(() => { darkBgRef.current = darkBg; }, [darkBg]);

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

  // ─── Render ──────────────────────────────────────────────────────────────────

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dark = darkBgRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = dark ? "#1a1a2e" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = 40 * zoomRef.current;
    const ox = panRef.current.x % gridSize, oy = panRef.current.y % gridSize;
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.045)";
    ctx.lineWidth = 1;
    for (let x = ox; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = oy; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    elementsRef.current.forEach((el) => {
      if (el.tool === "image" && el.src && !el._img && imagesRef.current[el.id]) {
        el._img = imagesRef.current[el.id];
      }
      drawElement(ctx, el);
    });
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
        } else if (el.tool === "sticky") {
          b = { x: el.x - 4, y: el.y - 4, w: 188, h: 128 };
        } else if (el.tool === "image") {
          b = { x: el.x - 4, y: el.y - 4, w: (el.w || 200) + 8, h: (el.h || 200) + 8 };
        } else {
          b = { x: Math.min(el.x1, el.x2) - 8, y: Math.min(el.y1, el.y2) - 8, w: Math.abs(el.x2 - el.x1) + 16, h: Math.abs(el.y2 - el.y1) + 16 };
        }
        ctx.save();
        ctx.strokeStyle = "#3498db"; ctx.lineWidth = 1.5 / zoomRef.current;
        ctx.setLineDash([4 / zoomRef.current, 4 / zoomRef.current]);
        ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
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

  useEffect(() => { scheduleRedraw(); }, [darkBg, scheduleRedraw]);

  // ─── Canvas resize ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; scheduleRedraw(); };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [scheduleRedraw]);

  // ─── Socket.io ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => { setConnected(true); socket.emit("join-room", { roomId, userName }); });
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", ({ elements, userColor, cursors: ic, boardName: bn }) => {
      elementsRef.current = elements || [];
      setMyColor(userColor); setCursors(ic); setUserCount(Object.keys(ic).length);
      if (bn) setBoardName(bn);
      scheduleRedraw();
    });

    socket.on("element", (el) => { elementsRef.current.push(el); delete livePreviewsRef.current[el.id?.split("-")[0]]; scheduleRedraw(); });
    socket.on("element-update", (el) => {
      const i = elementsRef.current.findIndex((e) => e.id === el.id);
      if (i !== -1) elementsRef.current[i] = el; else elementsRef.current.push(el);
      scheduleRedraw();
    });
    socket.on("draw-preview", ({ socketId, el }) => { livePreviewsRef.current[socketId] = el; scheduleRedraw(); });
    socket.on("cursor-move", ({ socketId, x, y, color: c, name }) => {
      setCursors((prev) => ({ ...prev, [socketId]: { ...prev[socketId], x, y, color: c, name } }));
    });
    socket.on("user-joined", ({ socketId, cursor }) => { setCursors((prev) => ({ ...prev, [socketId]: cursor })); setUserCount((n) => n + 1); });
    socket.on("user-left", ({ socketId }) => {
      setCursors((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      delete livePreviewsRef.current[socketId];
      setUserCount((n) => Math.max(1, n - 1)); scheduleRedraw();
    });
    socket.on("clear", () => { elementsRef.current = []; livePreviewsRef.current = {}; selectedIdRef.current = null; scheduleRedraw(); });
    socket.on("undo-element", ({ elementId }) => {
      elementsRef.current = elementsRef.current.filter((e) => e.id !== elementId);
      if (selectedIdRef.current === elementId) selectedIdRef.current = null;
      scheduleRedraw();
    });
    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      setUnread((n) => n + 1);
    });
    socket.on("board-rename", ({ name }) => setBoardName(name));

    return () => socket.disconnect();
  }, [roomId, userName, scheduleRedraw]);

  // ─── Wheel zoom ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(10, Math.max(0.1, zoomRef.current * factor));
      panRef.current = { x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current), y: my - (my - panRef.current.y) * (newZoom / zoomRef.current) };
      zoomRef.current = newZoom; setZoom(newZoom); scheduleRedraw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [scheduleRedraw]);

  // ─── Image drop / paste ───────────────────────────────────────────────────────

  const addImageFromFile = useCallback((file, worldX, worldY) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const maxW = 400, scale = Math.min(1, maxW / img.width);
        const w = img.width * scale, h = img.height * scale;
        const el = { tool: "image", src, x: worldX, y: worldY, w, h, id: `${socketRef.current?.id}-${Date.now()}` };
        imagesRef.current[el.id] = img;
        el._img = img;
        elementsRef.current.push(el);
        const { _img, ...elToSend } = el;
        socketRef.current?.emit("element", { roomId, el: elToSend });
        scheduleRedraw();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [roomId, scheduleRedraw]);

  useEffect(() => {
    const onDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      addImageFromFile(file, world.x, world.y);
    };
    const onDragOver = (e) => e.preventDefault();
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      addImageFromFile(item.getAsFile(), ...Object.values(toWorld(window.innerWidth / 2, window.innerHeight / 2)));
    };
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("paste", onPaste);
    return () => { window.removeEventListener("drop", onDrop); window.removeEventListener("dragover", onDragOver); window.removeEventListener("paste", onPaste); };
  }, [addImageFromFile, toWorld]);

  // Load images received from remote
  useEffect(() => {
    elementsRef.current.forEach((el) => {
      if (el.tool === "image" && el.src && !imagesRef.current[el.id]) {
        const img = new Image();
        img.onload = () => { imagesRef.current[el.id] = img; scheduleRedraw(); };
        img.src = el.src;
      }
    });
  });

  // ─── Pointer handlers ─────────────────────────────────────────────────────────

  const startDraw = useCallback((e) => {
    e.preventDefault();
    if (e.touches && e.touches.length === 2) {
      isDrawing.current = false; currentStroke.current = null;
      const rect = canvasRef.current.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const ax = t0.clientX - rect.left, ay = t0.clientY - rect.top;
      const bx = t1.clientX - rect.left, by = t1.clientY - rect.top;
      pinchRef.current = { dist: Math.hypot(bx - ax, by - ay), midX: (ax + bx) / 2, midY: (ay + by) / 2, startZoom: zoomRef.current, startPan: { ...panRef.current } };
      return;
    }
    const screen = getScreenPos(e);
    const world = toWorld(screen.x, screen.y);
    const t = toolRef.current;

    if (e.button === 1 || t === "pan") { isPanning.current = true; panStart.current = { sx: screen.x, sy: screen.y, px: panRef.current.x, py: panRef.current.y }; return; }
    if (t === "text") { setTextInput({ x: world.x, y: world.y, sx: screen.x, sy: screen.y }); return; }
    if (t === "sticky") { setStickyInput({ x: world.x, y: world.y, sx: screen.x, sy: screen.y }); return; }
    if (t === "select") {
      const hit = [...elementsRef.current].reverse().find((el) => hitTest(el, world.x, world.y));
      selectedIdRef.current = hit ? hit.id : null;
      if (hit) { isDragging.current = true; dragStart.current = { wx: world.x, wy: world.y, elId: hit.id }; }
      scheduleRedraw(); return;
    }

    isDrawing.current = true;
    const id = `${socketRef.current?.id}-${Date.now()}`;
    if (t === "pen" || t === "eraser") {
      currentStroke.current = { tool: t, color: t === "eraser" ? (darkBgRef.current ? "#1a1a2e" : "#ffffff") : colorRef.current, size: t === "eraser" ? sizeRef.current * 4 : sizeRef.current, opacity: opacityRef.current, points: [world], id };
    } else {
      currentStroke.current = { tool: t, color: colorRef.current, size: sizeRef.current, opacity: opacityRef.current, filled: filledRef.current, x1: world.x, y1: world.y, x2: world.x, y2: world.y, id };
    }
  }, [toWorld, scheduleRedraw]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (e.touches && e.touches.length === 2 && pinchRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const ax = t0.clientX - rect.left, ay = t0.clientY - rect.top;
      const bx = t1.clientX - rect.left, by = t1.clientY - rect.top;
      const newDist = Math.hypot(bx - ax, by - ay);
      const midX = (ax + bx) / 2, midY = (ay + by) / 2;
      const p = pinchRef.current;
      const newZoom = Math.min(10, Math.max(0.1, p.startZoom * (newDist / p.dist)));
      panRef.current = { x: midX - (p.midX - p.startPan.x) * (newZoom / p.startZoom), y: midY - (p.midY - p.startPan.y) * (newZoom / p.startZoom) };
      zoomRef.current = newZoom; setZoom(newZoom); scheduleRedraw(); return;
    }
    const screen = getScreenPos(e);
    const world = toWorld(screen.x, screen.y);

    if (isPanning.current && panStart.current) {
      panRef.current = { x: panStart.current.px + screen.x - panStart.current.sx, y: panStart.current.py + screen.y - panStart.current.sy };
      scheduleRedraw();
    }

    if (isDragging.current && dragStart.current) {
      const dx = world.x - dragStart.current.wx, dy = world.y - dragStart.current.wy;
      const i = elementsRef.current.findIndex((e) => e.id === dragStart.current.elId);
      if (i !== -1) { elementsRef.current[i] = translateElement(elementsRef.current[i], dx, dy); dragStart.current = { ...dragStart.current, wx: world.x, wy: world.y }; scheduleRedraw(); }
      return;
    }

    if (!isDrawing.current || !currentStroke.current) return;
    const t = toolRef.current;
    const now = Date.now();

    if (t === "pen" || t === "eraser") {
      currentStroke.current.points.push(world);
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
      ctx.globalAlpha = t === "eraser" ? 1 : (currentStroke.current.opacity ?? 1);
      ctx.strokeStyle = currentStroke.current.color;
      ctx.lineWidth = currentStroke.current.size;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const pts = currentStroke.current.points;
      if (pts.length >= 2) {
        const p = pts[pts.length - 2], c = pts[pts.length - 1];
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.restore();
      if (now - lastPreviewEmit.current > PREVIEW_INTERVAL) { lastPreviewEmit.current = now; socketRef.current?.emit("draw-preview", { roomId, el: { ...currentStroke.current } }); }
    } else {
      currentStroke.current = { ...currentStroke.current, x2: world.x, y2: world.y };
      livePreviewsRef.current["__self__"] = currentStroke.current;
      scheduleRedraw();
      if (now - lastPreviewEmit.current > PREVIEW_INTERVAL) { lastPreviewEmit.current = now; socketRef.current?.emit("draw-preview", { roomId, el: { ...currentStroke.current } }); }
    }
    if (now - lastCursorEmit.current > CURSOR_INTERVAL) { lastCursorEmit.current = now; socketRef.current?.emit("cursor-move", { roomId, x: world.x, y: world.y }); }
  }, [toWorld, scheduleRedraw, roomId]);

  const stopDraw = useCallback((e) => {
    if (e.touches && e.touches.length < 2) pinchRef.current = null;
    isPanning.current = false; panStart.current = null;

    if (isDragging.current && dragStart.current) {
      isDragging.current = false;
      const el = elementsRef.current.find((e) => e.id === dragStart.current.elId);
      if (el) { const { _img, ...elToSend } = el; socketRef.current?.emit("element-update", { roomId, el: elToSend }); }
      dragStart.current = null; return;
    }

    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;
    const el = { ...currentStroke.current };
    delete livePreviewsRef.current["__self__"];
    const meaningful = (el.tool === "pen" || el.tool === "eraser") ? el.points?.length >= 2 : el.x1 !== el.x2 || el.y1 !== el.y2;
    if (meaningful) { elementsRef.current.push(el); socketRef.current?.emit("element", { roomId, el }); }
    currentStroke.current = null; scheduleRedraw();
  }, [roomId, scheduleRedraw]);

  // ─── Text / Sticky submit ─────────────────────────────────────────────────────

  const handleTextSubmit = useCallback((text) => {
    setTextInput(null);
    if (!text.trim()) return;
    const el = { tool: "text", text, x: textInput.x, y: textInput.y, color: colorRef.current, size: sizeRef.current, id: `${socketRef.current?.id}-${Date.now()}` };
    elementsRef.current.push(el);
    socketRef.current?.emit("element", { roomId, el });
    scheduleRedraw();
  }, [textInput, roomId, scheduleRedraw]);

  const STICKY_COLORS = ["#fef08a", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74"];

  const handleStickySubmit = useCallback((text, bgColor) => {
    setStickyInput(null);
    if (!text.trim()) return;
    const el = { tool: "sticky", text, x: stickyInput.x, y: stickyInput.y, bgColor, id: `${socketRef.current?.id}-${Date.now()}` };
    elementsRef.current.push(el);
    socketRef.current?.emit("element", { roomId, el });
    scheduleRedraw();
  }, [stickyInput, roomId, scheduleRedraw]);

  // ─── Actions ──────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    elementsRef.current = []; livePreviewsRef.current = {}; selectedIdRef.current = null;
    scheduleRedraw(); socketRef.current?.emit("clear", { roomId });
  }, [roomId, scheduleRedraw]);

  const handleUndo = useCallback(() => {
    const myId = socketRef.current?.id;
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      if (elementsRef.current[i].id?.startsWith(myId)) {
        const [removed] = elementsRef.current.splice(i, 1);
        if (selectedIdRef.current === removed.id) selectedIdRef.current = null;
        socketRef.current?.emit("undo", { roomId }); break;
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
    ctx.fillStyle = darkBg ? "#1a1a2e" : "#ffffff";
    ctx.fillRect(0, 0, src.width, src.height);
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);
    elementsRef.current.forEach((el) => drawElement(ctx, el));
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${boardName}.png`; a.click();
  }, [boardName, darkBg]);

  const handleResetView = useCallback(() => {
    panRef.current = { x: 0, y: 0 }; zoomRef.current = 1; setZoom(1); scheduleRedraw();
  }, [scheduleRedraw]);

  const handleSendMessage = useCallback((text) => {
    const msg = { text, sender: userName, color: myColor, ts: Date.now() };
    setMessages((prev) => [...prev, msg]);
    socketRef.current?.emit("chat-message", { roomId, msg });
  }, [roomId, userName, myColor]);

  const handleRename = useCallback((name) => {
    setBoardName(name);
    socketRef.current?.emit("board-rename", { roomId, name });
  }, [roomId]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (textInput || stickyInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (!e.ctrlKey && !e.metaKey) {
        const map = { p: "pen", e: "eraser", r: "rect", c: "circle", l: "line", t: "text", s: "select", h: "pan", n: "sticky" };
        if (map[e.key]) setTool(map[e.key]);
        if (e.key === "f") setFilled((v) => !v);
        if (e.key === "F") setPresentMode((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); handleResetView(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        const id = selectedIdRef.current;
        elementsRef.current = elementsRef.current.filter((el) => el.id !== id);
        socketRef.current?.emit("undo", { roomId });
        selectedIdRef.current = null; scheduleRedraw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleResetView, textInput, stickyInput, roomId, scheduleRedraw]);

  const getCursor = () => {
    if (tool === "pan") return isPanning.current ? "grabbing" : "grab";
    if (tool === "eraser") return "cell";
    if (tool === "select") return "default";
    if (tool === "text" || tool === "sticky") return "text";
    return "crosshair";
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", cursor: getCursor(), touchAction: "none" }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} onTouchCancel={stopDraw}
      />

      <CursorLayer cursors={cursors} mySocketId={socketRef.current?.id} />

      {!presentMode && (
        <RoomBar
          roomId={roomId} boardName={boardName} onRename={handleRename}
          connected={connected} userCount={userCount}
          cursors={cursors} myColor={myColor} mySocketId={socketRef.current?.id}
          onToggleUsers={() => setShowUsers((v) => !v)}
          onToggleChat={() => { setShowChat((v) => !v); setUnread(0); }}
          unread={unread}
        />
      )}

      {textInput && (
        <TextInput screenX={textInput.sx} screenY={textInput.sy} color={color} size={size}
          onSubmit={handleTextSubmit} onCancel={() => setTextInput(null)} />
      )}

      {stickyInput && (
        <StickyInputOverlay
          screenX={stickyInput.sx} screenY={stickyInput.sy}
          colors={STICKY_COLORS}
          onSubmit={handleStickySubmit}
          onCancel={() => setStickyInput(null)}
        />
      )}

      {!presentMode && (
        <Toolbar
          tool={tool} setTool={setTool}
          color={color} setColor={setColor}
          size={size} setSize={setSize}
          opacity={opacity} setOpacity={setOpacity}
          filled={filled} setFilled={setFilled}
          darkBg={darkBg} setDarkBg={setDarkBg}
          myColor={myColor}
          onClear={handleClear} onUndo={handleUndo}
          onExport={handleExport} onResetView={handleResetView}
          onPresent={() => setPresentMode(true)}
        />
      )}

      {presentMode && (
        <button onClick={() => setPresentMode(false)} style={exitPresentBtn}>Exit Presentation</button>
      )}

      {showUsers && !presentMode && (
        <UserList cursors={cursors} mySocketId={socketRef.current?.id} myColor={myColor} onClose={() => setShowUsers(false)} />
      )}

      {showChat && !presentMode && (
        <Chat messages={messages} onSend={handleSendMessage} myColor={myColor} userName={userName} onClose={() => { setShowChat(false); setUnread(0); }} />
      )}

      {!presentMode && <div style={zoomBadge}>{Math.round(zoom * 100)}%</div>}
    </div>
  );
}

// ─── Sticky note input overlay ────────────────────────────────────────────────

function StickyInputOverlay({ screenX, screenY, colors, onSubmit, onCancel }) {
  const [text, setText] = useState("");
  const [bg, setBg] = useState(colors[0]);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{ position: "fixed", left: screenX, top: Math.min(screenY, window.innerHeight - 200), zIndex: 300 }}>
      <div style={{ background: bg, borderRadius: 8, padding: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", width: 180 }}>
        <textarea
          ref={ref} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(text, bg); if (e.key === "Escape") onCancel(); }}
          style={{ width: "100%", minHeight: 80, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#333", fontFamily: "sans-serif" }}
          placeholder="Type note... (Ctrl+Enter)"
        />
        <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
          {colors.map((c) => (
            <button key={c} onClick={() => setBg(c)} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: bg === c ? "2px solid #333" : "2px solid transparent", cursor: "pointer", padding: 0 }} />
          ))}
          <button onClick={() => onSubmit(text, bg)} style={{ marginLeft: "auto", background: "#333", color: "#fff", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>Place</button>
        </div>
      </div>
    </div>
  );
}

const exitPresentBtn = {
  position: "fixed", top: 16, right: 16, zIndex: 200,
  background: "rgba(18,18,30,0.9)", color: "#aaa",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  padding: "8px 16px", cursor: "pointer", fontSize: 13,
};

const zoomBadge = {
  position: "fixed", bottom: 16, right: 16,
  background: "rgba(20,20,35,0.8)", color: "#aaa",
  fontSize: 12, padding: "4px 10px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  pointerEvents: "none", zIndex: 100,
};
