const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "*";
const MAX_ROOM_SIZE = Number(process.env.MAX_ROOM_SIZE) || 6;
const MAX_EVENTS = 10000;

// CLIENT_URL can be a comma separated list of allowed origins
const origins =
  CLIENT_URL === "*" ? "*" : CLIENT_URL.split(",").map((url) => url.trim().replace(/\/$/, ""));

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: origins }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins }, maxHttpBufferSize: 1e5 });

// rooms[roomId][socketId] = { name, audio, video, sharing }
const rooms = {};
// metrics sent by the clients, kept in memory and capped
const events = [];

const median = (list) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

app.get("/", (_, res) => res.send("NextMeet signaling server OK"));

app.get("/health", (_, res) => {
  const roomIds = Object.keys(rooms);
  const participants = roomIds.reduce((sum, id) => sum + Object.keys(rooms[id]).length, 0);
  res.json({ status: "ok", rooms: roomIds.length, participants });
});

app.get("/metrics", (req, res) => {
  if (req.query.raw) return res.json(events);

  const out = {};
  for (const e of events) {
    const v = (out[e.variant] ||= {
      setup_ok: 0,
      setup_failed: 0,
      disruption: 0,
      recovered: 0,
      _ms: [],
    });
    if (typeof v[e.type] === "number") v[e.type]++;
    if (e.type === "recovered" && e.ms) v._ms.push(e.ms);
  }

  for (const v of Object.values(out)) {
    const setups = v.setup_ok + v.setup_failed;
    v.setupFailRate = setups ? +(v.setup_failed / setups).toFixed(3) : null;
    v.unrecoveredRate = v.disruption ? +(1 - v.recovered / v.disruption).toFixed(3) : null;
    v.medianRecoverMs = median(v._ms);
    delete v._ms;
  }
  res.json(out);
});

const cleanText = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const validRoomId = (id) => typeof id === "string" && /^[\w\-. ]{1,64}$/.test(id);

io.on("connection", (socket) => {
  // an error inside one handler must never take the whole server down
  const on = (event, handler) =>
    socket.on(event, (...args) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`Error in "${event}" handler:`, err);
      }
    });

  const leaveRoom = () => {
    const { roomId } = socket.data;
    if (!roomId || !rooms[roomId]) return;
    delete rooms[roomId][socket.id];
    if (!Object.keys(rooms[roomId]).length) delete rooms[roomId];
    socket.leave(roomId);
    socket.to(roomId).emit("user-left", socket.id);
    socket.data.roomId = null;
  };

  let chatCount = 0;
  const chatReset = setInterval(() => (chatCount = 0), 10000);

  on("join-room", (input) => {
    const payload = input || {};
    const { roomId } = payload;
    if (!validRoomId(roomId)) return socket.emit("join-error", "Invalid room ID");
    if (socket.data.roomId === roomId) return;
    leaveRoom();

    rooms[roomId] = rooms[roomId] || {};
    if (Object.keys(rooms[roomId]).length >= MAX_ROOM_SIZE) {
      return socket.emit("room-full", MAX_ROOM_SIZE);
    }

    const existing = Object.entries(rooms[roomId]).map(([id, user]) => ({ id, ...user }));
    const me = {
      name: cleanText(payload.name, 40) || "Guest",
      audio: payload.audio !== false,
      video: payload.video !== false,
      sharing: payload.sharing === true,
    };
    rooms[roomId][socket.id] = me;
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room-users", existing);
    // let the people already here know how the newcomer joined (muted, camera off, ...)
    socket.to(roomId).emit("media-state", {
      id: socket.id,
      audio: me.audio,
      video: me.video,
      sharing: me.sharing,
    });
  });

  on("metric", (m) => {
    if (typeof m?.type !== "string" || typeof m?.variant !== "string") return;
    events.push({
      t: Date.now(),
      type: m.type.slice(0, 30),
      variant: m.variant.slice(0, 30),
      ms: Number(m.ms) || null,
      note: typeof m.note === "string" ? m.note.slice(0, 50) : undefined,
    });
    if (events.length > MAX_EVENTS) events.shift();
  });

  // relay offers, answers and ICE candidates, but only between people in the same room
  on("signal", (input) => {
    const { to, data } = input || {};
    const { roomId } = socket.data;
    if (!roomId || !rooms[roomId]?.[to] || !data) return;
    io.to(to).emit("signal", { from: socket.id, data });
  });

  on("media-state", (input) => {
    const state = input || {};
    const { roomId } = socket.data;
    const user = rooms[roomId]?.[socket.id];
    if (!user) return;

    const update = {};
    for (const key of ["audio", "video", "sharing"]) {
      if (typeof state[key] === "boolean") update[key] = state[key];
    }
    Object.assign(user, update);
    socket.to(roomId).emit("media-state", { id: socket.id, ...update });
  });

  on("chat-message", (input) => {
    const text = input?.text;
    const { roomId } = socket.data;
    const user = rooms[roomId]?.[socket.id];
    const message = cleanText(text, 1000);
    if (!user || !message) return;
    if (++chatCount > 20) return; // at most 20 messages per 10 seconds

    io.to(roomId).emit("chat-message", {
      id: socket.id,
      name: user.name,
      text: message,
      ts: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    clearInterval(chatReset);
    leaveRoom();
  });
});

server.listen(PORT, () => console.log(`Signaling server on: ${PORT}`));

const shutdown = () => {
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
