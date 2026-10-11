
import { useEffect, useState } from "react";
import { getMessages } from "../services/messageService";
import { getSocket } from "../services/socket";
import MessageInput from "./MessageInput";

function ChatWindow({ conversation, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      setLoading(true);
      setError("");

      try {
        const data = await getMessages(conversation.id);

        if (!cancelled) {
          setMessages([...(data.data || [])].reverse());
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Get messages error:", err);
          setError("Unable to load messages.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const conversationId = Number(conversation.id);

    const joinRoom = () => {
      socket.emit(
        "join_conversation",
        { conversationId },
        (response) => {
          if (!response?.success) {
            setError(response?.message || "Unable to join chat.");
          } else {
            setError("");
          }
        }
      );
    };

    const handleNewMessage = (message) => {
      if (Number(message.conversation_id) !== conversationId) return;

      setMessages((previous) => {
        if (previous.some((m) => String(m.id) === String(message.id))) {
          return previous;
        }

        return [...previous, message];
      });
    };

    if (socket.connected) joinRoom();

    socket.on("connect", joinRoom);
    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("new_message", handleNewMessage);
    };
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-6">
        <p className="text-center text-sm text-gray-500">
          Select a conversation to start chatting
        </p>
      </div>
    );
  }

  const conversationName =
    conversation.user?.name ||
    conversation.other_user_name ||
    conversation.name ||
    "Conversation";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-50">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 sm:px-5">
        <button
          onClick={onBack}
          className="rounded-md px-2 py-1 text-lg text-green-700 hover:bg-green-50 md:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-800">
          {conversationName.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-800">
            {conversationName}
          </h2>
          <p className="text-xs text-gray-500">Direct conversation</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-5">
        {loading && (
          <p className="text-center text-sm text-gray-500">
            Loading messages...
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        {!loading && messages.length === 0 && !error && (
          <p className="m-auto text-center text-sm text-gray-400">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((message) => {
          const isMine =
            Number(message.sender_id) === Number(currentUser?.id);

          return (
            <div
              key={message.id}
              className={`flex ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm sm:max-w-[70%] ${
                  isMine
                    ? "rounded-br-sm bg-green-700 text-white"
                    : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput
        conversationId={conversation.id}
        onMessageSent={() => {}}
      />
    </div>
  );
}

export default ChatWindow;
