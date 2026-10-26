import { useEffect, useRef } from "react";

export default function VideoTile({stream , name , muted = false}){
    const ref = useRef();
    useEffect(()=>{
        if(ref.current)ref.current.srcObject = stream;

    },[stream]);
    return (
        <div style={{ position: "relative", background: "#111", borderRadius: 12, overflow: "hidden" }}>
            <video ref={ref} autoPlay playsInline muted={muted}
           style={{ width: "100%", height: "100%", objectFit: "cover" }} />
         <span style={{ position: "absolute", left: 8, bottom: 8, color: "#fff",
                     background: "#0008", padding: "2px 8px", borderRadius: 6 }}>
        {name}
      </span>
    </div>
  );
}