import {useParams} from "react-router-dom";
import { useRoom } from "./useRooms";
import VideoTile from "./videoTile";
import Chat from "./Chat";
import { useEffect , useRef , useState } from "react";
export default function Room(){
    const {roomId} = useParams();
    const name  = sessionStorage.getItem("name")||"Guest";
    const {localStream , peers , messages , sendMessage,audioOn , videoOn , toggleAudio , toggleVideo , screenStream ,
        startScreenShare, stopScreenShare, socketStatus
    } = useRoom(roomId , name);
    const [panel , setPanel] = useState(null);
    const [unread , setUnread] = useState(0);
    const seen = useRef(0);
    useEffect(()=>{
        if(panel === "chat"){
            seen.current = messages.length;
            setUnread(0);
        }else{
            setUnread(messages.filter((m , i)=>i >= seen.current && !m.mine).length);

        }
    },[messages , panel]);
    const toggle =(p)=> setPanel((cur)=>(cur === p ? null :p));
    const tiles = Object.entries(peers);
    const cols = Math.ceil(Math.sqrt(tiles.length+1));
    const sharer = screenStream ? "You" : tiles.find(([,p])=> p.sharing)?.[1].name;
    return(
      <div style={{display : "flex" , height:"100vh", background:"#000" , color :"#fff"}}>
        <div style={{flex: 1 , display :"flex", flexDirection:"column"}}>
            {socketStatus !== "connected" && (
                <div style={{background:"#b45309", padding: 6 , textAlign:"center"}}>
                    Connection to server lost.Reconnecting...
                    </div>
            )}{sharer &&(
                <div style={{background:"#1d4ed8" , padding: 6 , textAlign:"center"}}>
                     🖥 {sharer} {sharer === "You"?"are":"is"}sharing a screen
                </div>
            )
        }
        <div style={{flex : 1 , display :"grid", gap: 12 , padding : 12, gridTemplateColumns:`repeat(${cols}, 1fr)`}}>
            <VideoTile stream={screenStream || localStream} name = {`${name} (You)`} muted audioOn ={audioOn} videoOn = {videoOn} sharing = {!!screenStream}/>
            {tiles.map(([id , p])=>(
                <VideoTile key = {id} stream ={p.stream} name = {p.name} audioOn = {p.audio} videoOn = {p.video} sharing = {p.sharing} status ={p.status}/>
            ))}
        </div>
        <div style={{display :"flex" , gap : 8 , justifyContent:"center ", padding:12}}>
            <button onClick={toggleAudio}>{audioOn ?"Mute":"Unmute"}</button>
            <button onClick={toggleVideo}>{videoOn ?"Camera off": "Camera on"}</button>
            <button onClick={screenStream ? stopScreenShare: startScreenShare}>
                {screenStream?"Stop sharing":"Share screen"}
            </button>
            <button onClick={()=> toggle("chat")}>Chat {unread > 0 && `(${unread})`}</button>
            <button onClick={()=> toggle("people")}>People ({tiles.length + 1})</button>
        </div>
        </div>
        {panel === "chat" && (
            <div style={{width : 320 , padding : 12}}>
                <Chat messages={messages} onSend={sendMessage}/>
                </div>

        )}
      {panel === "people" && (
        <div style={{ width: 320, padding: 12 }}>
          <h3>Participants</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>{name} (You) {!audioOn && "🔇"} {!videoOn && "📷✖"} {screenStream && "🖥"}</li>
            {tiles.map(([id, p]) => (
              <li key={id}>
                {p.name} {!p.audio && "🔇"} {!p.video && "📷✖"} {p.sharing && "🖥"}
                {p.status !== "connected" && <em> ({p.status})</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}