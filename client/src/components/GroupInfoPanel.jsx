import { useEffect, useState } from "react";
import {
    getGroupInfo,
    updateGroupName,
    updateGroupRole,
    removeGroupMember,
    transferGroupOwnership,
    deleteGroup,
} from "../services/conversationService";

function GroupInfoPanel({
    conversation,
    currentUser,
    onClose,
    onGroupDeleted,
    onConversationChanged,
}) {
    const [group, setGroup] = useState(null);
    const [error, setError] = useState("");
    const [name, setName] = useState("");
    const [savingName, setSavingName] = useState(false);

    const loadGroup = async () => {
        if (!conversation?.id) return;

        try {
            setError("");

            const data = await getGroupInfo(Number(conversation.id));

            setGroup(data.group);
            setName(data.group?.name || "");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load group information.",
            );
        }
    };

    useEffect(() => {
        if (conversation?.type === "group") {
            loadGroup();
        }
    }, [conversation?.id]);

    if (!conversation || conversation.type !== "group") {
        return null;
    }

    const role = group?.current_user_role;

    const canAdmin = role === "owner" || role === "admin";

    const canOwner = role === "owner";

    const saveName = async () => {
        if (!name.trim()) return;

        try {
            setSavingName(true);
            setError("");

            const response = await updateGroupName(
                conversation.id,
                name.trim(),
            );

            setGroup((previous) =>
                previous
                    ? {
                          ...previous,
                          name: response.group?.name || name.trim(),
                      }
                    : previous,
            );

            setName(response.group?.name || name.trim());

            onConversationChanged?.();
        } catch (err) {
            setError(
                err.response?.data?.message || "Unable to update group name.",
            );
        } finally {
            setSavingName(false);
        }
    };

    const changeRole = async (member, nextRole) => {
        const memberId = Number(member.user_id ?? member.id);

        try {
            setError("");

            await updateGroupRole(conversation.id, memberId, nextRole);

            await loadGroup();
            onConversationChanged?.();
        } catch (err) {
            setError(
                err.response?.data?.message || "Unable to update member role.",
            );
        }
    };

    const removeMember = async (member) => {
        const memberId = Number(member.user_id ?? member.id);

        if (!window.confirm(`Remove ${member.name} from this group?`)) {
            return;
        }

        try {
            setError("");

            await removeGroupMember(conversation.id, memberId);

            await loadGroup();
            onConversationChanged?.();
        } catch (err) {
            setError(err.response?.data?.message || "Unable to remove member.");
        }
    };

    const transferOwner = async (member) => {
        const memberId = Number(member.user_id ?? member.id);

        if (!window.confirm(`Transfer ownership to ${member.name}?`)) {
            return;
        }

        try {
            setError("");

            await transferGroupOwnership(conversation.id, memberId);

            await loadGroup();
            onConversationChanged?.();
        } catch (err) {
            setError(
                err.response?.data?.message || "Unable to transfer ownership.",
            );
        }
    };

    const deleteCurrentGroup = async () => {
        if (!window.confirm("Delete this group for everyone?")) {
            return;
        }

        try {
            setError("");

            await deleteGroup(conversation.id);

            onGroupDeleted?.(conversation.id);
        } catch (err) {
            setError(err.response?.data?.message || "Unable to delete group.");
        }
    };

    const members = Array.isArray(group?.members) ? group.members : [];

    return (
        <aside className="absolute right-0 top-0 z-30 flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-800">
                        Group Info
                    </h3>

                    <p className="text-xs text-gray-500">
                        {members.length}{" "}
                        {members.length === 1 ? "member" : "members"}
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="cursor-pointer rounded-md px-2 py-1 text-lg text-gray-500 hover:bg-gray-100"
                >
                    ×
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                        {error}
                    </div>
                )}

                <div className="mb-5 rounded-xl bg-gray-50 p-4">
                    <label className="mb-2 block text-xs font-medium text-gray-500">
                        Group name
                    </label>

                    <div className="flex gap-2">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!canAdmin || savingName}
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600 disabled:bg-gray-100"
                        />

                        {canAdmin && (
                            <button
                                onClick={saveName}
                                disabled={savingName || !name.trim()}
                                className="cursor-pointer rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {savingName ? "Saving..." : "Save"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase text-gray-500">
                        Members
                    </h4>

                    <span className="text-xs text-gray-500">
                        {members.length}
                    </span>
                </div>

                {members.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                        No members found.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.map((member) => {
                            const memberId = Number(
                                member.user_id ?? member.id,
                            );

                            const isCurrentUser =
                                memberId === Number(currentUser?.id);

                            const isOwner = member.role === "owner";

                            return (
                                <div
                                    key={memberId}
                                    className="rounded-xl border border-gray-200 p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-700">
                                            {(member.name || "U")
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-800">
                                                {member.name}
                                            </p>

                                            <p className="text-xs capitalize text-gray-500">
                                                {member.role}
                                            </p>
                                        </div>

                                        <span
                                            className={`h-2.5 w-2.5 rounded-full ${
                                                member.last_seen
                                                    ? "bg-gray-300"
                                                    : "bg-green-500"
                                            }`}
                                        />
                                    </div>

                                    {!isCurrentUser && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {canOwner && !isOwner && (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            changeRole(
                                                                member,
                                                                member.role ===
                                                                    "admin"
                                                                    ? "member"
                                                                    : "admin",
                                                            )
                                                        }
                                                        className="cursor-pointer rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
                                                    >
                                                        {member.role === "admin"
                                                            ? "Demote"
                                                            : "Make admin"}
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            transferOwner(
                                                                member,
                                                            )
                                                        }
                                                        className="cursor-pointer rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
                                                    >
                                                        Make owner
                                                    </button>
                                                </>
                                            )}

                                            {canAdmin && !isOwner && (
                                                <button
                                                    onClick={() =>
                                                        removeMember(member)
                                                    }
                                                    className="cursor-pointer rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {canOwner && (
                    <button
                        onClick={deleteCurrentGroup}
                        className="mt-5 w-full cursor-pointer rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                        Delete Group
                    </button>
                )}
            </div>
        </aside>
    );
}

export default GroupInfoPanel;
