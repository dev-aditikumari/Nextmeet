import { useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Room from "./Room";

function Home() {
  const [name, setName] = useState(sessionStorage.getItem("name") || "");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const join = (e) => {
    e.preventDefault();
    const roomId = room.trim() || Math.random().toString(36).slice(2, 8);
    if (!/^[\w\-. ]{1,64}$/.test(roomId)) {
      setError("Room ID can only contain letters, numbers, spaces, dashes, dots and underscores.");
      return;
    }
    sessionStorage.setItem("name", name.trim() || "Guest");
    navigate(`/room/${encodeURIComponent(roomId)}`);
  };

  return (
    <div className="home">
      <form className="home-card" onSubmit={join}>
        <h1>NextMeet</h1>
        <p>Video meetings in your browser.</p>
        <label>
          Your name
          <input value={name} maxLength={40} placeholder="Guest" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Room ID
          <input
            value={room}
            maxLength={64}
            placeholder="Leave blank to create a new room"
            onChange={(e) => {
              setRoom(e.target.value);
              setError("");
            }}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary">{room.trim() ? "Join room" : "Create room"}</button>
        <span className="home-note">Share the room link with others so they can join you.</span>
      </form>
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
