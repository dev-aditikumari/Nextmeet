import React from 'react'
import { useEffect , useRef , useState } from 'react'

const Chat = ({messages , onSend}) => {
    const [text , setText] = useState("");
    const endRef = useRef();
    useEffect(()=>{
        endRef.current?.scrollIntoView({ behavior: "smooth" });

    },[messages]);
    const submit = ()=>{
        onSend(text);
        setText("");
    };
  return (
    <div style={{display:"flex" , flexDirection:"column", height :"100%" , background:"#1a1a1a" , color:"#fff" , borderRadius: 12 , padding: 12}} >
        <div style ={{flex: 1 , overflow :"auto"}}>
            {messages.map((m , i)=>(
                 <div key={i} style={{marginBottom : 8 , textAlign : m.mine? "right" :"left"}}>
                  <small style={{opacity:0.6}}>
                    {m.mine? "You":m.name} . {new Date(m.ts).toLocaleTimeString([],{hour:"2-digit", minute:"2-digit"})}
                    </small>  
           <div style={{ background: m.mine ? "#2563eb" : "#333", display: "inline-block",
                          padding: "6px 10px", borderRadius: 8, maxWidth: "85%" }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />

      
    </div>
  <div style={{ display: "flex", gap: 6 }}>
        <input style={{ flex: 1 }} value={text} placeholder="Message..."
               onChange={(e) => setText(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button onClick={submit}>Send</button>
      </div>
    </div>
  );
}

export default Chat
