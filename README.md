# Real-Time Chat Application

A full-stack real-time chat application built for the technical assignment.

## 1. Technology Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Axios
- Socket.IO Client

### Backend
- Node.js
- Express
- Socket.IO
- JWT
- bcrypt

### Database
- PostgreSQL
- node-postgres (`pg`)

## 2. Main Features

- User registration and login
- bcrypt password hashing
- JWT-protected REST APIs
- JWT authentication during Socket.IO handshake
- One-to-one conversations
- Group conversations
- Group roles: Owner, Admin, Member
- Group member search and management
- Real-time direct and group messaging
- Message persistence in PostgreSQL
- Cursor-based message pagination
- Offline messages available after reconnect/login
- Client-generated message IDs for duplicate protection
- Online/offline presence
- Last seen
- Multiple-tab presence handling
- Typing indicators with throttling
- Delivery status
- Read receipts
- Group seen-by count
- Real-time unread counts
- Edit own messages
- Delete own messages for everyone within 10 minutes
- Emoji reactions
- Responsive chat interface
- Reconnection and message synchronization
- Group owner transfer
- Group admin promotion/demotion
- Group deletion

## 3. Project Structure

```text
realtime_chat_app/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── database/
│   │   ├── schema.sql
│   │   ├── migrate.sql
│   │   ├── seed.js
│   │   └── seed.sql
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── sockets/
│   ├── .env.example
│   ├── fixDatabase.js
│   ├── index.js
│   └── package.json
│
├── .gitignore
└── README.md
```

## 4. Setup and Run Instructions

### Prerequisites

Install:

- Node.js 20 or later recommended
- npm
- PostgreSQL
- Git

### Step 1: Create PostgreSQL database

Create a PostgreSQL database named `chat_app`.

Example using PostgreSQL/pgAdmin:

```sql
CREATE DATABASE chat_app;
```

The application can create the required tables and missing feature columns/indexes automatically when the server starts.

For a fresh database, `server/database/schema.sql` can also be executed manually.

For an existing database, the startup database setup preserves existing users, conversations and messages while adding the required chat feature structures.

### Step 2: Configure backend environment

Create:

```text
server/.env
```

Use `server/.env.example` as the template:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_app
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET_KEY=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

Do not commit the real `.env` file.

### Step 3: Configure frontend environment

Create:

```text
client/.env
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Step 4: Install backend packages

```bash
cd server
npm install
```

### Step 5: Start backend

Development mode:

```bash
npm run dev
```

Production-style local start:

```bash
npm start
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Step 6: Install frontend packages

Open a second terminal:

```bash
cd client
npm install
```

### Step 7: Start frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

### Optional database repair

If an older database is missing any required chat feature table, column or index:

```bash
cd server
npm run db:fix
```

This command does not intentionally delete existing users, conversations or messages.

### Optional seed data

Seed data can be created with:

```bash
cd server
node database/seed.js
```

The seed script creates sample users, direct conversations, groups and messages for testing.

## 5. Authentication and Authorization

### REST authentication

1. User registers with name, email and password.
2. Password is hashed using bcrypt before storage.
3. Login verifies the password using bcrypt.
4. Login returns a signed JWT containing the authenticated user ID.
5. Protected REST requests send:

```http
Authorization: Bearer <JWT>
```

6. `authMiddleware.js` verifies the JWT using `JWT_SECRET_KEY`.
7. The verified user ID is stored in `req.user.id`.
8. Controllers use that server-side identity for authorization checks.

### Socket authentication

The frontend sends the JWT during the Socket.IO handshake:

```javascript
{
  auth: {
    token: "<JWT>"
  }
}
```

`socketAuth.js` verifies the token before the connection is accepted.

The verified JWT identity is stored on `socket.user`.

The client does not get to choose the sender ID. Every socket operation uses the authenticated `socket.user.id`.

### Conversation authorization

Before joining or sending to a conversation, the backend checks `conversation_members`.

This prevents a user from changing a conversation ID in browser developer tools and sending or receiving messages from a conversation they do not belong to.

### Group authorization

Group permissions are stored in `conversation_members.role`.

Roles:

| Role | Permissions |
|---|---|
| Owner | Delete group, transfer ownership, promote/demote admins, add/remove members, update group name |
| Admin | Add/remove members, update group name |
| Member | Send/read messages and view group information |

