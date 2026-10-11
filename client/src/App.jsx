
import { useEffect, useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";

import { getCurrentUser } from "./services/userService";
import { getUserConversations } from "./services/conversationService";
import { connectSocket, disconnectSocket } from "./services/socket";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem("token"))
  );
  const [showRegister, setShowRegister] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [loading, setLoading] = useState(true);

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
        connectSocket();

        const conversationData = await getUserConversations();
        if (cancelled) return;

        const items = (conversationData.conversations || []).map((c) => ({
          ...c,
          user:
            c.type === "direct"
              ? {
                  id: c.other_user_id,
                  name: c.other_user_name,
                  email: c.other_user_email,
                  avatar_url: c.other_user_avatar,
                }
              : { name: c.name || "Group chat" },
        }));

        setConversations(items);
      } catch (error) {
        console.error("Initialize app error:", error);

        if (!cancelled && error.response?.status === 401) {
          localStorage.removeItem("token");
          disconnectSocket();
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    setIsAuthenticated(false);
  };

  const handleConversationCreated = (conversation, user) => {
    const item = {
      ...conversation,
      user: user || conversation.user || null,
    };

    setConversations((previous) => [
      item,
      ...previous.filter((c) => c.id !== item.id),
    ]);

    setSelectedConversation(item);
    setShowMobileChat(true);
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <button
          onClick={handleLogout}
          className="rounded-lg bg-green-700 px-5 py-3 text-white"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-gray-50 p-0 sm:p-4">
      {/* Main header */}
      <header className="flex h-14 shrink-0 items-center justify-between rounded-none bg-green-700 px-4 text-white sm:rounded-t-xl">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-xl">◉</span>
          Real-Time Chat
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">
            {currentUser.name}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/15 px-3 py-2 text-sm hover:bg-white/25"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar and chat */}
      <main className="flex min-h-0 flex-1 overflow-hidden border-x border-b border-gray-200 bg-white sm:rounded-b-xl">
        <aside
          className={`${
            showMobileChat ? "hidden" : "flex"
          } w-full shrink-0 flex-col md:flex md:w-72 lg:w-80`}
        >
          <Sidebar
            conversations={conversations}
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
          />
        </section>
      </main>
    </div>
  );
}

export default App;
