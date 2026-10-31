import {useEffect , useRef , useState} from "react";
import {io} from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
const STUN_ONLY = [{urls:"stun:stun.l.google.com:19302"}];
const params = new URLSearchParams(window.location.search);
const RECOVERY_ENABLED = params.get("recovery")!== "0";
const USE_TURN = params.get("turn") !== "0";
const VARIANT = `${RECOVERY_ENABLED?  "recovery":"norecovery"}-${USE_TURN ?"turn":"stun"}`;
const SETUP_TIMEOUT_MS = 15000;
//?relay = 1 in the URL forces all media through TURN (great for testing)
const FORCE_RELAY = new URLSearchParams(window.location.search).get("relay")==="1";
// camera + mic if possible, otherwise whatever the device has
async function getLocalStream(){
    const attempts = [{video:true , audio:true},{audio:true},{video:true}];
    let lastError;
    for(const constraints of attempts){
        try{
            return await navigator.mediaDevices.getUserMedia(constraints);
        }catch(err){
            lastError = err;
        }
    }
    throw lastError;
}
async function fetchIceServers(){
    
    const username = import.meta.env.VITE_TURN_USERNAME;
    const credential= import.meta.env.VITE_TURN_PASSWORD ;
    if(!credential || !username || !USE_TURN)return STUN_ONLY;
    return [
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ],
      username,
      credential,
    },
  ];

}
const DISCONNECT_GRACE_MS = 3000;
const MAX_ICE_RESTARTS =3;
const MAX_REBUILDS = 2;
const logEvent = (type , extra) => console.log("[nexmeet]",type , extra ??"");