Every group management REST endpoint checks the authenticated user's role on the backend.

Socket message operations additionally verify that the authenticated user is still a member of the conversation.

If a member is removed, the next membership check prevents that user from joining or sending to the group.

## 6. Database Schema

### `users`

Stores application users.

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `name` | Display name |
| `email` | Unique login email |
| `password` | bcrypt password hash |
| `avatar_url` | Optional avatar |
| `last_seen` | Last offline timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Update timestamp |

### `conversations`

Stores direct and group conversations.

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `type` | `direct` or `group` |
| `name` | Group name; null for direct chats |
| `avatar_url` | Optional conversation avatar |
| `created_by` | User who created the conversation |
| `created_at` | Creation timestamp |
| `updated_at` | Last activity timestamp |

### `conversation_members`

Many-to-many relationship between users and conversations.

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `conversation_id` | FK to `conversations.id` |
| `user_id` | FK to `users.id` |
| `role` | `owner`, `admin`, or `member` |
| `joined_at` | Membership timestamp |

Unique constraint:

```text
(conversation_id, user_id)
```

This prevents duplicate membership rows.

### `messages`

Stores all chat messages.

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `conversation_id` | FK to conversation |
| `sender_id` | FK to user |
| `content` | Message text |
| `client_message_id` | Client-generated duplicate protection ID |
| `edited` | Whether content was edited |
| `deleted_at` | Soft-delete timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

### `message_deliveries`

Stores per-user delivery and read state for messages.

Relationship:

```text
messages 1 ──── many message_deliveries
users    1 ──── many message_deliveries
```

Unique constraint:

```text
(message_id, user_id)
```

### `conversation_reads`

Stores the latest message each user has read in a conversation.

Unique constraint:

```text
(conversation_id, user_id)
```

This supports unread counts and read receipts without storing one large read record for every page load.

### `message_reactions`

Stores emoji reactions.

Unique constraint:

```text
(message_id, user_id, emoji)
```

This prevents the same user from adding the same emoji reaction multiple times to one message.

## 7. Database Relations

```text
users
  │
  ├───────────────< conversation_members >────────────── conversations
  │                                                        │
  │                                                        ├──< messages
  │                                                        │      │
  │                                                        │      ├──< message_deliveries
  │                                                        │      └──< message_reactions
  │                                                        │
  └───────────────< conversation_reads >──────────────────┘
```

Main relationships:

- One user can belong to many conversations.
- One conversation can contain many users.
- One conversation contains many messages.
- One user can send many messages.
- One message can have many delivery/read records.
- One message can have many reactions.
- Group roles are stored per conversation membership.

Foreign keys use cascading behavior where appropriate so child records do not remain after their parent conversation/message is removed.

## 8. Database Indexes and Reasoning

### `idx_messages_client_message_id`

Unique partial index on `messages.client_message_id`.

Reason:

- Prevents duplicate client-generated messages.
- Supports Socket.IO retry/reconnect scenarios.

### `idx_conversation_members_user`

Index on `conversation_members.user_id`.

Reason:

- Quickly finds conversations for a user.
- Speeds membership and authorization checks.

### `idx_conversation_members_conversation`

Index on `conversation_members.conversation_id`.

Reason:

- Quickly finds all members of a conversation.
- Helps group membership and socket fan-out operations.

### `idx_messages_conversation_id_id`

Index on `(conversation_id, id DESC)`.

Reason:

- Supports recent-message retrieval.
- Supports cursor pagination using `message.id < before`.

### `idx_messages_sender_id`

Index on `messages.sender_id`.

Reason:

- Speeds sender-based queries and ownership checks.

### `idx_conversation_reads_user`

Index on `conversation_reads.user_id`.

Reason:

- Speeds user read-state lookups.

### `idx_message_deliveries_user`

Index on `message_deliveries.user_id`.

Reason:

- Speeds delivery/read status lookups for a user.

### `idx_message_reactions_message`

Index on `message_reactions.message_id`.

Reason:

- Speeds loading reactions for messages.

## 9. Socket.IO Events

The Socket.IO connection itself requires a valid JWT. After authentication, events are authorized using the authenticated socket user and database membership.

### Client -> Server events

