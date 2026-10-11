import { useEffect, useState } from "react";

import { searchUsers } from "../services/userService";
import {
    createDirectConversation
} from "../services/conversationService";


function UserSearch({
    onConversationCreated
}) {

    const [search, setSearch] =
        useState("");

    const [users, setUsers] =
        useState([]);

    const [loading, setLoading] =
        useState(false);


    useEffect(() => {

        const timer = setTimeout(
            async () => {

                if (!search.trim()) {

                    setUsers([]);

                    return;
                }


                try {

                    setLoading(true);

                    const data =
                        await searchUsers(search);

                    setUsers(data.users || []);

                } catch (error) {

                    console.error(
                        "Search error:",
                        error
                    );

                } finally {

                    setLoading(false);

                }

            },
            400
        );


        return () => clearTimeout(timer);

    }, [search]);


    const startChat = async (user) => {

        try {

            const data =
                await createDirectConversation(
                    user.id
                );


            onConversationCreated(
                data.conversation,
                user
            );


        } catch (error) {

            console.error(
                "Create conversation error:",
                error
            );

        }
    };


    return (

        <div className="p-4">

            <input
                value={search}
                onChange={(e) =>
                    setSearch(e.target.value)
                }
                placeholder="Search users..."
                className="w-full border rounded-lg p-3"
            />


            {loading && (
                <p className="text-gray-500 mt-2">
                    Searching...
                </p>
            )}


            <div className="mt-3">

                {users.map((user) => (

                    <button
                        key={user.id}
                        onClick={() =>
                            startChat(user)
                        }
                        className="w-full text-left p-3 hover:bg-gray-100 rounded-lg"
                    >

                        <p className="font-semibold">
                            {user.name}
                        </p>

                        <p className="text-sm text-gray-500">
                            {user.email}
                        </p>

                    </button>

                ))}

            </div>

        </div>

    );
}


export default UserSearch;