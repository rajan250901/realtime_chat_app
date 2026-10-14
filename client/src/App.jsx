import { useEffect, useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { getCurrentUser } from "./services/userService";
import { getUserConversations } from "./services/conversationService";
import { connectSocket, disconnectSocket } from "./services/socket";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("token")));
  const [showRegister, setShowRegister] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenByUser, setLastSeenByUser] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initializeApp() {
      if (!isAuthenticated) { setCurrentUser(null); setConversations([]); setSelectedConversation(null); setLoading(false); return; }
      setLoading(true);
      try {
        const userData = await getCurrentUser();
        if (cancelled) return;
        setCurrentUser(userData.user);
        const socket = connectSocket();
        if (socket) {
          const onSnapshot = ({ onlineUsers: ids = [] }) => setOnlineUsers(new Set(ids.map(Number)));
          const onPresence = ({ userId, status, lastSeen }) => {
            const id = Number(userId);
            setOnlineUsers((prev) => { const next = new Set(prev); if (status === "online") next.add(id); else next.delete(id); return next; });
            if (status === "offline" && lastSeen) setLastSeenByUser((prev) => ({ ...prev, [id]: lastSeen }));
          };
          const onConnect = () => setSocketConnected(true);
          const onDisconnect = () => setSocketConnected(false);
          socket.on("presence_snapshot", onSnapshot);
          socket.on("presence_update", onPresence);
          socket.on("connect", onConnect);
          socket.on("disconnect", onDisconnect);
          setSocketConnected(socket.connected);
          const cleanupSocket = () => { socket.off("presence_snapshot", onSnapshot); socket.off("presence_update", onPresence); socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); };
          const conversationData = await getUserConversations();
          if (cancelled) { cleanupSocket(); return; }
          const items = (conversationData.conversations || []).map((c) => ({
            ...c,
            user: c.type === "direct" ? { id: c.other_user_id, name: c.other_user_name, email: c.other_user_email, avatar_url: c.other_user_avatar, last_seen: c.other_user_last_seen } : { name: c.name || "Group chat" },
          }));
          setConversations(items);
          return cleanupSocket;
        }
        const conversationData = await getUserConversations();
        const items = (conversationData.conversations || []).map((c) => ({ ...c, user: c.type === "direct" ? { id: c.other_user_id, name: c.other_user_name, email: c.other_user_email, avatar_url: c.other_user_avatar, last_seen: c.other_user_last_seen } : { name: c.name || "Group chat" } }));
        if (!cancelled) setConversations(items);
      } catch (error) {
        console.error("Initialize app error:", error);
        if (!cancelled && error.response?.status === 401) { localStorage.removeItem("token"); disconnectSocket(); setIsAuthenticated(false); }
      } finally { if (!cancelled) setLoading(false); }
    }
    initializeApp();
    return () => { cancelled = true; disconnectSocket(); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = connectSocket();
    if (!socket) return;
    const handleNewMessage = (message) => {
      setConversations((previous) => {
        const index = previous.findIndex((c) => Number(c.id) === Number(message.conversation_id));
        if (index === -1) return previous;
        const selected = Number(selectedConversation?.id) === Number(message.conversation_id);
        const updated = { ...previous[index], last_message: message.content, last_message_at: message.created_at, last_activity_at: message.created_at, unread_count: selected ? 0 : Number(previous[index].unread_count || 0) + (Number(message.sender_id) === Number(currentUser?.id) ? 0 : 1) };
        return [updated, ...previous.filter((_, i) => i !== index)];
      });
    };
    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, [isAuthenticated, selectedConversation?.id, currentUser?.id]);

  const handleLogout = () => { disconnectSocket(); localStorage.removeItem("token"); setCurrentUser(null); setConversations([]); setSelectedConversation(null); setShowMobileChat(false); setIsAuthenticated(false); };

  const handleConversationCreated = (conversation, user) => {
    const item = { ...conversation, user: user || conversation.user || { name: conversation.name } };
    setConversations((previous) => [item, ...previous.filter((c) => c.id !== item.id)]);
    setSelectedConversation(item); setShowMobileChat(true);
  };

  const handleSelectConversation = (conversation) => {
    setConversations((previous) => previous.map((c) => c.id === conversation.id ? { ...c, unread_count: 0 } : c));
    setSelectedConversation({ ...conversation, unread_count: 0 }); setShowMobileChat(true);
  };

  if (!isAuthenticated) return showRegister ? <Register onRegisterSuccess={() => setShowRegister(false)} onShowLogin={() => setShowRegister(false)} /> : <Login onLoginSuccess={() => setIsAuthenticated(true)} onShowRegister={() => setShowRegister(true)} />;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">Loading chat...</div>;
  if (!currentUser) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><button onClick={handleLogout} className="cursor-pointer rounded-lg bg-green-700 px-5 py-3 text-white">Back to login</button></div>;

  return (
    <div className="flex h-dvh flex-col bg-gray-50 p-0 sm:p-4">
      <header className="flex h-14 shrink-0 items-center justify-between rounded-none bg-green-700 px-4 text-white sm:rounded-t-xl">
        <div className="flex items-center gap-2 font-semibold"><span className="text-xl">◉</span>Real-Time Chat</div>
        <div className="flex items-center gap-3"><span className="hidden text-xs sm:inline">{socketConnected ? "Connected" : "Reconnecting..."}</span><span className="hidden text-sm sm:inline">{currentUser.name}</span><button onClick={handleLogout} className="cursor-pointer rounded-md bg-white/15 px-3 py-2 text-sm hover:bg-white/25">Logout</button></div>
      </header>
      {!socketConnected && <div className="bg-amber-100 px-3 py-1 text-center text-xs font-medium text-amber-800">Reconnecting... Messages will sync when the connection returns.</div>}
      <main className="flex min-h-0 flex-1 overflow-hidden border-x border-b border-gray-200 bg-white sm:rounded-b-xl">
        <aside className={`${showMobileChat ? "hidden" : "flex"} w-full shrink-0 flex-col md:flex md:w-72 lg:w-80`}><Sidebar conversations={conversations} onConversationCreated={handleConversationCreated} onSelectConversation={handleSelectConversation} onlineUsers={onlineUsers} lastSeenByUser={lastSeenByUser} /></aside>
        <section className={`${showMobileChat ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
          <ChatWindow conversation={selectedConversation} currentUser={currentUser} onBack={() => setShowMobileChat(false)} onlineUsers={onlineUsers} lastSeenByUser={lastSeenByUser} />
        </section>
      </main>
    </div>
  );
}

export default App;
