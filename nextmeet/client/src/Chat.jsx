import { useEffect, useRef, useState } from "react";

const Chat = ({ messages, onSend }) => {
  const [text, setText] = useState("");
  const endRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="chat">
      <div className="chat-list">
        {messages.length === 0 && <p style={{ color: "#9ca3af" }}>No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.mine ? "mine" : ""}`}>
            <small>
              {m.mine ? "You" : m.name} · {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </small>
            <div>
              <span className="msg-text">{m.text}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} placeholder="Type a message" maxLength={1000} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="primary">Send</button>
      </form>
    </div>
  );
};

export default Chat;
