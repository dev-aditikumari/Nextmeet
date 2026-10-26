const express = require("express");
const http = require("http");
const cors = require("cors");

const {Server} = require("socket.io");
const CLIENT_URL = process.env.CLIENT_URL || "*";
const app = express();
app.use(cors({origin : CLIENT_URL}));
const server = http.createServer(app);
const io  = new Server(server , {cors:{
    origin :CLIENT_URL
}});
//health check , used by hists and uptime pings
app.get("/",(_,res)=> res.send("NextMeet signaling server OK"));
const median = (a)=>{
    if(!a.length)return null;
const s =[...a].sort((x,y)=>x-y);
return s[Math.floor(s.length/2)];
};
app.get("/metrics",(req , res)=>{
    if(req.query.raw)return res.json(events);
    const out ={};
    for(const e of events){
        const v = (out[e.variant] ||= {
            setup_ok: 0 , setup_failed: 0 , disruption : 0 , recovered:0 , _ms:[],
        });
        if(typeof v[e.type]=== "number")v[e.type]++;
        if(e.type === "recovered" && e.ms)v._ms.push(e.ms);

    }
    for (const v of Object.values(out)){
        const setups = v.setup_ok + v.setup_failed;
        v.setupFailRate = setups ? +(v.setup_failed / setups).toFixed(3):null;
        v.unrecoveredRate = v.disruption ? +(1-v.recovered/ v.disruption).toFixed(3): null;
        v.medianRecoverMa = median(v._ms);
        delete v._mss;
    }
    res.json(out);
})
const PORT = process.env.PORT || 5000;

const rooms = {};
const events = []; // in memory ; capped so it can't grow forever
//roomId -> {socketId : name}

io.on("connection",(socket)=>{
    socket.on("join-room" , ({roomId , name})=>{
        rooms[roomId] = rooms[roomId] || {};
        const existing = Object.entries(rooms[roomId]).map(([id , n])=>({id ,name: n}));
        rooms[roomId][socket.id] = name ;
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.emit("room-users" , existing);
    });
    socket.on("metric",(m)=>{
        if(typeof m?.type !== "string" || typeof m?.variant !== "string")return;
        events.push({
            t: Date.now(),
            type : m.type.slice(0, 30),
            variant : m.variant.slice(0 , 30),
            ms: Number(m.ms) || null,
            note: typeof m.note === "string" ? m.note.slice(0 , 50): undefined,

        });
        if(events.length > 10000)events.shift();
    })
    //relay offers, answers and ICE candidates to a specific peer
    socket.on("signal",({to , data})=>{
        io.to(to).emit("signal" , {from: socket.id , data});
    });

    socket.on("media-state",(state)=>{
        const {roomId} = socket.data;
        const user = rooms[roomId]?.[socket.id];
        if(!user)return ;
        Object.assign(user , state);
        socket.to(roomId).emit("media-state", {id : socket.id , ...state});

    })
    socket.on("chat-message",({roundId , name , text})=>{
        io.to(roomId).emit("chat-message",{id:socket.id, name , text , ts:Date.now()});
    });
    socket.on("disconnect",()=>{
        const {roomId} = socket.data;
        if(!roomId  || !rooms[roomId])return ;
        delete  rooms[roomId][socket.id];
        if(!Object.keys(rooms[roomId]).length)delete rooms[roomId];
        socket.to(roomId).emit("user-left",socket.id);

    });
});
server.listen(PORT , ()=> console.log(`Signaling server on: ${PORT}`))