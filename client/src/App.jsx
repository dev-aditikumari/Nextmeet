import { useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import Room from "./Room";

const REPO_URL = "https://github.com/dev-aditikumari/Nextmeet";

function GitHubCorner() {
  return (
    <a className="github-corner" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="View the source code on GitHub">
      <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
      GitHub
    </a>
  );
}

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
        <div className="home-help">
          <strong>No sign-up needed. To try it:</strong>
          <ol>
            <li>Type any name (or leave it as Guest).</li>
            <li>Leave Room ID blank and press Create room, then allow camera and microphone.</li>
            <li>Copy the room link and open it in a second tab or on another device to join yourself.</li>
          </ol>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GitHubCorner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}
