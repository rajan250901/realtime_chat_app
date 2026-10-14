import { useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket";

function MessageInput({ conversationId }) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const typingTimer = useRef(null);
  const lastTyping = useRef(0);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const handleChange = (event) => {
    const value = event.target.value;
    setContent(value);
    const socket = getSocket();
    if (!socket?.connected) return;
    const now = Date.now();
    if (value.trim() && now - lastTyping.current > 700) {
      socket.emit("typing_start", { conversationId: Number(conversationId) });
      lastTyping.current = now;
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("typing_stop", { conversationId: Number(conversationId) }), 1000);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    const socket = getSocket();
    if (!socket?.connected) return setError("Reconnecting... Please try again.");
    setSending(true); setError("");
    socket.timeout(10000).emit("send_message", { conversationId: Number(conversationId), content: text, clientMessageId: crypto.randomUUID() }, (timeoutError, response) => {
      setSending(false);
      if (timeoutError) return setError("Message could not be sent. Please retry.");
      if (!response?.success) return setError(response?.message || "Unable to send message.");
      setContent("");
      socket.emit("typing_stop", { conversationId: Number(conversationId) });
    });
  };

  return <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4"><div className="flex items-end gap-2"><input type="text" value={content} onChange={handleChange} placeholder="Type a message..." maxLength={5000} disabled={sending} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600" /><button type="submit" disabled={sending || !content.trim()} className="shrink-0 cursor-pointer rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "..." : "Send"}</button></div>{error && <p className="mt-2 text-xs text-red-600">{error}</p>}</form>;
}
export default MessageInput;
