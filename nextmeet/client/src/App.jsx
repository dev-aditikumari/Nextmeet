import { useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Room from "./Room";

function Home() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  const join = () => {
    sessionStorage.setItem("name", name.trim() || "Guest");
    const roomId = room.trim() || Math.random().toString(36).slice(2, 8);
    navigate(`/room/${encodeURIComponent(roomId)}`);
  };

  return (
    <div style={{ maxWidth: 320, margin: "20vh auto", display: "grid", gap: 8 }}>
      <h1>NextMeet</h1>
      <input
        placeholder="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        placeholder="Room ID (blank = new)"
        value={room}
        onChange={(event) => setRoom(event.target.value)}
      />
      <button onClick={join}>Join</button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
  }