| Event | Payload | Who can emit | Server validation |
|---|---|---|---|
| `join_conversation` | `{ conversationId }` | Authenticated user | Must be a conversation member |
| `send_message` | `{ conversationId, content, clientMessageId }` | Authenticated conversation member | Membership, content length and client ID validation |
| `typing_start` | `{ conversationId }` | Authenticated conversation member | Membership + server throttle |
| `typing_stop` | `{ conversationId }` | Authenticated conversation member | Membership check |
| `mark_read` | `{ conversationId }` | Authenticated conversation member | Membership check |
| `edit_message` | `{ messageId, content }` | Authenticated message owner | Message ownership + membership |
| `delete_message` | `{ messageId }` | Authenticated message owner | Message ownership + membership + 10-minute limit |
| `react_message` | `{ messageId, emoji }` | Authenticated conversation member | Message existence + membership |

### `join_conversation`

Request:

```json
{
  "conversationId": 12
}
```

Server response callback:

```json
{
  "success": true,
  "conversationId": 12,
  "role": "member"
}
```

The socket joins the server-side room only after membership is verified.

### `send_message`

Request:

```json
{
  "conversationId": 12,
  "content": "Hello",
  "clientMessageId": "550e8400-e29b-41d4-a716-446655440000"
}
```

The sender ID is taken from the verified JWT, not from the payload.

### `typing_start`

Request:

```json
{
  "conversationId": 12
}
```

The server broadcasts the authenticated user's ID and display name to other members.

### `typing_stop`

Request:

```json
{
  "conversationId": 12
}
```

### `mark_read`

Request:

```json
{
  "conversationId": 12
}
```

The server calculates the latest message sent by another user and stores that message as the user's latest read position.

### `edit_message`

Request:

```json
{
  "messageId": 101,
  "content": "Updated message"
}
```

Only the original sender can edit the message.

### `delete_message`

Request:

```json
{
  "messageId": 101
}
```

Only the original sender can delete it, and deletion is allowed within 10 minutes of creation.

### `react_message`

Request:

```json
{
  "messageId": 101,
  "emoji": "👍"
}
```

Sending the same reaction again toggles it off.

### Server -> Client events

| Event | Payload | Recipients |
|---|---|---|
| `presence_snapshot` | `{ onlineUserIds: [] }` | Newly connected authenticated socket |
| `presence_update` | `{ userId, online, lastSeen }` | Connected clients |
| `new_message` | Message object | All members of the conversation |
| `message_delivered` | `{ conversationId, userId }` | All members of the conversation |
| `message_read` | `{ conversationId, userId, lastReadMessageId, summary }` | All members of the conversation |
| `typing_start` | `{ conversationId, userId, name }` | Other members in the conversation room |
| `typing_stop` | `{ conversationId, userId }` | Other members in the conversation room |
| `message_edited` | Updated message object | All members of the conversation |
| `message_deleted` | Deleted message object | All members of the conversation |
| `message_reaction` | `{ messageId, conversationId, userId, emoji, action, reaction }` | All members of the conversation |

### `presence_snapshot`

Sent after a socket is authenticated and connected.

```json
{
  "onlineUserIds": [15, 16, 17]
}
```

### `presence_update`

```json
{
  "userId": 16,
  "online": true,
  "lastSeen": null
}
```

When the user's final open tab disconnects, the backend updates `last_seen` and broadcasts `online: false`.

### `new_message`

Contains the persisted message, sender name and reaction information.

```json
{
  "id": 101,
  "conversation_id": 12,
  "sender_id": 15,
  "sender_name": "Rajan",
  "content": "Hello",
  "client_message_id": "...",
  "edited": false,
  "deleted_at": null,
  "reactions": []
}
```

### `message_read`

```json
{
  "conversationId": 12,
  "userId": 16,
  "lastReadMessageId": 101,
  "summary": {
    "total_members": 2,
    "seen_members": 2
  }
}
```

For group conversations, the summary supports the UI's seen-by count.

