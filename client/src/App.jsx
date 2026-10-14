import { useEffect, useRef, useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";

import { getCurrentUser } from "./services/userService";
import { getUserConversations } from "./services/conversationService";
import { connectSocket, disconnectSocket, getSocket } from "./services/socket";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(localStorage.getItem("token")),
  );
  const [showRegister, setShowRegister] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const selectedConversationRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const loadConversations = async () => {
    const data = await getUserConversations();

    const items = (data.conversations || []).map((c) => ({
      ...c,
      user:
        c.type === "direct"
          ? {
              id: c.other_user_id,
              name: c.other_user_name,
              email: c.other_user_email,
              avatar_url: c.other_user_avatar,
              last_seen: c.other_user_last_seen,
            }
          : {
              id: c.id,
              name: c.name || "Group chat",
              avatar_url: c.avatar_url,
            },
    }));

    setConversations(items);

    setSelectedConversation((current) => {
      if (!current) return current;

      const updated = items.find(
        (item) => Number(item.id) === Number(current.id),
      );

      return updated || current;
    });

    return items;
  };

  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      if (!isAuthenticated) {
        setCurrentUser(null);
        setConversations([]);
        setSelectedConversation(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userData = await getCurrentUser();

        if (cancelled) return;

        setCurrentUser(userData.user);

        await loadConversations();

        if (cancelled) return;

        const socket = connectSocket();

        if (!socket) return;

        const handleConnect = () => {
          setSocketConnected(true);
          loadConversations().catch(console.error);
        };

        const handleDisconnect = () => {
          setSocketConnected(false);
        };

        const handlePresenceSnapshot = (data) => {
          setOnlineUserIds((data.onlineUserIds || []).map((id) => Number(id)));
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

        const handleNewMessage = (message) => {
          setConversations((previous) => {
            const current = previous.find(
              (item) => Number(item.id) === Number(message.conversation_id),
            );

            if (!current) {
              loadConversations().catch(console.error);
              return previous;
            }

            const isCurrentConversation =
              Number(selectedConversationRef.current?.id) ===
              Number(message.conversation_id);

            const updated = {
              ...current,
              last_message: message.content,
              last_message_at: message.created_at,
              last_activity_at: message.created_at,
              last_message_id: message.id,
              unread_count: isCurrentConversation
                ? 0
                : Number(current.unread_count || 0) +
                  (Number(message.sender_id) === Number(currentUser?.id)
                    ? 0
                    : 1),
            };

            return [
              updated,
              ...previous.filter(
                (item) => Number(item.id) !== Number(updated.id),
              ),
            ];
          });
        };

        const handleRead = (data) => {
          setConversations((previous) =>
            previous.map((item) =>
              Number(item.id) === Number(data.conversationId)
                ? {
                    ...item,
                    unread_count: 0,
                  }
                : item,
            ),
          );
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("presence_snapshot", handlePresenceSnapshot);
        socket.on("presence_update", handlePresenceUpdate);
        socket.on("new_message", handleNewMessage);
        socket.on("message_read", handleRead);

        setSocketConnected(socket.connected);

        return () => {
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
          socket.off("presence_snapshot", handlePresenceSnapshot);
          socket.off("presence_update", handlePresenceUpdate);
          socket.off("new_message", handleNewMessage);
          socket.off("message_read", handleRead);
        };
      } catch (error) {
        console.error("Initialize app error:", error);

        if (!cancelled && error.response?.status === 401) {
          localStorage.removeItem("token");
          disconnectSocket();
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initializeApp();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    disconnectSocket();

    localStorage.removeItem("token");

    setCurrentUser(null);
    setConversations([]);
    setSelectedConversation(null);
    setShowMobileChat(false);
    setOnlineUserIds([]);
    setIsAuthenticated(false);
  };

  const handleConversationCreated = (conversation, user) => {
    const item = {
      ...conversation,
      user:
        user ||
        conversation.user ||
        (conversation.type === "group"
          ? {
              id: conversation.id,
              name: conversation.name || "Group chat",
              avatar_url: conversation.avatar_url,
            }
          : null),
      unread_count: 0,
    };

    setConversations((previous) => [
      item,
      ...previous.filter((c) => Number(c.id) !== Number(item.id)),
    ]);

    setSelectedConversation(item);
    setShowMobileChat(true);
  };

  const handleSelectConversation = (conversation) => {
    const updated = {
      ...conversation,
      unread_count: 0,
    };

    setConversations((previous) =>
      previous.map((item) =>
        Number(item.id) === Number(updated.id) ? updated : item,
      ),
    );

    setSelectedConversation(updated);
    setShowMobileChat(true);

    const socket = getSocket();

    socket?.emit(
      "mark_read",
      {
        conversationId: Number(updated.id),
      },
      () => {},
    );
  };

  const handleGroupDeleted = async () => {
    setShowMobileChat(false);
    setSelectedConversation(null);

    try {
      await loadConversations();
    } catch (error) {
      console.error(
        "Failed to reload conversations after group deletion:",
        error,
      );
    }
  };

  if (!isAuthenticated) {
    return showRegister ? (
      <Register
        onRegisterSuccess={() => setShowRegister(false)}
        onShowLogin={() => setShowRegister(false)}
      />
    ) : (
      <Login
        onLoginSuccess={() => setIsAuthenticated(true)}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Loading chat...
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-gray-50 p-0 sm:p-4">
      <header className="flex h-14 shrink-0 items-center justify-between bg-green-700 px-4 text-white sm:rounded-t-xl">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-xl">◉</span>
          Real-Time Chat
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">{currentUser.name}</span>

          <span
            className={`hidden rounded-full px-2 py-1 text-[10px] sm:inline ${
              socketConnected ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {socketConnected ? "Connected" : "Reconnecting..."}
          </span>

          <button
            onClick={handleLogout}
            className="cursor-pointer rounded-md bg-white/15 px-3 py-2 text-sm hover:bg-white/25"
          >
            Logout
          </button>
        </div>
      </header>

      {!socketConnected && (
        <div className="shrink-0 bg-yellow-100 px-3 py-2 text-center text-xs text-yellow-800">
          Reconnecting... Messages will sync when connection returns.
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 overflow-hidden border-x border-b border-gray-200 bg-white sm:rounded-b-xl">
        <aside
          className={`${
            showMobileChat ? "hidden" : "flex"
          } w-full shrink-0 flex-col md:flex md:w-72 lg:w-80`}
        >
          <Sidebar
            conversations={conversations}
            onlineUserIds={onlineUserIds}
            selectedConversationId={selectedConversation?.id}
            onConversationCreated={handleConversationCreated}
            onSelectConversation={handleSelectConversation}
          />
        </aside>

        <section
          className={`${
            showMobileChat ? "flex" : "hidden"
          } min-h-0 min-w-0 flex-1 flex-col md:flex`}
        >
          <ChatWindow
            conversation={selectedConversation}
            currentUser={currentUser}
            onBack={() => setShowMobileChat(false)}
            onGroupDeleted={handleGroupDeleted}
            onConversationChanged={() =>
              loadConversations().catch(console.error)
            }
          />
        </section>
      </main>
    </div>
  );
}

export default App;
