import { useEffect, useRef } from "react";

export default function VideoTile({ stream, name, muted = false, audioOn = true, videoOn = true, sharing = false, hand = false, status }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);

  // a shared screen is always shown, even if the camera is off
  const showVideo = !!stream && (videoOn || sharing);

  return (
    <div className={`tile ${showVideo ? "" : "off"}`}>
      <video ref={ref} autoPlay playsInline muted={muted} />
      {!showVideo && (
        <div className="avatar">
          <span>{(name || "?").trim()[0]}</span>
        </div>
      )}
      <div className="tile-badges">
        {hand && <span className="badge amber">Hand raised</span>}
        {sharing && <span className="badge blue">Sharing</span>}
        {!audioOn && <span className="badge red">Muted</span>}
        {status && status !== "connected" && <span className="badge">{status}</span>}
      </div>
      <span className="tile-name">{name}</span>
    </div>
  );
}
