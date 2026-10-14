import { useState } from "react";
import UserSearch from "./UserSearch";
import { searchUsers } from "../services/userService";
import { createGroup } from "../services/groupService";
import { formatLastSeen } from "../utils/formatLastSeen";


// =====================================================
// FORMAT CHAT TIME
// =====================================================

const formatChatTime = (dateValue) => {

  if (!dateValue) {
    return "";
  }


  const date =
    new Date(dateValue);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  const today =
    new Date();


  if (
    date.toDateString() ===
    today.toDateString()
  ) {

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  }


  const yesterday =
    new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );


  if (
    date.toDateString() ===
    yesterday.toDateString()
  ) {

    return "Yesterday";

  }


  return date.toLocaleDateString(
    [],
    {
      day: "2-digit",
      month: "short",
    }
  );

};


// =====================================================
// SIDEBAR
// =====================================================

function Sidebar({
  conversations = [],
  onConversationCreated,
  onSelectConversation,
  onlineUsers = new Set(),
  lastSeenByUser = {},
}) {

  const [
    showGroupForm,
    setShowGroupForm,
  ] = useState(false);


  const [
    groupName,
    setGroupName,
  ] = useState("");


  const [
    memberSearch,
    setMemberSearch,
  ] = useState("");


  const [
    memberResults,
    setMemberResults,
  ] = useState([]);


  const [
    selectedMembers,
    setSelectedMembers,
  ] = useState([]);


  const [
    creating,
    setCreating,
  ] = useState(false);


  // =====================================================
  // SEARCH GROUP MEMBERS
  // =====================================================

  const searchMembers =
    async (value) => {

      setMemberSearch(value);


      if (!value.trim()) {

        setMemberResults([]);

        return;

      }


      try {

        const data =
          await searchUsers(
            value
          );

        setMemberResults(
          data.users || []
        );

      } catch (error) {

        console.error(
          "Group member search error",
          error
        );

      }

    };


  // =====================================================
  // SELECT / UNSELECT MEMBER
  // =====================================================

  const toggleMember =
    (user) => {

      setSelectedMembers(
        (previous) =>
          previous.some(
            (member) =>
              member.id === user.id
          )
            ? previous.filter(
                (member) =>
                  member.id !== user.id
              )
            : [
                ...previous,
                user,
              ]
      );

    };


  // =====================================================
  // CREATE GROUP
  // =====================================================

  const submitGroup =
    async () => {

      if (
        !groupName.trim() ||
        creating
      ) {

        return;

      }


      try {

        setCreating(true);


        const data =
          await createGroup(
            groupName.trim(),
            selectedMembers.map(
              (member) =>
                member.id
            )
          );


        onConversationCreated(
          {
            ...data.group,
            user: {
              name:
                data.group.name,
            },
          }
        );


        setGroupName("");
        setSelectedMembers([]);
        setMemberSearch("");
        setMemberResults([]);
        setShowGroupForm(false);

      } catch (error) {

        alert(
          error.response?.data?.message ||
          "Unable to create group"
        );

      } finally {

        setCreating(false);

      }

    };


  return (

    <div
      className="
        flex
        min-h-0
        flex-1
        flex-col
        bg-white
      "
    >

      {/* =================================================
          SIDEBAR TOP
      ================================================= */}

      <div
        className="
          border-b
          border-gray-100
          p-3
          sm:p-4
        "
      >

        <div
          className="
            mb-3
            flex
            items-center
            justify-between
          "
        >

          <h2 className="font-semibold text-gray-800">
            Chats
          </h2>


          <button
            type="button"
            onClick={() =>
              setShowGroupForm(
                (value) => !value
              )
            }
            className="
              cursor-pointer
              rounded-md
              bg-green-50
              px-3
              py-1.5
              text-xs
              font-semibold
              text-green-700
              transition
              hover:bg-green-100
            "
          >
            {showGroupForm
              ? "Close"
              : "+ Group"}
          </button>

        </div>


        {/* User search */}

        <UserSearch
          onConversationCreated={
            onConversationCreated
          }
        />


        {/* =================================================
            GROUP CREATE FORM
        ================================================= */}

        {showGroupForm && (

          <div
            className="
              mt-3
              rounded-xl
              border
              border-gray-200
              bg-gray-50
              p-3
              shadow-sm
            "
          >

            <p
              className="
                mb-2
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-gray-400
              "
            >
              Create Group
            </p>


            {/* Group name */}

            <input
              value={groupName}
              onChange={(event) =>
                setGroupName(
                  event.target.value
                )
              }
              placeholder="Group name"
              className="
                mb-2
                w-full
                rounded-lg
                border
                border-gray-300
                bg-white
                px-3
                py-2
                text-sm
                outline-none
                focus:border-green-600
                focus:ring-1
                focus:ring-green-600
              "
            />


            {/* Member search */}

            <input
              value={memberSearch}
              onChange={(event) =>
                searchMembers(
                  event.target.value
                )
              }
              placeholder="Search members..."
              className="
                w-full
                rounded-lg
                border
                border-gray-300
                bg-white
                px-3
                py-2
                text-sm
                outline-none
                focus:border-green-600
                focus:ring-1
                focus:ring-green-600
              "
            />


            {/* Search results */}

            {memberResults.length > 0 && (

              <div
                className="
                  mt-2
                  max-h-36
                  overflow-y-auto
                  rounded-lg
                  border
                  border-gray-100
                  bg-white
                "
              >

                {memberResults.map(
                  (user) => {

                    const selected =
                      selectedMembers.some(
                        (member) =>
                          member.id ===
                          user.id
                      );


                    return (

                      <button
                        type="button"
                        key={user.id}
                        onClick={() =>
                          toggleMember(
                            user
                          )
                        }
                        className={`
                          flex
                          w-full
                          cursor-pointer
                          items-center
                          justify-between
                          gap-2
                          p-2
                          text-left
                          text-sm
                          transition
                          hover:bg-green-50
                          ${
                            selected
                              ? "bg-green-50"
                              : ""
                          }
                        `}
                      >

                        <div className="flex items-center gap-2">

                          <div
                            className="
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              rounded-full
                              bg-green-100
                              text-xs
                              font-semibold
                              text-green-700
                            "
                          >
                            {user.name
                              ?.charAt(0)
                              ?.toUpperCase() ||
                              "U"}
                          </div>


                          <span>
                            {user.name}
                          </span>

                        </div>


                        <span
                          className={`
                            rounded-full
                            px-2
                            py-0.5
                            text-xs
                            ${
                              selected
                                ? "bg-green-600 text-white"
                                : "bg-gray-100 text-gray-500"
                            }
                          `}
                        >
                          {selected
                            ? "✓"
                            : "+"}
                        </span>

                      </button>

                    );

                  }
                )}

              </div>

            )}


            {/* Selected members */}

            {selectedMembers.length >
              0 && (

              <div className="mt-2">

                <p className="mb-1 text-[11px] text-gray-400">
                  Selected members
                </p>


                <div className="flex flex-wrap gap-1">

                  {selectedMembers.map(
                    (member) => (

                      <span
                        key={member.id}
                        className="
                          rounded-full
                          bg-green-100
                          px-2
                          py-1
                          text-[10px]
                          font-medium
                          text-green-700
                        "
                      >
                        {member.name}
                      </span>

                    )
                  )}

                </div>

              </div>

            )}


            {/* Create button */}

            <button
              type="button"
              onClick={submitGroup}
              disabled={
                !groupName.trim() ||
                creating
              }
              className="
                mt-3
                w-full
                cursor-pointer
                rounded-lg
                bg-green-700
                px-3
                py-2
                text-sm
                font-medium
                text-white
                transition
                hover:bg-green-800
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {creating
                ? "Creating..."
                : "Create Group"}
            </button>

          </div>

        )}

      </div>


      {/* =================================================
          CONVERSATIONS
      ================================================= */}

      <div
        className="
          min-h-0
          flex-1
          overflow-y-auto
          p-2
        "
      >

        <h3
          className="
            px-2
            py-3
            text-xs
            font-semibold
            uppercase
            tracking-wide
            text-gray-400
          "
        >
          Conversations
        </h3>


        {conversations.length === 0 ? (

          <p
            className="
              px-3
              py-4
              text-sm
              text-gray-500
            "
          >
            No conversations yet.
          </p>

        ) : (

          conversations.map(
            (conversation) => {

              const isGroup =
                conversation.type ===
                "group";


              const name =
                conversation.user?.name ||
                conversation.name ||
                "Conversation";


              const userId =
                conversation.user?.id;


              const online =
                !isGroup &&
                userId &&
                onlineUsers.has(
                  Number(userId)
                );


              const lastSeen =
                !isGroup &&
                (
                  lastSeenByUser[userId] ||
                  conversation.user?.last_seen
                );


              const lastMessageTime =
                conversation.last_message_at ||
                conversation.last_activity_at;


              return (

                <button
                  type="button"
                  key={conversation.id}
                  onClick={() =>
                    onSelectConversation(
                      conversation
                    )
                  }
                  className="
                    mb-1
                    flex
                    w-full
                    cursor-pointer
                    items-center
                    gap-3
                    rounded-xl
                    p-3
                    text-left
                    transition
                    hover:bg-green-50
                    focus:outline-none
                    focus:ring-2
                    focus:ring-green-600
                  "
                >

                  {/* Avatar */}

                  <div className="relative">

                    <div
                      className="
                        flex
                        h-11
                        w-11
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        bg-green-100
                        font-semibold
                        text-green-800
                      "
                    >
                      {name
                        .charAt(0)
                        .toUpperCase()}
                    </div>


                    {online && (

                      <span
                        className="
                          absolute
                          bottom-0
                          right-0
                          h-3
                          w-3
                          rounded-full
                          border-2
                          border-white
                          bg-green-500
                        "
                      />

                    )}

                  </div>


                  {/* Conversation content */}

                  <div className="min-w-0 flex-1">

                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-2
                      "
                    >

                      <div className="flex min-w-0 items-center gap-2">

                        <p
                          className="
                            truncate
                            text-sm
                            font-semibold
                            text-gray-800
                          "
                        >
                          {name}
                        </p>


                        {isGroup && (

                          <span
                            className="
                              shrink-0
                              rounded-full
                              bg-gray-100
                              px-1.5
                              py-0.5
                              text-[8px]
                              font-semibold
                              uppercase
                              tracking-wide
                              text-gray-500
                            "
                          >
                            Group
                          </span>

                        )}

                      </div>


                      {/* Chat date/time */}

                      {lastMessageTime && (

                        <span
                          className="
                            shrink-0
                            text-[10px]
                            text-gray-400
                          "
                        >
                          {formatChatTime(
                            lastMessageTime
                          )}
                        </span>

                      )}

                    </div>


                    <div
                      className="
                        mt-1
                        flex
                        items-center
                        justify-between
                        gap-2
                      "
                    >

                      <p
                        className="
                          min-w-0
                          truncate
                          text-xs
                          text-gray-500
                        "
                      >

                        {conversation.last_message
                          ? conversation.last_message
                          : isGroup
                            ? "Group chat"
                            : online
                              ? "Online"
                              : formatLastSeen(
                                  lastSeen
                                ) ||
                                "Start a conversation"}

                      </p>


                      {/* Unread count */}

                      {conversation.unread_count >
                        0 && (

                        <span
                          className="
                            min-w-5
                            shrink-0
                            rounded-full
                            bg-green-600
                            px-1.5
                            py-0.5
                            text-center
                            text-[10px]
                            font-bold
                            text-white
                          "
                        >
                          {conversation.unread_count >
                          99
                            ? "99+"
                            : conversation.unread_count}
                        </span>

                      )}

                    </div>

                  </div>

                </button>

              );

            }
          )

        )}

      </div>

    </div>

  );

}


export default Sidebar;