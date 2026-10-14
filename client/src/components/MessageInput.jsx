import { useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket";

function MessageInput({ conversationId }) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const stopTyping = () => {
    const socket = getSocket();

    if (socket?.connected) {
      socket.emit("typing_stop", {
        conversationId: Number(conversationId),
      });
    }
  };

  const handleChange = (event) => {
    const value = event.target.value;

    setContent(value);
    setError("");

    const socket = getSocket();

    if (!socket?.connected) return;

    const now = Date.now();

    if (
      value.trim() &&
      now - lastTypingSent.current >= 700
    ) {
      socket.emit("typing_start", {
        conversationId: Number(conversationId),
      });

      lastTypingSent.current = now;
    }

    clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(
      stopTyping,
      900
    );
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimer.current);
      stopTyping();
    };
  }, [conversationId]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const text = content.trim();

    if (!text || sending) return;

    const socket = getSocket();

    if (!socket?.connected) {
      setError(
        "Reconnecting... Please try again."
      );
      return;
    }

    setSending(true);
    setError("");

    stopTyping();

    const clientMessageId =
      crypto.randomUUID();

    socket.timeout(10000).emit(
      "send_message",
      {
        conversationId: Number(conversationId),
        content: text,
        clientMessageId,
      },
      (timeoutError, response) => {
        setSending(false);

        if (timeoutError) {
          setError(
            "Message could not be sent. Please retry."
          );
          return;
        }

        if (!response?.success) {
          setError(
            response?.message ||
              "Unable to send message."
          );
          return;
        }

        setContent("");
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 bg-white px-3 py-3 sm:px-4 sm:py-3"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={handleChange}
          onBlur={stopTyping}
          placeholder="Type a message..."
          maxLength={5000}
          disabled={sending}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />

        <button
          type="submit"
          disabled={
            sending || !content.trim()
          }
          className="shrink-0 cursor-pointer rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}

export default MessageInput;