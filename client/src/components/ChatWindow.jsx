import { useEffect, useMemo, useState } from "react";
import { getMessages } from "../services/messageService";
import { getSocket } from "../services/socket";
import MessageInput from "./MessageInput";
import GroupInfoPanel from "./GroupInfoPanel";

const getMessageDateLabel = (dateValue) => {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();

  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return "Today";
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isSameMessageDate = (firstDate, secondDate) => {
  if (!firstDate || !secondDate) return false;

  const first = new Date(firstDate);
  const second = new Date(secondDate);

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return false;
  }

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

function ChatWindow({
  conversation,
  currentUser,
  onBack,
  onConversationChanged,
  onGroupDeleted,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const conversationId = Number(conversation?.id);

  const conversationName =
    conversation?.user?.name ||
    conversation?.other_user_name ||
    conversation?.name ||
    "Conversation";

  const otherUserId = Number(
    conversation?.user?.id || conversation?.other_user_id,
  );

  const isOtherUserOnline = onlineUserIds.includes(otherUserId);

  const loadMessages = async () => {
    if (!conversationId) return;

    setLoading(true);
    setError("");

    try {
      const data = await getMessages(conversationId);
      setMessages([...(data.data || [])].reverse());
    } catch (err) {
      console.error("Get messages error:", err);
      setError("Unable to load messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function initialLoad() {
      try {
        setLoading(true);
        const data = await getMessages(conversationId);

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

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const socket = getSocket();
    if (!socket) return;

    const joinRoom = () => {
      socket.emit("join_conversation", { conversationId }, (response) => {
        if (!response?.success) {
          setError(response?.message || "Unable to join chat.");
          return;
        }

        setError("");

        socket.emit("mark_read", { conversationId }, () => {});
      });
    };

    const handleNewMessage = (message) => {
      if (Number(message.conversation_id) !== conversationId) return;

      setMessages((previous) => {
        if (
          previous.some(
            (item) =>
              String(item.id) === String(message.id) ||
              (item.client_message_id &&
                message.client_message_id &&
                item.client_message_id === message.client_message_id),
          )
        ) {
          return previous;
        }

        return [...previous, message];
      });

      socket.emit("mark_read", { conversationId }, () => {});
    };

    const handleEdited = (message) => {
      if (Number(message.conversation_id) !== conversationId) return;

      setMessages((previous) =>
        previous.map((item) =>
          String(item.id) === String(message.id)
            ? { ...item, ...message }
            : item,
        ),
      );
    };

    const handleDeleted = (message) => {
      if (Number(message.conversation_id) !== conversationId) return;

      setMessages((previous) =>
        previous.map((item) =>
          String(item.id) === String(message.id)
            ? { ...item, ...message }
            : item,
        ),
      );
    };

    const handleReaction = (data) => {
      if (Number(data.conversationId) !== conversationId) return;

      setMessages((previous) =>
        previous.map((message) => {
          if (Number(message.id) !== Number(data.messageId)) {
            return message;
          }

          const current = Array.isArray(message.reactions)
            ? [...message.reactions]
            : [];

          const index = current.findIndex(
            (reaction) =>
              Number(reaction.user_id) === Number(data.userId) &&
              reaction.emoji === data.emoji,
          );

          if (data.action === "added" && index === -1) {
            current.push({
              user_id: data.userId,
              emoji: data.emoji,
            });
          }

          if (data.action === "removed" && index !== -1) {
            current.splice(index, 1);
          }

          return {
            ...message,
            reactions: current,
          };
        }),
      );
    };

    const handleTypingStart = (data) => {
      if (Number(data.conversationId) !== conversationId) return;
      if (Number(data.userId) === Number(currentUser?.id)) return;

      setTypingUsers((previous) => {
        if (previous.includes(data.name || data.userId)) {
          return previous;
        }

        return [...previous, data.name || data.userId];
      });
    };

    const handleTypingStop = (data) => {
      if (Number(data.conversationId) !== conversationId) return;

      setTypingUsers((previous) =>
        previous.filter(
          (item) =>
            String(item) !== String(data.name) &&
            String(item) !== String(data.userId),
        ),
      );
    };

    const handlePresenceSnapshot = (data) => {
      setOnlineUserIds((data.onlineUserIds || []).map(Number));
    };

    const handlePresenceUpdate = (data) => {
      const id = Number(data.userId);

      setOnlineUserIds((previous) => {
        if (data.online) {
          return previous.includes(id) ? previous : [...previous, id];
        }

        return previous.filter((item) => item !== id);
      });
    };

    const handleRead = (data) => {
      if (Number(data.conversationId) !== conversationId) return;

      setMessages((previous) =>
        previous.map((message) => {
          if (Number(message.sender_id) !== Number(currentUser?.id)) {
            return message;
          }

          if (Number(message.id) <= Number(data.lastReadMessageId || 0)) {
            return {
              ...message,
              read_by_user: true,
              read_summary: data.summary,
            };
          }

          return message;
        }),
      );
    };

    const handleDelivered = (data) => {
      if (Number(data.conversationId) !== conversationId) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) =>
          Number(message.sender_id) === Number(currentUser?.id)
            ? { ...message, delivered: true }
            : message,
        ),
      );
    };

    const handleConnect = () => {
      joinRoom();
      loadMessages();
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on("connect", handleConnect);
    socket.on("new_message", handleNewMessage);
    socket.on("message_edited", handleEdited);
    socket.on("message_deleted", handleDeleted);
    socket.on("message_reaction", handleReaction);
    socket.on("typing_start", handleTypingStart);
    socket.on("typing_stop", handleTypingStop);
    socket.on("presence_snapshot", handlePresenceSnapshot);
    socket.on("presence_update", handlePresenceUpdate);
    socket.on("message_read", handleRead);
    socket.on("message_delivered", handleDelivered);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("new_message", handleNewMessage);
      socket.off("message_edited", handleEdited);
      socket.off("message_deleted", handleDeleted);
      socket.off("message_reaction", handleReaction);
      socket.off("typing_start", handleTypingStart);
      socket.off("typing_stop", handleTypingStop);
      socket.off("presence_snapshot", handlePresenceSnapshot);
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("message_read", handleRead);
      socket.off("message_delivered", handleDelivered);
    };
  }, [conversationId, currentUser?.id]);

  const editMessage = (message) => {
    const nextContent = window.prompt("Edit message:", message.content);

    if (!nextContent?.trim()) return;

    const socket = getSocket();

    socket?.emit(
      "edit_message",
      {
        messageId: message.id,
        content: nextContent.trim(),
      },
      (response) => {
        if (!response?.success) {
          setError(response?.message || "Unable to edit message.");
        }
      },
    );
  };

  const deleteMessage = (message) => {
    if (!window.confirm("Delete this message for everyone?")) {
      return;
    }

    const socket = getSocket();

    socket?.emit("delete_message", { messageId: message.id }, (response) => {
      if (!response?.success) {
        setError(response?.message || "Unable to delete message.");
      }
    });
  };

  const reactMessage = (message) => {
    const socket = getSocket();

    socket?.emit(
      "react_message",
      {
        messageId: message.id,
        emoji: "👍",
      },
      (response) => {
        if (!response?.success) {
          setError(response?.message || "Unable to react.");
        }
      },
    );
  };

  const reactionCounts = (reactions = []) =>
    reactions.reduce((result, reaction) => {
      result[reaction.emoji] = (result[reaction.emoji] || 0) + 1;

      return result;
    }, {});

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-6">
        <p className="text-center text-sm text-gray-500">
          Select a conversation to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-50">
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

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-gray-800">
            {conversationName}
          </h2>

          {conversation.type === "group" ? (
            <p className="text-xs text-gray-500">Group conversation</p>
          ) : (
            <p className="text-xs text-gray-500">
              {isOtherUserOnline
                ? "Online"
                : conversation.user?.last_seen
                  ? `Last seen ${new Date(
                      conversation.user.last_seen,
                    ).toLocaleString()}`
                  : "Offline"}
            </p>
          )}
        </div>

        {conversation.type === "group" && (
          <button
            onClick={() => setShowGroupInfo(true)}
            className="rounded-lg border px-3 py-2 text-xs hover:bg-gray-50"
          >
            Group Info
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-5">
        {loading && (
          <p className="text-center text-sm text-gray-500">
            Loading messages...
          </p>
        )}

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        {typingUsers.length > 0 && (
          <div className="text-xs italic text-gray-500">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
            typing...
          </div>
        )}

        {!loading && messages.length === 0 && !error && (
          <p className="m-auto text-center text-sm text-gray-400">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((message, index) => {
          const isMine = Number(message.sender_id) === Number(currentUser?.id);

          const counts = reactionCounts(message.reactions || []);

          const isDeleted = Boolean(message.deleted_at);

          const previousMessage = messages[index - 1];

          const showDate =
            index === 0 ||
            !isSameMessageDate(
              previousMessage?.created_at,
              message?.created_at,
            );

          const dateLabel = getMessageDateLabel(message?.created_at);

          return (
            <div key={message.id}>
              {showDate && dateLabel && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-[11px] text-gray-600">
                    {dateLabel}
                  </span>
                </div>
              )}

              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className="group max-w-[90%] sm:max-w-[75%]">
                  <div
                    className={`break-words rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? "rounded-br-sm bg-green-700 text-white"
                        : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <div className={isDeleted ? "italic opacity-70" : ""}>
                      {message.content}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                      <span>
                        {message.created_at
                          ? new Date(message.created_at).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : ""}
                      </span>

                      {message.edited && !isDeleted && <span>edited</span>}

                      {isMine && !isDeleted && (
                        <span>
                          {message.read_by_user
                            ? "Read"
                            : message.delivered
                              ? "Delivered"
                              : "Sent"}
                        </span>
                      )}

                      {conversation.type === "group" &&
                        isMine &&
                        message.read_summary && (
                          <span>
                            Seen by{" "}
                            {Math.max(
                              Number(message.read_summary.seen_members || 0) -
                                1,
                              0,
                            )}{" "}
                            of{" "}
                            {Math.max(
                              Number(message.read_summary.total_members || 1) -
                                1,
                              0,
                            )}
                          </span>
                        )}
                    </div>
                  </div>

                  {!isDeleted && (
                    <div
                      className={`mt-1 hidden items-center gap-1 group-hover:flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <button
                        onClick={() => reactMessage(message)}
                        className="rounded border bg-white px-2 py-1 text-xs"
                        title="React"
                      >
                        👍
                      </button>

                      {isMine && (
                        <>
                          <button
                            onClick={() => editMessage(message)}
                            className="rounded border bg-white px-2 py-1 text-xs"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteMessage(message)}
                            className="rounded border bg-white px-2 py-1 text-xs text-red-600"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {Object.keys(counts).length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {Object.entries(counts).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="rounded-full border bg-white px-2 py-0.5 text-xs"
                        >
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput conversationId={conversation.id} />

      {showGroupInfo && (
        <GroupInfoPanel
          conversation={conversation}
          currentUser={currentUser}
          onClose={() => setShowGroupInfo(false)}
          onGroupDeleted={(id) => {
            setShowGroupInfo(false);
            onGroupDeleted?.(id);
            onConversationChanged?.();
          }}
        />
      )}
    </div>
  );
}

export default ChatWindow;
