
import UserSearch from "./UserSearch";

function Sidebar({
  conversations = [],
  onConversationCreated,
  onSelectConversation,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-gray-100 p-3 sm:p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Chats</h2>
        <UserSearch onConversationCreated={onConversationCreated} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <h3 className="px-2 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Conversations
        </h3>

        {conversations.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">
            No conversations yet. Search for someone to start chatting.
          </p>
        ) : (
          conversations.map((conversation) => {
            const name =
              conversation.user?.name ||
              conversation.name ||
              "Conversation";

            const initials = name.charAt(0).toUpperCase();

            return (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-800">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {name}
                  </p>

                  <p className="mt-1 truncate text-xs text-gray-500">
                    {conversation.last_message || "Start a conversation"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Sidebar;
