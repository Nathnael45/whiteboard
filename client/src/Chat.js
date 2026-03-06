import React, { useState, useEffect, useRef } from "react";

export default function Chat({ messages, onSend, myColor, userName, onClose }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Chat</span>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>No messages yet</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender === userName;
          return (
            <div key={i} style={{ ...styles.msgRow, justifyContent: isMe ? "flex-end" : "flex-start" }}>
              {!isMe && (
                <div style={{ ...styles.avatar, background: msg.color || "#888" }}>
                  {(msg.sender || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                {!isMe && <span style={{ ...styles.sender, color: msg.color }}>{msg.sender}</span>}
                <div style={{ ...styles.bubble, background: isMe ? myColor : "rgba(255,255,255,0.08)", alignSelf: isMe ? "flex-end" : "flex-start" }}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message..."
          autoFocus
        />
        <button type="submit" style={styles.sendBtn}>↑</button>
      </form>
    </div>
  );
}

const styles = {
  panel: {
    position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
    width: 260, maxHeight: "70vh",
    background: "rgba(18,18,30,0.95)", backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14,
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    display: "flex", flexDirection: "column",
    zIndex: 150,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  title: { color: "#ddd", fontSize: 13, fontWeight: 600 },
  closeBtn: { background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14 },
  messages: { flex: 1, overflowY: "auto", padding: "10px 10px 4px", display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#444", fontSize: 12, textAlign: "center", marginTop: 20 },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sender: { fontSize: 10, marginBottom: 2, fontWeight: 600 },
  bubble: { padding: "6px 10px", borderRadius: 10, fontSize: 12, color: "#fff", wordBreak: "break-word", lineHeight: 1.4 },
  inputRow: { display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  input: {
    flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 10px", outline: "none",
  },
  sendBtn: {
    background: "#3498db", border: "none", borderRadius: 8,
    color: "#fff", fontSize: 14, width: 32, cursor: "pointer",
  },
};