## 10. REST API Summary

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
```

### Users

```text
GET /api/users/me
GET /api/users/search?search=<text>
```

### Conversations

```text
GET /api/conversations
POST /api/conversations/direct
```

### Groups

```text
POST   /api/groups
GET    /api/groups/:id
PATCH  /api/groups/:id/name
POST   /api/groups/:id/members
DELETE /api/groups/:id/members/:userId
PATCH  /api/groups/:id/members/:userId/role
POST   /api/groups/:id/transfer-owner
DELETE /api/groups/:id
```

### Messages

```text
GET /api/messages/:conversationId?limit=20&before=<messageId>
POST /api/messages
```

The real-time application primarily sends new messages through Socket.IO so that delivery to connected members is immediate. The REST message endpoint remains available for authenticated message creation and compatibility.

## 11. Message Pagination

Messages use cursor-based pagination.

Example:

```text
GET /api/messages/12?limit=20&before=150
```

The query loads messages with IDs lower than the cursor.

This is preferable to large page offsets because message IDs provide a stable cursor and performance remains predictable as the conversation grows.

## 12. Presence Design

Presence is maintained using an in-memory map:

```text
userId -> Set(socketId)
```

This supports multiple browser tabs.

A user is considered online while at least one socket is connected. The user becomes offline only after the final socket disconnects.

`last_seen` is written to PostgreSQL when the final socket disconnects.

## 13. Reconnection Design

Socket.IO automatically attempts reconnection.

When the connection is restored:

1. The frontend reconnects the socket.
2. The active conversation is joined again.
3. Messages are fetched again from the API.
4. The UI receives the current persisted state from PostgreSQL.

This allows messages sent while the client was disconnected to become visible after synchronization.

## 14. Security Decisions

- Passwords are never stored as plaintext.
- bcrypt is used for password hashing.
- JWT is required for protected REST APIs.
- JWT is required for Socket.IO handshake authentication.
- Sender ID is derived from the verified socket identity.
- Conversation membership is checked on the backend.
- Group permissions are checked on the backend.
- Client-supplied conversation IDs cannot bypass membership authorization.
- SQL queries use parameterized values.
- Message content has a server-side maximum length.
- Message edit/delete permissions are checked server-side.
- Group member removal is enforced in the database-backed membership check.

## 15. Known Limitations and Trade-offs

### Refresh token rotation

The current implementation uses a JWT access token with a longer expiration rather than a separate short-lived access token plus rotating refresh token stored in an HTTP-only cookie.

Trade-off: this keeps the assignment implementation smaller, but production authentication would benefit from short-lived access tokens, refresh-token rotation, revocation and secure cookie handling.

### In-memory presence

Presence is stored in a process-local `Map`.

Trade-off: this works for a single backend instance and multiple tabs, but multiple server instances would require shared state such as Redis and a Socket.IO adapter.

### Direct conversation uniqueness

The application checks for an existing direct conversation before creating one.

Trade-off: this is sufficient for the assignment's normal flow, but a high-concurrency production system could enforce a stronger database-level uniqueness strategy for the two-user pair.

### File uploads

Image/file sharing is not included in the current implementation.

Trade-off: this avoids adding storage infrastructure and file validation complexity while keeping the core chat assignment focused on messaging and authorization.

### Deployment infrastructure

The repository contains local PostgreSQL configuration and environment examples. A hosted production deployment requires a managed PostgreSQL database and deployed frontend/backend environment variables.

## 16. Suggested Test Accounts

If seed data is used, check `server/database/seed.js` for the generated test users and password.

For a clean evaluation, creating two accounts through the registration screen is also supported.

## 17. Submission Checklist

Before submitting:

- [ ] Push the complete project to GitHub.
- [ ] Confirm `.env` files are not committed.
- [ ] Confirm `node_modules` is not committed.
- [ ] Add the final GitHub repository URL to the email.
- [ ] Deploy the backend and PostgreSQL database.
- [ ] Deploy the frontend.
- [ ] Update production frontend API/socket environment variables.
- [ ] Test registration and login on the deployed URL.
- [ ] Test direct messaging using two accounts.
- [ ] Test group creation and group messaging.
- [ ] Test owner/admin/member permissions.
- [ ] Test typing and presence.
- [ ] Test read/delivery status.
- [ ] Test message edit/delete/reaction.
- [ ] Test reconnecting after temporarily stopping the backend or disabling the network.
- [ ] Add the live demo URL to the submission email.

## 18. Submission Email Template

Subject: Real-Time Chat Application – Technical Assignment Submission

Hello,

Please find the requested submission details below.

1. GitHub Repository:
   <GITHUB_REPOSITORY_URL>

2. Live Demo:
   <LIVE_DEMO_URL>

3. README:
   The repository README includes setup and run instructions, database schema and indexing decisions, socket events and payloads, socket authorization, and known limitations/trade-offs.

Thank you for the opportunity.

Regards,
Rajan Kumar Singh
