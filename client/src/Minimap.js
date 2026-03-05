import React, { useEffect, useRef, useCallback } from "react";
import { drawElement } from "./App";

const MAP_W = 180;
const MAP_H = 120;
const WORLD_SIZE = 4000; // virtual world extent we map into the minimap

export default function Minimap({ elementsRef, canvasRef, panRef, zoomRef, onNavigate }) {
  const mapRef = useRef(null);
  const animRef = useRef(null);
  const isDragging = useRef(false);

  const render = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const ctx = map.getContext("2d");
    const scale = MAP_W / WORLD_SIZE;

    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Draw all elements scaled down
    ctx.save();
    ctx.scale(scale, scale);
    elementsRef.current.forEach((el) => {
      drawElement(ctx, { ...el, size: Math.max(1, (el.size || 2) * 2) });
    });
    ctx.restore();

    // Viewport rectangle
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vx = (-panRef.current.x / zoomRef.current) * scale;
    const vy = (-panRef.current.y / zoomRef.current) * scale;
    const vw = (canvas.width / zoomRef.current) * scale;
    const vh = (canvas.height / zoomRef.current) * scale;

    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = "rgba(52,152,219,0.08)";
    ctx.fillRect(vx, vy, vw, vh);

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);
  }, [elementsRef, canvasRef, panRef, zoomRef]);

  // Render loop — 15fps is plenty for the minimap
  useEffect(() => {
    let last = 0;
    const loop = (ts) => {
      if (ts - last > 66) { last = ts; render(); }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  // Click/drag on minimap → pan main canvas
  const navigate = useCallback((e) => {
    const rect = mapRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / MAP_W;  // 0-1
    const my = (e.clientY - rect.top) / MAP_H;   // 0-1
    const canvas = canvasRef.current;
    if (!canvas) return;
    const worldX = mx * WORLD_SIZE;
    const worldY = my * WORLD_SIZE;
    onNavigate({
      x: canvas.width / 2 - worldX * zoomRef.current,
      y: canvas.height / 2 - worldY * zoomRef.current,
    });
  }, [canvasRef, zoomRef, onNavigate]);

  const onMouseDown = (e) => { isDragging.current = true; navigate(e); };
  const onMouseMove = (e) => { if (isDragging.current) navigate(e); };
  const onMouseUp = () => { isDragging.current = false; };

  return (
    <div style={container}>
      <div style={label}>Overview</div>
      <canvas
        ref={mapRef}
        width={MAP_W}
        height={MAP_H}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}

const container = {
  position: "fixed",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(20,20,35,0.88)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  zIndex: 90,
};

const label = {
  color: "#666",
  fontSize: 10,
  textAlign: "center",
  padding: "3px 0 1px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
};
