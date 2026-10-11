
import { useState } from "react";
import { getSocket } from "../services/socket";

function MessageInput({ conversationId }) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const text = content.trim();
    if (!text || sending) return;

    const socket = getSocket();

    if (!socket?.connected) {
      setError("Reconnecting... Please try again.");
      return;
    }

    setSending(true);
    setError("");

    socket.timeout(10000).emit(
      "send_message",
      {
        conversationId: Number(conversationId),
        content: text,
      },
      (timeoutError, response) => {
        setSending(false);

        if (timeoutError) {
          setError("Message could not be sent. Please retry.");
          return;
        }

        if (!response?.success) {
          setError(response?.message || "Unable to send message.");
          return;
        }

        setContent("");
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4"
    >
      <div className="flex items-end gap-2">
        <input
          type="text"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Type a message..."
          maxLength={5000}
          disabled={sending}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-1 focus:ring-green-600"
        />

        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="shrink-0 rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}

export default MessageInput;