export function useRoom(roomId , name){
    const [localStream , setLocalStream] = useState(null);
    const [peers , setPeers] = useState({});// id->{name , stream}
    const socketRef = useRef(null);
    const pcs = useRef({});
    const localRef = useRef(null);
    const [messages , setMessages] = useState([]);
    const [screenStream , setScreenStream] = useState(null);
    const screenRef = useRef(null);
    const [audioOn , setAudioOn] = useState(true);
    const [videoOn , setVideoOn] = useState(true);
    const [socketStatus , setSocketStatus] = useState("connecting");
    const [error , setError] = useState(null);
    const meta = useRef({});
    const pendingIce = useRef({});
    const iceRef = useRef(STUN_ONLY);

    useEffect(()=>{
        let cancelled = false ;
        let  joined = false;

        const socket = io(SERVER_URL);
        socketRef.current = socket;
        const send = (to , data)=> socket.emit("signal" , {to , data});
        const reporter = (id , type , data ={})=>{
            if(!meta.current[id]?.initiator)return ; // count each pair once
            logEvent(type , {id , ...data});
            socket.emit("metric",{type, variant : VARIANT , ...data});
        }
        const updatePeer = (id , patch) => setPeers((p)=>({...p , [id] :{...p[id],...patch}}));
        const joinRoom = ()=>{
            socket.emit("join-room",{
                roomId , 
                name ,
                audio : localRef.current.getAudioTracks()[0]?.enabled ?? false,
                video : localRef.current.getVideoTracks()[0]?.enabled ?? false,
                sharing : !!screenRef.current,
            })
        }
        const removePeer = (id)=>{
            clearTimeout(meta.current[id]?.timer);
            pcs.current[id]?.close();
            delete pcs.current[id];
            delete meta.current[id];
            delete pendingIce.current[id];
            setPeers((p)=>{
                const {[id]:_,...rest} = p;
                return rest;
            })

        };
        const makeOffer = async (id , {iceRestart = false , fresh = false }={})=>{
        const pc= pcs.current[id];
        if(!pc)return ;
        const offer = await pc.createOffer({iceRestart});
        await pc.setLocalDescription(offer);
        send(id , {sdp:pc.localDescription, name , fresh});
        };
        const rebuild = async(id)=>{
            const m = meta.current[id];
            if(!m)return ;
            if(m.rebuilds>= MAX_REBUILDS){
                logEvent("gave_up",{id});
                updatePeer(id , {status:"failed"});
                return ;
            }
            logEvent("rebuild",{id ,  attempt: m.rebuilds +1});
            const {name:peerName , rebuilds} = m;
            pcs.current[id]?.close();
            delete pcs.current[id];
            createPC(id , peerName , true);
            meta.current[id].rebuilds = rebuilds + 1;
            await makeOffer(id , {fresh : true});

        };
        const recover = (id)=>{
            const m = meta.current[id];
            if(!m || !pcs.current[id])return ;
            //Only the original offerer restarts , so both sides never offer at once.
            if(!m.initiator){
                send(id , {requestRestart :true});
                return ;
            }
            if(m.restarts < MAX_ICE_RESTARTS){
                m.restarts += 1;
                logEvent("ice_restart", {id , attempt : m.restarts});
                makeOffer(id , {iceRestart : true});
            }else {
                rebuild(id);
            }
        };
        const createPC = (id , peerName, initiator) =>{
            const pc = new RTCPeerConnection({
                iceServers : iceRef.current,
                iceTransportPolicy: FORCE_RELAY? "relay":"all",
            });
            const prev = meta.current[id];
            clearTimeout(prev?.setupTimer);
            meta.current[id] ={
                initiator,
                restarts: 0,
                rebuilds: prev?.rebuilds || 0,
                timer : null,
                name :peerName,
                startedAt : prev?.startedAt ?? performance.now(),
                setupDone : prev?.setupDone || false ,
                disruptedAt : prev?.disruptedAt || null,
                setupTimer : null,

            };
           const m0 = meta.current[id];
if (!m0.setupDone && !m0.setupReported) {
  m0.setupTimer = setTimeout(() => {
    const m = meta.current[id];
    if(m &&!m.setupDone && !m.setupReported){
        m.setupReported = true;
        reporter(id , "setup_failed",{note:"timeout"});

    }
  },SETUP_TIMEOUT_MS);
}
            pcs.current[id] = pc;

            localRef.current.getTracks().forEach((t)=>pc.addTrack(t , localRef.current));
            // if I'm already sharing my screen, send that instead of the camera

            if(screenRef.current){
                const sender = pc.getSenders().find((s)=>s.track?.kind==="video");
                sender?.replaceTrack(screenRef.current.getVideoTracks()[0]);
            }
            setPeers((p)=>({
                ...p,
                [id]:{audio: true , video: true , sharing : false , ...p[id], name:peerName , status:"connecting"},

            }));
            pc.onicecandidate = (e) =>{
                if(e.candidate) socket.emit("signal" , {to: id , data:{candidate: e.candidate}});

            };
            pc.ontrack =(e)=>{
                updatePeer( id , {stream : e.streams[0]});
            };
            pc.oniceconnectionstatechange=()=>{
                const m = meta.current[id];
                if(!m ||pcs.current[id] !==pc)return ;//stale connection
                const state = pc.iceConnectionState;
                clearTimeout(m.timer);
                if(state === "connected" || state === "completed"){
                    clearTimeout(m.setupTimer);
                 if(!m.setupDone){
                    m.setupDone = true ;
                    if(!m.setupReported){
                        m.setupReported = true ;
                        reporter(id , "setup_ok",{ms:Math.round(performance.now()-m.startedAt)});

                    }
                 }
                 if(m.disruptedAt){
                    reporter(id , "recovered",{ms: Math.round(performance.now()-m.disruptedAt)});
                    m.disruptedAt = null;
                 }
                 m.restarts = 0;
                 updatePeer(id,{status:"connected"});
                 return ;
            }
            if(state !== "disconnected" && state !== "failed")return ;
        if(!m.setupDone){
            if(state === "failed" && !m.setupReported){
                m.setupReported = true;
                reporter(id , "setup_failed" , {note :"ice_failed"});

            }
        }
        else if(!m.disruptedAt){
            m.disruptedAt = performance.now();
            reporter(id, "disruption",{note: state});

        }
        // baseline mode : no app-level recovery , just show the state
          if(!RECOVERY_ENABLED){
            updatePeer( id , {status : state === "failed"?"failed":"reconnecting"});
            return ;
          }
          updatePeer(id , {status:"reconnecting"});
          if(state === "disconnected"){
            m.timer = setTimeout(()=> recover(id), DISCONNECT_GRACE_MS);

          }else{
            recover(id);
          }
        };
            return pc;

        };
        const flushIce = async(id , pc)=>{
            const queue = pendingIce.current[id] || [];
            pendingIce.current[id] = [];
            for(const c of queue)await pc.addIceCandidate(c).catch(()=>{});
        }
        (async ()=>{
            try{
            const [stream , ice] = await Promise.all([
                getLocalStream(),
                fetchIceServers(),
            ]);
            if(cancelled)return stream.getTracks().forEach((t)=>t.stop());
            iceRef.current = ice;
            localRef.current = stream;
            setLocalStream(stream);
            setAudioOn(stream.getAudioTracks().length > 0);
            setVideoOn(stream.getVideoTracks().length > 0);
            joined=true;
            if(socket.connected)joinRoom();
            }catch(err){
                 console.error("Could not access camera/mic",err);
                 setError("Could not access your camera or microphone. Allow access in the browser and reload the page.");
            }
        })();
        // I'm the newcomer: offer to everyone already here
        socket.on("connect", ()=>{
           setSocketStatus("connected");
           if(joined && localRef.current){
            // socket dropped and came back with a NEW id , so the server forgot us:
            // tear down old Peers and rejoin
            logEvent("socket_reconnected");
            Object.keys(pcs.current).forEach(removePeer);
            joinRoom();
            }
        });
        socket.on("disconnect",()=> setSocketStatus("reconnecting"));
        // the server refused us: show the message, free the camera and never rejoin on reconnect
        const rejected = (message)=>{
            joined = false;
            setError(message);
            socket.disconnect();
            localRef.current?.getTracks().forEach((t)=>t.stop());
            setLocalStream(null);
        };
        socket.on("room-full",(max)=> rejected(`This room is full (${max} people maximum).`));
        socket.on("join-error",(message)=> rejected(message));
        //I'm the newcomer : offer to everyone already here
        socket.on("room-users", async(users)=>{
            for (const u of users){
                createPC(u.id , u.name , true);
                updatePeer(u.id , {audio: u.audio , video: u.video , sharing : u.sharing});
                await makeOffer(u.id); 
            }
        });
        socket.on("signal", async({from , data})=>{
            try{
                if(data.requestRestart) return recover(from);

            let pc = pcs.current[from];
            if(data.sdp){
                if(data.sdp.type === "offer"){
                    if(data.fresh && pc){
                        // the other side rebuild from scratch , so drop our old connection
                        pc.close();
                        delete pcs.current[from];
                        pc= null;
                    }
                    pc = pc|| createPC(from , data.name , false);
                    await pc.setRemoteDescription(data.sdp);
                    await flushIce(from , pc);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    send(from , {sdp:pc.localDescription});

                }else if(pc){
                    await pc.setRemoteDescription(data.sdp);
                    await flushIce(from , pc);
                }
            }else if(data.candidate && pc){
                if(pc.remoteDescription)await pc.addIceCandidate(data.candidate);
                else (pendingIce.current[from] ||= []).push(data.candidate);

                
            }
        }
    catch(err){
        console.warn("signal error",err);
    }});
         socket.on("media-state",({id,...state})=>updatePeer(id , state));

        socket.on("user-left",removePeer);
        socket.on("chat-message" ,(m)=>{
            setMessages((prev)=>[...prev , {...m , mine:m.id ===socket.id}]);
        }
        )
        return ()=>{
            cancelled = true ;
            Object.values(meta.current).forEach((m)=>clearTimeout(m.timer));
            socket.disconnect();
            Object.values(pcs.current).forEach((pc)=>pc.close());
            pcs.current ={};
            meta.current={};
            localRef.current?.getTracks().forEach((t)=>t.stop());
            screenRef.current?.getTracks().forEach((t)=>t.stop());

        };
    },[roomId , name]);
    //--------actions---------
        const sendMessage = (text)=>{
            if(!text.trim())return ;
            socketRef.current.emit("chat-message",{roomId , name , text});
        }
        const toggleAudio =()=>{
            const track = localRef.current?.getAudioTracks()[0];
            if(!track)return ;
            track.enabled = !track.enabled;
            setAudioOn(track.enabled);
            socketRef.current.emit("media-state",{audio : track.enabled});


                };
        const toggleVideo =()=>{
   const track = localRef.current?.getVideoTracks()[0];
   if(!track)return ;
     track.enabled = !track.enabled;
     setVideoOn(track.enabled);
     socketRef.current.emit("media-state",{video: track.enabled});


}

        const swapVideoTrack =(track)=>{
            Object.values(pcs.current).forEach((pc)=>{
                const sender = pc.getSenders().find((s)=>s.track?.kind==="video");
                sender?.replaceTrack(track);
            })
        }
        const stopScreenShare =()=>{
            if(!screenRef.current)return ;
            screenRef.current?.getTracks().forEach((t)=>t.stop());
            screenRef.current= null;
            setScreenStream(null);
            swapVideoTrack(localRef.current?.getVideoTracks()[0] ?? null);//back to camera
            socketRef.current.emit("media-state",{sharing:false});

        }
        const startScreenShare = async ()=>{
            try{
                const s = await navigator.mediaDevices.getDisplayMedia({video: true});
                const track = s.getVideoTracks()[0];
                screenRef.current = s;
                setScreenStream(s);
                swapVideoTrack(track);
                socketRef.current.emit("media-state",{sharing: true });
                track.onended = stopScreenShare;
            }
            catch(err){
                console.log("Screen share cancelled ",err);
            }
        };
        
    return {localStream , peers , socketStatus , error, videoOn , audioOn,toggleAudio,toggleVideo , messages , sendMessage , screenStream , startScreenShare , stopScreenShare};
}