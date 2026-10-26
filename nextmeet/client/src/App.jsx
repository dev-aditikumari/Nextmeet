import { useState } from 'react'
import { useState } from 'react'
import Room from './Room'
import { BrowserRouter , Route , Routes , useNavigate } from 'react-router-dom';

function Home(){
  const [name , setName] = useState("");
  const [room , setRoom] = useState("");
  const nav = useNavigate();
  const join = ()=>{
    sessionStorage.setItem("name", name || "Guest");
    nav(`/room/${room || Math.random().toString(36).slice(2 , 8)}`);
    return (
      <div style={{maxWidth: 320 , margib:"20vh auto", display:"grid", gap: 8}}>
        <h1>NextMeet</h1>
        <input placeholder='Your name' value={name} onChange={(e)=>setName(e.target.value)}/>
        <input placeholder='Room ID(blank=new)' value={room} onChange={(e)=>setRoom(e.target.value)}/>
        <button onClick={join} >Join</button>

      </div>
    )
  }
}

function App() {


  return (
    <BrowserRouter>
    <Routes>
      <Route path ="/" element={<Home/>}/>
      <Route path = "/room/:roomId" element={<Room/>}/>
    </Routes>
    </BrowserRouter>
    
  )
}

export default App
