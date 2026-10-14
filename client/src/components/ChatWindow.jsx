import { useEffect, useMemo, useState } from "react";
import { getMessages } from "../services/messageService";
import { getSocket } from "../services/socket";
import {
  getGroupDetails,
  updateGroup,
  deleteGroup,
  removeGroupMember,
  updateGroupMemberRole,
  transferGroupOwner,
} from "../services/groupService";
import { formatLastSeen } from "../utils/formatLastSeen";
import MessageInput from "./MessageInput";


// =====================================================
// DATE HELPERS
// =====================================================

const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};


const getDateLabel = (dateValue) => {

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();

  if (isSameDay(date, today)) {
    return "Today";
  }


  const yesterday = new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }


  return date.toLocaleDateString(
    [],
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
};


const getMessageTime = (dateValue) => {

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};


// =====================================================
// EMOJIS
// =====================================================

const REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "👏",
  "🔥",
  "🎉",
  "🙏",
];


// =====================================================
// CHAT WINDOW
// =====================================================

function ChatWindow({
  conversation,
  currentUser,
  onBack,
  onlineUsers = new Set(),
  lastSeenByUser = {},
}) {

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [typingUserIds, setTypingUserIds] =
    useState(new Set());

  const [group, setGroup] =
    useState(null);

  const [showGroupInfo, setShowGroupInfo] =
    useState(false);

  // Which message currently has emoji picker open
  const [reactionMessageId, setReactionMessageId] =
    useState(null);


  const isGroup =
    conversation?.type === "group";


  const otherUserId =
    !isGroup
      ? Number(
          conversation?.user?.id ||
          conversation?.other_user_id
        )
      : null;


  const isOnline =
    otherUserId
      ? onlineUsers.has(otherUserId)
      : false;


  const lastSeen =
    otherUserId
      ? (
          lastSeenByUser[otherUserId] ||
          conversation?.user?.last_seen
        )
      : null;


  // =====================================================
  // LOAD GROUP
  // =====================================================

  const loadGroup = async () => {

    if (!isGroup) {
      return;
    }

    try {

      const data =
        await getGroupDetails(
          conversation.id
        );

      setGroup(data);

    } catch (e) {

      setError(
        e.response?.data?.message ||
        "Unable to load group info"
      );

    }
  };


  // =====================================================
  // LOAD MESSAGES
  // =====================================================

  useEffect(() => {

    if (!conversation?.id) {

      setMessages([]);

      return;
    }


    let cancelled = false;

    setGroup(null);
    setShowGroupInfo(false);
    setReactionMessageId(null);


    async function loadMessages() {

      setLoading(true);
      setError("");


      try {

        const data =
          await getMessages(
            conversation.id
          );


        if (!cancelled) {

          setMessages(
            data.data || []
          );

        }

      } catch (err) {

        if (!cancelled) {

          setError(
            err.response?.data?.message ||
            "Unable to load messages."
          );

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }


    loadMessages();


    if (isGroup) {

      loadGroup();

    }


    return () => {

      cancelled = true;

    };

  }, [conversation?.id]);


  // =====================================================
  // SOCKET EVENTS
  // =====================================================

  useEffect(() => {

    if (!conversation?.id) {
      return;
    }


    const socket =
      getSocket();


    if (!socket) {
      return;
    }


    const conversationId =
      Number(conversation.id);


    // ---------------------------------------------------
    // JOIN ROOM
    // ---------------------------------------------------

    const joinRoom = () => {

      socket.emit(
        "join_conversation",
        {
          conversationId,
        },
        (response) => {

          if (!response?.success) {

            setError(
              response?.message ||
              "Unable to join chat."
            );

          }

        }
      );

    };


    // ---------------------------------------------------
    // NEW MESSAGE
    // ---------------------------------------------------

    const handleNew = (message) => {

      if (
        Number(message.conversation_id) !==
        conversationId
      ) {

        return;

      }


      setMessages((previous) => {

        const exists =
          previous.some(
            (m) =>
              String(m.id) ===
              String(message.id)
          );


        if (exists) {

          return previous;

        }


        return [
          ...previous,
          message,
        ];

      });


      if (
        Number(message.sender_id) !==
        Number(currentUser.id)
      ) {

        socket.emit(
          "mark_read",
          {
            conversationId,
            messageId: message.id,
          }
        );

      }

    };


    // ---------------------------------------------------
    // EDITED MESSAGE
    // ---------------------------------------------------

    const handleEdited =
      (message) => {

        setMessages((previous) =>
          previous.map((m) =>
            String(m.id) ===
            String(message.id)
              ? {
                  ...m,
                  ...message,
                }
              : m
          )
        );

      };


    // ---------------------------------------------------
    // DELETED MESSAGE
    // ---------------------------------------------------

    const handleDeleted =
      (message) => {

        setMessages((previous) =>
          previous.map((m) =>
            String(m.id) ===
            String(message.id)
              ? {
                  ...m,
                  ...message,
                }
              : m
          )
        );

      };


    // ---------------------------------------------------
    // REACTION
    // ---------------------------------------------------

    const handleReaction =
      ({
        messageId,
        reactions,
      }) => {

        setMessages((previous) =>
          previous.map((m) =>
            String(m.id) ===
            String(messageId)
              ? {
                  ...m,
                  reactions,
                }
              : m
          )
        );

      };


    // ---------------------------------------------------
    // TYPING START
    // ---------------------------------------------------

    const handleTypingStart =
      ({
        conversationId: id,
        userId,
      }) => {

        if (
          Number(id) !==
            conversationId ||
          Number(userId) ===
            Number(currentUser.id)
        ) {

          return;

        }


        setTypingUserIds(
          (previous) => {

            const next =
              new Set(previous);

            next.add(
              Number(userId)
            );

            return next;

          }
        );

      };


    // ---------------------------------------------------
    // TYPING STOP
    // ---------------------------------------------------

    const handleTypingStop =
      ({
        conversationId: id,
        userId,
      }) => {

        if (
          Number(id) !==
          conversationId
        ) {

          return;

        }


        setTypingUserIds(
          (previous) => {

            const next =
              new Set(previous);

            next.delete(
              Number(userId)
            );

            return next;

          }
        );

      };


    // ---------------------------------------------------
    // READ RECEIPT
    // ---------------------------------------------------

    const handleRead =
      ({
        userId,
        last_read_message_id,
      }) => {

        if (
          Number(userId) ===
          Number(currentUser.id)
        ) {

          return;

        }


        setMessages(
          (previous) =>
            previous.map((m) =>
              Number(m.id) <=
                Number(
                  last_read_message_id
                ) &&
              Number(m.sender_id) ===
                Number(currentUser.id)
                ? {
                    ...m,
                    readByOther: true,
                  }
                : m
            )
        );

      };


    // ---------------------------------------------------
    // REGISTER EVENTS
    // ---------------------------------------------------

    if (socket.connected) {

      joinRoom();

    }


    socket.on(
      "connect",
      joinRoom
    );

    socket.on(
      "new_message",
      handleNew
    );

    socket.on(
      "message_edited",
      handleEdited
    );

    socket.on(
      "message_deleted",
      handleDeleted
    );

    socket.on(
      "message_reaction",
      handleReaction
    );

    socket.on(
      "typing_start",
      handleTypingStart
    );

    socket.on(
      "typing_stop",
      handleTypingStop
    );

    socket.on(
      "message_read",
      handleRead
    );


    // ---------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------

    return () => {

      socket.off(
        "connect",
        joinRoom
      );

      socket.off(
        "new_message",
        handleNew
      );

      socket.off(
        "message_edited",
        handleEdited
      );

      socket.off(
        "message_deleted",
        handleDeleted
      );

      socket.off(
        "message_reaction",
        handleReaction
      );

      socket.off(
        "typing_start",
        handleTypingStart
      );

      socket.off(
        "typing_stop",
        handleTypingStop
      );

      socket.off(
        "message_read",
        handleRead
      );

    };

  }, [
    conversation?.id,
    currentUser?.id,
  ]);


  // =====================================================
  // TYPING USERS
  // =====================================================

  const typingNames =
    useMemo(
      () =>
        group?.members
          ?.filter((member) =>
            typingUserIds.has(
              Number(member.id)
            )
          )
          .map(
            (member) =>
              member.name
          ) || [],
      [
        group?.members,
        typingUserIds,
      ]
    );


  // =====================================================
  // EDIT MESSAGE
  // =====================================================

  const editMessage =
    (message) => {

      const value =
        window.prompt(
          "Edit message",
          message.content
        );


      if (!value?.trim()) {
        return;
      }


      getSocket()?.emit(
        "edit_message",
        {
          messageId: message.id,
          content: value.trim(),
        },
        (response) => {

          if (!response?.success) {

            alert(
              response?.message ||
              "Unable to edit message"
            );

          }

        }
      );

    };


  // =====================================================
  // DELETE MESSAGE
  // =====================================================

  const deleteMessage =
    (message) => {

      if (
        !window.confirm(
          "Delete this message for everyone?"
        )
      ) {

        return;

      }


      getSocket()?.emit(
        "delete_message",
        {
          messageId: message.id,
        },
        (response) => {

          if (!response?.success) {

            alert(
              response?.message ||
              "Unable to delete message"
            );

          }

        }
      );

    };


  // =====================================================
  // REACTION
  // =====================================================

  const addReaction =
    (message, emoji) => {

      getSocket()?.emit(
        "react_message",
        {
          messageId: message.id,
          emoji,
        }
      );


      // Close inline emoji selector
      setReactionMessageId(null);

    };


  // =====================================================
  // GROUP
  // =====================================================

  const refreshGroup =
    async () => {

      await loadGroup();

    };


  const manageGroup =
    async (
      action,
      member
    ) => {

      try {

        if (
          action === "remove"
        ) {

          await removeGroupMember(
            conversation.id,
            member.id
          );

        }


        if (
          action === "admin"
        ) {

          await updateGroupMemberRole(
            conversation.id,
            member.id,
            member.role === "admin"
              ? "member"
              : "admin"
          );

        }


        if (
          action === "owner"
        ) {

          await transferGroupOwner(
            conversation.id,
            member.id
          );

        }


        await refreshGroup();

      } catch (e) {

        alert(
          e.response?.data?.message ||
          "Group action failed"
        );

      }

    };


  const renameGroup =
    async () => {

      const name =
        window.prompt(
          "New group name",
          group?.group?.name ||
            conversation.name
        );


      if (!name?.trim()) {
        return;
      }


      try {

        await updateGroup(
          conversation.id,
          {
            name: name.trim(),
          }
        );


        await refreshGroup();

      } catch (e) {

        alert(
          e.response?.data?.message ||
          "Unable to update group"
        );

      }

    };


  const removeGroup =
    async () => {

      if (
        !window.confirm(
          "Delete this group permanently?"
        )
      ) {

        return;

      }


      try {

        await deleteGroup(
          conversation.id
        );

        window.location.reload();

      } catch (e) {

        alert(
          e.response?.data?.message ||
          "Unable to delete group"
        );

      }

    };


  // =====================================================
  // NO CONVERSATION
  // =====================================================

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
    conversation.name ||
    "Conversation";


  const myRole =
    group?.myRole ||
    conversation.my_role ||
    "member";


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-50">


      {/* =================================================
          CHAT HEADER
      ================================================= */}

      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 sm:px-5">

        <button
          onClick={onBack}
          className="cursor-pointer rounded-md px-2 py-1 text-lg text-green-700 hover:bg-green-50 md:hidden"
        >
          ←
        </button>


        {/* Avatar */}

        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-800">

          {conversationName
            .charAt(0)
            .toUpperCase()}


          {!isGroup &&
            isOnline && (

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


        {/* Name + status */}

        <div className="min-w-0 flex-1">

          <h2 className="truncate text-sm font-semibold text-gray-800">

            {conversationName}

          </h2>


          <p className="text-xs text-gray-500">

            {isGroup
              ? `${group?.members?.length || ""} members`
              : isOnline
                ? "Online"
                : formatLastSeen(lastSeen) ||
                  "Offline"}

          </p>

        </div>


        {/* Group info */}

        {isGroup && (

          <button
            onClick={() => {

              setShowGroupInfo(
                (value) => !value
              );

              if (!group) {
                loadGroup();
              }

            }}
            className="
              cursor-pointer
              rounded-md
              border
              border-gray-200
              bg-white
              px-3
              py-2
              text-xs
              font-medium
              hover:bg-gray-50
            "
          >
            {showGroupInfo
              ? "Close"
              : "Group info"}
          </button>

        )}

      </header>


      {/* =================================================
          GROUP INFORMATION
      ================================================= */}

      {isGroup &&
        showGroupInfo &&
        group && (

          <div
            className="
              max-h-80
              overflow-y-auto
              border-b
              border-gray-200
              bg-white
              p-3
              sm:p-4
            "
          >

            {/* Group heading */}

            <div
              className="
                mb-4
                flex
                items-center
                justify-between
                rounded-xl
                bg-green-50
                p-3
              "
            >

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-green-600
                    font-semibold
                    text-white
                  "
                >
                  {group.group.name
                    ?.charAt(0)
                    ?.toUpperCase() || "G"}
                </div>


                <div>

                  <p className="font-semibold text-gray-800">
                    {group.group.name}
                  </p>

                  <p className="text-xs text-gray-500">
                    {group.members.length} members
                    {" • "}
                    You are {myRole}
                  </p>

                </div>

              </div>


              <div className="flex gap-2">

                {(myRole === "owner" ||
                  myRole === "admin") && (

                  <button
                    onClick={renameGroup}
                    className="
                      cursor-pointer
                      rounded-lg
                      border
                      border-gray-300
                      bg-white
                      px-3
                      py-2
                      text-xs
                      font-medium
                      hover:bg-gray-50
                    "
                  >
                    Rename
                  </button>

                )}


                {myRole === "owner" && (

                  <button
                    onClick={removeGroup}
                    className="
                      cursor-pointer
                      rounded-lg
                      border
                      border-red-200
                      bg-red-50
                      px-3
                      py-2
                      text-xs
                      font-medium
                      text-red-600
                      hover:bg-red-100
                    "
                  >
                    Delete
                  </button>

                )}

              </div>

            </div>


            {/* Members heading */}

            <div className="mb-2 flex items-center justify-between">

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Group Members
              </p>

              <p className="text-xs text-gray-400">
                {group.members.length} members
              </p>

            </div>


            {/* Members */}

            <div className="space-y-2">

              {group.members.map(
                (member) => {

                  const memberOnline =
                    onlineUsers.has(
                      Number(member.id)
                    );


                  const isMe =
                    Number(member.id) ===
                    Number(currentUser.id);


                  return (

                    <div
                      key={member.id}
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3
                        rounded-xl
                        border
                        border-gray-100
                        bg-gray-50
                        p-3
                        transition
                        hover:border-green-200
                        hover:bg-green-50
                      "
                    >

                      {/* Member information */}

                      <div className="flex min-w-0 items-center gap-3">

                        {/* Avatar */}

                        <div className="relative">

                          <div
                            className="
                              flex
                              h-10
                              w-10
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              bg-green-100
                              font-semibold
                              text-green-800
                            "
                          >
                            {member.name
                              ?.charAt(0)
                              ?.toUpperCase() || "U"}
                          </div>


                          {memberOnline && (

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


                        {/* Name */}

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <p className="truncate text-sm font-semibold text-gray-800">

                              {member.name}

                              {isMe &&
                                " (You)"}

                            </p>


                            {/* Role */}

                            <span
                              className={`
                                rounded-full
                                px-2
                                py-0.5
                                text-[9px]
                                font-semibold
                                uppercase
                                tracking-wide
                                ${
                                  member.role ===
                                  "owner"
                                    ? "bg-purple-100 text-purple-700"
                                    : member.role ===
                                      "admin"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-200 text-gray-600"
                                }
                              `}
                            >
                              {member.role}
                            </span>

                          </div>


                          <p
                            className={`
                              mt-0.5
                              text-[11px]
                              ${
                                memberOnline
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                            `}
                          >
                            {memberOnline
                              ? "Online"
                              : "Offline"}
                          </p>

                        </div>

                      </div>


                      {/* Member actions */}

                      {!isMe &&
                        member.role !==
                          "owner" && (

                          <div
                            className="
                              flex
                              shrink-0
                              flex-wrap
                              justify-end
                              gap-1
                            "
                          >

                            {/* Admin / Demote */}

                            {myRole ===
                              "owner" && (

                              <button
                                onClick={() =>
                                  manageGroup(
                                    "admin",
                                    member
                                  )
                                }
                                className="
                                  cursor-pointer
                                  rounded-md
                                  border
                                  border-gray-300
                                  bg-white
                                  px-2
                                  py-1.5
                                  text-[10px]
                                  font-medium
                                  hover:bg-gray-100
                                "
                              >
                                {member.role ===
                                "admin"
                                  ? "Demote"
                                  : "Admin"}
                              </button>

                            )}


                            {/* Transfer owner */}

                            {myRole ===
                              "owner" && (

                              <button
                                onClick={() =>
                                  manageGroup(
                                    "owner",
                                    member
                                  )
                                }
                                className="
                                  cursor-pointer
                                  rounded-md
                                  border
                                  border-purple-200
                                  bg-purple-50
                                  px-2
                                  py-1.5
                                  text-[10px]
                                  font-medium
                                  text-purple-700
                                  hover:bg-purple-100
                                "
                              >
                                Make owner
                              </button>

                            )}


                            {/* Remove */}

                            {(myRole ===
                              "owner" ||
                              (myRole ===
                                "admin" &&
                                member.role ===
                                  "member")) && (

                              <button
                                onClick={() =>
                                  manageGroup(
                                    "remove",
                                    member
                                  )
                                }
                                className="
                                  cursor-pointer
                                  rounded-md
                                  border
                                  border-red-200
                                  bg-red-50
                                  px-2
                                  py-1.5
                                  text-[10px]
                                  font-medium
                                  text-red-600
                                  hover:bg-red-100
                                "
                              >
                                Remove
                              </button>

                            )}

                          </div>

                        )}

                    </div>

                  );

                }
              )}

            </div>

          </div>

        )}


      {/* =================================================
          MESSAGES
      ================================================= */}

      <div
        className="
          flex
          min-h-0
          flex-1
          flex-col
          gap-2
          overflow-y-auto
          p-3
          sm:p-5
        "
      >

        {loading && (

          <p className="text-center text-sm text-gray-500">
            Loading messages...
          </p>

        )}


        {error && (

          <p className="text-center text-sm text-red-600">
            {error}
          </p>

        )}


        {!loading &&
          messages.length === 0 &&
          !error && (

            <p className="m-auto text-center text-sm text-gray-400">
              No messages yet. Say hello!
            </p>

          )}


        {messages.map(
          (message, index) => {

            const isMine =
              Number(message.sender_id) ===
              Number(currentUser.id);


            const deleted =
              Boolean(message.deleted_at);


            const previousMessage =
              messages[index - 1];


            const currentDate =
              new Date(
                message.created_at
              );


            const previousDate =
              previousMessage
                ? new Date(
                    previousMessage.created_at
                  )
                : null;


            const shouldShowDate =
              !previousDate ||
              currentDate.toDateString() !==
                previousDate.toDateString();


            return (

              <div
                key={message.id}
              >

                {/* =================================================
                    WHATSAPP STYLE DATE SEPARATOR
                ================================================= */}

                {shouldShowDate && (

                  <div className="my-3 flex justify-center">

                    <span
                      className="
                        rounded-full
                        bg-gray-200
                        px-3
                        py-1
                        text-[10px]
                        font-medium
                        text-gray-600
                        shadow-sm
                      "
                    >
                      {getDateLabel(
                        message.created_at
                      )}
                    </span>

                  </div>

                )}


                {/* =================================================
                    MESSAGE
                ================================================= */}

                <div
                  className={`
                    group
                    mb-2
                    flex
                    ${
                      isMine
                        ? "justify-end"
                        : "justify-start"
                    }
                  `}
                >

                  <div
                    className={`
                      relative
                      max-w-[88%]
                      rounded-2xl
                      px-3
                      py-2
                      text-sm
                      sm:max-w-[70%]
                      ${
                        isMine
                          ? "rounded-br-sm bg-green-700 text-white"
                          : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                      }
                    `}
                  >

                    {/* Group sender */}

                    {isGroup &&
                      !isMine && (

                        <div className="mb-1 text-[10px] font-semibold text-green-700">

                          {message.sender_name ||
                            "Member"}

                        </div>

                      )}


                    {/* Message content */}

                    <div
                      className={
                        deleted
                          ? "italic opacity-70"
                          : ""
                      }
                    >

                      {deleted
                        ? "This message was deleted"
                        : message.content}

                    </div>


                    {/* Edited */}

                    {message.edited &&
                      !deleted && (

                        <span
                          className={`
                            mr-2
                            text-[9px]
                            ${
                              isMine
                                ? "text-green-100"
                                : "text-gray-400"
                            }
                          `}
                        >
                          edited
                        </span>

                      )}


                    {/* Time */}

                    <span
                      className={`
                        text-[9px]
                        ${
                          isMine
                            ? "text-green-100"
                            : "text-gray-400"
                        }
                      `}
                    >
                      {getMessageTime(
                        message.created_at
                      )}
                    </span>


                    {/* Read receipt */}

                    {isMine &&
                      !deleted && (

                        <span
                          className="
                            ml-1
                            text-[9px]
                          "
                        >
                          {message.readByOther
                            ? "✓✓"
                            : "✓"}
                        </span>

                      )}


                    {/* =================================================
                        EXISTING REACTIONS
                    ================================================= */}

                    {Array.isArray(
                      message.reactions
                    ) &&
                      message.reactions.length >
                        0 && (

                        <div
                          className="
                            mt-1
                            flex
                            flex-wrap
                            gap-1
                          "
                        >

                          {message.reactions.map(
                            (reaction, index) => (

                              <span
                                key={`${reaction.user_id}-${index}`}
                                className="
                                  rounded-full
                                  bg-black/10
                                  px-1.5
                                  py-0.5
                                  text-[10px]
                                "
                              >
                                {reaction.emoji}
                              </span>

                            )
                          )}

                        </div>

                      )}


                    {/* =================================================
                        MESSAGE ACTIONS
                    ================================================= */}

                    {!deleted && (

                      <div
                        className="
                          mt-1
                          flex
                          flex-wrap
                          items-center
                          gap-1
                          opacity-100
                        "
                      >

                        {/* Emoji button */}

                        <button
                          type="button"
                          onClick={() =>
                            setReactionMessageId(
                              (current) =>
                                String(current) ===
                                String(message.id)
                                  ? null
                                  : message.id
                            )
                          }
                          className="
                            cursor-pointer
                            rounded
                            bg-black/10
                            px-1.5
                            py-0.5
                            text-xs
                            transition
                            hover:bg-black/20
                          "
                          title="React"
                        >
                          😊
                        </button>


                        {/* Edit */}

                        {isMine && (

                          <button
                            type="button"
                            onClick={() =>
                              editMessage(
                                message
                              )
                            }
                            className="
                              cursor-pointer
                              rounded
                              bg-black/10
                              px-1.5
                              py-0.5
                              text-[10px]
                              transition
                              hover:bg-black/20
                            "
                          >
                            Edit
                          </button>

                        )}


                        {/* Delete */}

                        {isMine && (

                          <button
                            type="button"
                            onClick={() =>
                              deleteMessage(
                                message
                              )
                            }
                            className="
                              cursor-pointer
                              rounded
                              bg-black/10
                              px-1.5
                              py-0.5
                              text-[10px]
                              transition
                              hover:bg-black/20
                            "
                          >
                            Delete
                          </button>

                        )}

                      </div>

                    )}


                    {/* =================================================
                        INLINE EMOJI SELECTOR
                    ================================================= */}

                    {!deleted &&
                      String(
                        reactionMessageId
                      ) ===
                        String(message.id) && (

                        <div
                          className={`
                            mt-2
                            flex
                            flex-wrap
                            gap-1
                            rounded-xl
                            border
                            border-gray-200
                            bg-white
                            p-2
                            shadow-lg
                            ${
                              isMine
                                ? "text-gray-800"
                                : ""
                            }
                          `}
                        >

                          {REACTION_EMOJIS.map(
                            (emoji) => (

                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  addReaction(
                                    message,
                                    emoji
                                  )
                                }
                                className="
                                  cursor-pointer
                                  flex
                                  h-8
                                  w-8
                                  items-center
                                  justify-center
                                  rounded-lg
                                  text-lg
                                  transition
                                  hover:bg-gray-100
                                  hover:scale-110
                                "
                                title={`React ${emoji}`}
                              >
                                {emoji}
                              </button>

                            )
                          )}

                        </div>

                      )}

                  </div>

                </div>

              </div>

            );

          }
        )}


        {/* =================================================
            TYPING INDICATOR
        ================================================= */}

        {typingNames.length > 0 && (

          <div className="flex items-center gap-2 px-2">

            <div
              className="
                rounded-full
                bg-gray-200
                px-3
                py-1.5
                text-xs
                italic
                text-gray-500
              "
            >
              {typingNames.join(", ")}
              {" "}
              {typingNames.length === 1
                ? "is"
                : "are"}{" "}
              typing...
            </div>

          </div>

        )}

      </div>


      {/* =================================================
          MESSAGE INPUT
      ================================================= */}

      <MessageInput
        conversationId={
          conversation.id
        }
      />

    </div>

  );

}


export default ChatWindow;