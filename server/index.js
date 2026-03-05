const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Persistence layer ────────────────────────────────────────────────────────
// Uses Redis when REDIS_URL is set, otherwise falls back to in-memory.

let store;

if (process.env.REDIS_URL) {
  const { createClient } = require("redis");
  const client = createClient({ url: process.env.REDIS_URL });
  client.connect().catch(console.error);
  client.on("error", (err) => console.error("Redis error:", err));

  store = {
    async getElements(roomId) {
      const raw = await client.get(`room:${roomId}:elements`);
      return raw ? JSON.parse(raw) : [];
    },
    async setElements(roomId, elements) {
      // Keep last 5000 elements per room; expire after 7 days
      const trimmed = elements.slice(-5000);
      await client.set(`room:${roomId}:elements`, JSON.stringify(trimmed), { EX: 60 * 60 * 24 * 7 });
    },
    async appendElement(roomId, el) {
      const elements = await this.getElements(roomId);
      elements.push(el);
      await this.setElements(roomId, elements);
    },
    async updateElement(roomId, el) {
      const elements = await this.getElements(roomId);
      const idx = elements.findIndex((e) => e.id === el.id);
      if (idx !== -1) elements[idx] = el;
      else elements.push(el);
      await this.setElements(roomId, elements);
    },
    async removeElement(roomId, elementId) {
      const elements = await this.getElements(roomId);
      const filtered = elements.filter((e) => e.id !== elementId);
      await this.setElements(roomId, filtered);
      return elements.find((e) => e.id === elementId);
    },
    async clearRoom(roomId) {
      await client.del(`room:${roomId}:elements`);
    },
  };
  console.log("Using Redis for persistence");
} else {
  // In-memory fallback
  const memStore = {}; // roomId -> elements[]
  store = {
    async getElements(roomId) { return memStore[roomId] || []; },
    async setElements(roomId, elements) { memStore[roomId] = elements; },
    async appendElement(roomId, el) {
      if (!memStore[roomId]) memStore[roomId] = [];
      memStore[roomId].push(el);
    },
    async updateElement(roomId, el) {
      if (!memStore[roomId]) memStore[roomId] = [];
      const idx = memStore[roomId].findIndex((e) => e.id === el.id);
      if (idx !== -1) memStore[roomId][idx] = el;
      else memStore[roomId].push(el);
    },
    async removeElement(roomId, elementId) {
      if (!memStore[roomId]) return null;
      const idx = memStore[roomId].findIndex((e) => e.id === elementId);
      if (idx === -1) return null;
      return memStore[roomId].splice(idx, 1)[0];
    },
    async clearRoom(roomId) { memStore[roomId] = []; },
  };
  console.log("Using in-memory store (set REDIS_URL for persistence)");
}

// ─── Per-connection cursor state (always in-memory, ephemeral) ────────────────
const cursors = {}; // roomId -> { socketId: {x,y,color,name} }

function getRoomCursors(roomId) {
  if (!cursors[roomId]) cursors[roomId] = {};
  return cursors[roomId];
}

const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a",
];
let colorIdx = 0;
const nextColor = () => COLORS[colorIdx++ % COLORS.length];

// ─── Socket handlers ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  let currentRoom = null;
  const userColor = nextColor();

  socket.on("join-room", async ({ roomId, userName }) => {
    if (currentRoom && currentRoom !== roomId) socket.leave(currentRoom);
    currentRoom = roomId;
    socket.join(roomId);

    const roomCursors = getRoomCursors(roomId);
    roomCursors[socket.id] = { x: 0, y: 0, color: userColor, name: userName || "Anonymous" };

    const elements = await store.getElements(roomId);

    socket.emit("init", { elements, userColor, cursors: roomCursors });

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      cursor: roomCursors[socket.id],
    });
  });

  // Committed element (pen stroke, shape, text)
  socket.on("element", async ({ roomId, el }) => {
    // Trust client-assigned id; color is set by client (it knows its own color)
    await store.appendElement(roomId, el);
    socket.to(roomId).emit("element", el);
  });

  // Element moved via select tool
  socket.on("element-update", async ({ roomId, el }) => {
    await store.updateElement(roomId, el);
    socket.to(roomId).emit("element-update", el);
  });

  // Live preview while drawing (not persisted)
  socket.on("draw-preview", ({ roomId, el }) => {
    socket.to(roomId).emit("draw-preview", { socketId: socket.id, el });
  });

  // Cursor move
  socket.on("cursor-move", ({ roomId, x, y }) => {
    if (!currentRoom) return;
    const roomCursors = getRoomCursors(roomId);
    if (roomCursors[socket.id]) {
      roomCursors[socket.id].x = x;
      roomCursors[socket.id].y = y;
    }
    socket.to(roomId).emit("cursor-move", {
      socketId: socket.id,
      x, y,
      color: userColor,
      name: roomCursors[socket.id]?.name,
    });
  });

  // Undo last element by this user
  socket.on("undo", async ({ roomId }) => {
    const elements = await store.getElements(roomId);
    for (let i = elements.length - 1; i >= 0; i--) {
      if (elements[i].id?.startsWith(socket.id)) {
        const removed = elements.splice(i, 1)[0];
        await store.setElements(roomId, elements);
        io.to(roomId).emit("undo-element", { elementId: removed.id });
        break;
      }
    }
  });

  // Clear entire room
  socket.on("clear", async ({ roomId }) => {
    await store.clearRoom(roomId);
    io.to(roomId).emit("clear");
  });

  socket.on("disconnect", () => {
    if (currentRoom) {
      const roomCursors = getRoomCursors(currentRoom);
      delete roomCursors[socket.id];
      socket.to(currentRoom).emit("user-left", { socketId: socket.id });
    }
  });
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Whiteboard server running on http://localhost:${PORT}`);
});
