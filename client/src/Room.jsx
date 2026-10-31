import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoom } from "./useRoom";
import VideoTile from "./VideoTile";
import Chat from "./Chat";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const name = sessionStorage.getItem("name") || "Guest";
  const {
    localStream, peers, messages, sendMessage, audioOn, videoOn, toggleAudio, toggleVideo,
    screenStream, startScreenShare, stopScreenShare, socketStatus, error, handOn, toggleHand,
  } = useRoom(roomId, name);

  const [panel, setPanel] = useState(null);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const seen = useRef(0);

  useEffect(() => {
    if (panel === "chat") {
      seen.current = messages.length;
      setUnread(0);
    } else {
      setUnread(messages.filter((m, i) => i >= seen.current && !m.mine).length);
    }
  }, [messages, panel]);

  const toggle = (p) => setPanel((cur) => (cur === p ? null : p));

  // keyboard shortcuts: M mute, V camera, H raise hand, C chat
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "m") toggleAudio();
      else if (key === "v") toggleVideo();
      else if (key === "h") toggleHand();
      else if (key === "c") toggle("chat");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const tiles = Object.entries(peers);
  const cols = Math.ceil(Math.sqrt(tiles.length + 1));
  const sharer = screenStream ? "You" : tiles.find(([, p]) => p.sharing)?.[1].name;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

  if (error) {
    return (
      <div className="notice">
        <div className="notice-box">
          <h2>Cannot join this room</h2>
          <p>{error}</p>
          <button className="primary" onClick={() => navigate("/")}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="room">
      <div className="room-main">
        <div className="topbar">
          <strong>Room: {roomId}</strong>
          <button onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
          <span className="spacer" />
          <span>{name}</span>
        </div>

        {!localStream && (
          <div className="banner info">Waiting for camera and microphone access. Choose Allow in the browser prompt.</div>
        )}
        {localStream && socketStatus !== "connected" && (
          <div className="banner warn">Connection to the server was lost. Reconnecting...</div>
        )}
        {sharer && (
          <div className="banner info">
            {sharer} {sharer === "You" ? "are" : "is"} sharing a screen
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          <VideoTile
            stream={screenStream || localStream}
            name={`${name} (You)`}
            muted
            audioOn={audioOn}
            videoOn={videoOn}
            sharing={!!screenStream}
            hand={handOn}
          />
          {tiles.map(([id, p]) => (
            <VideoTile
              key={id}
              stream={p.stream}
              name={p.name || "Guest"}
              audioOn={p.audio !== false}
              videoOn={p.video !== false}
              sharing={p.sharing}
              hand={p.hand}
              status={p.status}
            />
          ))}
        </div>

        <div className="controls">
          <button disabled={!localStream} onClick={toggleAudio} title="Shortcut: M">{audioOn ? "Mute" : "Unmute"}</button>
          <button disabled={!localStream} onClick={toggleVideo} title="Shortcut: V">{videoOn ? "Camera off" : "Camera on"}</button>
          <button disabled={!localStream} className={handOn ? "active" : ""} onClick={toggleHand} title="Shortcut: H">
            {handOn ? "Lower hand" : "Raise hand"}
          </button>
          <button disabled={!localStream} className={screenStream ? "active" : ""} onClick={screenStream ? stopScreenShare : startScreenShare}>
            {screenStream ? "Stop sharing" : "Share screen"}
          </button>
          <button className={panel === "chat" ? "active" : ""} onClick={() => toggle("chat")} title="Shortcut: C">
            Chat {unread > 0 && `(${unread})`}
          </button>
          <button className={panel === "people" ? "active" : ""} onClick={() => toggle("people")}>
            People ({tiles.length + 1})
          </button>
          <button className="danger" onClick={() => navigate("/")}>Leave</button>
        </div>
      </div>

      {panel === "chat" && (
        <div className="side">
          <Chat messages={messages} onSend={sendMessage} />
        </div>
      )}
      {panel === "people" && (
        <div className="side">
          <h3>Participants</h3>
          <ul className="people">
            <li>
              {name} (You)
              {!audioOn && <span className="badge red">Muted</span>}
              {!videoOn && <span className="badge">Camera off</span>}
              {screenStream && <span className="badge blue">Sharing</span>}
              {handOn && <span className="badge amber">Hand raised</span>}
            </li>
            {tiles.map(([id, p]) => (
              <li key={id}>
                {p.name || "Guest"}
                {p.audio === false && <span className="badge red">Muted</span>}
                {p.video === false && <span className="badge">Camera off</span>}
                {p.sharing && <span className="badge blue">Sharing</span>}
                {p.hand && <span className="badge amber">Hand raised</span>}
                {p.status && p.status !== "connected" && <em>({p.status})</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
