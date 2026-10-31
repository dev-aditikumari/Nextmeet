const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const PORT = 5055;
const URL = `http://localhost:${PORT}`;
let server;
const sockets = [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// connect a client and record every event it receives
const connect = () =>
  new Promise((resolve) => {
    const socket = io(URL, { forceNew: true });
    socket.received = {};
    socket.onAny((event, payload) => (socket.received[event] ||= []).push(payload));
    socket.on("connect", () => resolve(socket));
    sockets.push(socket);
  });

const join = async (roomId, name, extra = {}) => {
  const socket = await connect();
  socket.emit("join-room", { roomId, name, ...extra });
  await wait(150);
  return socket;
};

before(async () => {
  server = spawn("node", ["index.js"], {
    env: { ...process.env, PORT: String(PORT), MAX_ROOM_SIZE: "3" },
    stdio: "ignore",
  });
  await wait(1000);
});

after(() => {
  sockets.forEach((s) => s.disconnect());
  server.kill();
});

test("health check works", async () => {
  const res = await fetch(`${URL}/health`);
  assert.equal((await res.json()).status, "ok");
});

test("chat is delivered with the real name and does not crash the server", async () => {
  const alice = await join("chat-room", "Alice");
  alice.emit("chat-message", { name: "Someone else", text: "hello" });
  await wait(200);
  assert.equal(alice.connected, true);
  assert.equal(alice.received["chat-message"][0].name, "Alice");
  assert.equal(alice.received["chat-message"][0].text, "hello");
});

test("a late joiner sees the media state of people already in the room", async () => {
  const alice = await join("state-room", "Alice", { audio: false, video: true });
  alice.emit("media-state", { hand: true });
  await wait(150);
  const bob = await join("state-room", "Bob");
  const [first] = bob.received["room-users"][0];
  assert.equal(first.name, "Alice");
  assert.equal(first.audio, false);
  assert.equal(first.hand, true);
});

test("people already in the room are told how a newcomer joined", async () => {
  const alice = await join("join-room-state", "Alice");
  const bob = await join("join-room-state", "Bob", { video: false });
  const update = alice.received["media-state"].find((s) => s.id === bob.id);
  assert.equal(update.video, false);
});

test("a room is limited to MAX_ROOM_SIZE people", async () => {
  await join("full-room", "A");
  await join("full-room", "B");
  await join("full-room", "C");
  const d = await join("full-room", "D");
  assert.equal(d.received["room-full"].length, 1);
});

test("signals are only relayed inside the same room", async () => {
  const alice = await join("signal-room", "Alice");
  const bob = await join("signal-room", "Bob");
  const eve = await join("other-room", "Eve");
  alice.emit("signal", { to: eve.id, data: { sdp: "secret" } });
  alice.emit("signal", { to: bob.id, data: { hello: true } });
  await wait(200);
  assert.equal(eve.received.signal, undefined);
  assert.equal(bob.received.signal.length, 1);
  assert.equal(bob.received.signal[0].from, alice.id);
});

test("invalid input is rejected and the server keeps running", async () => {
  const socket = await connect();
  socket.emit("join-room", { roomId: "../../etc", name: "x" });
  socket.emit("join-room", null);
  socket.emit("chat-message", null);
  socket.emit("signal", null);
  await wait(200);
  assert.equal(socket.connected, true);
  assert.equal(socket.received["join-error"].length, 2);
});

test("chat is rate limited", async () => {
  const alice = await join("spam-room", "Alice");
  for (let i = 0; i < 40; i++) alice.emit("chat-message", { text: `spam ${i}` });
  await wait(400);
  assert.ok(alice.received["chat-message"].length <= 20);
});

test("others are told when someone leaves", async () => {
  const alice = await join("leave-room", "Alice");
  const bob = await join("leave-room", "Bob");
  const bobId = bob.id;
  bob.disconnect();
  await wait(200);
  assert.ok(alice.received["user-left"].includes(bobId));
});

test("metrics are aggregated without leaking raw data", async () => {
  const alice = await join("metrics-room", "Alice");
  alice.emit("metric", { type: "setup_ok", variant: "test-variant", ms: 100 });
  alice.emit("metric", { type: "disruption", variant: "test-variant" });
  alice.emit("metric", { type: "recovered", variant: "test-variant", ms: 800 });
  await wait(250);
  const metrics = await (await fetch(`${URL}/metrics`)).json();
  const v = metrics["test-variant"];
  assert.equal(v.medianRecoverMs, 800);
  assert.equal(v.unrecoveredRate, 0);
  assert.equal("_ms" in v, false);
});
