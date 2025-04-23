# WebSocket API

This directory contains the WebSocket API for the AI Quiz application, which handles real-time communication between clients and the server using Socket.io.

## High-Level Overview

The WebSocket API is responsible for:

1. Setting up Socket.io server and event handlers
2. Processing incoming socket events from clients
3. Delegating game logic to the Game Management System
4. Broadcasting updates to connected clients
5. Managing socket connections and disconnections
6. Handling reconnection scenarios

The API serves as the communication layer between clients (players and hosts) and the game management system.

## Integration with Game Management System

The WebSocket API connects with the Game Management System (`server/src/game`) as follows:

- The WS API initializes the `GameSessionManager` singleton
- Socket event handlers call methods on this manager to process game actions
- The manager updates game state and returns results
- The WS API broadcasts these updates to relevant clients
- The `GameSessionManager` also uses the Socket.io server for its own broadcasts

## Detailed Architecture

### Socket Handler Setup (index.ts)

The main entry point that:

- Initializes the `GameSessionManager` singleton
- Sets up all Socket.io event handlers
- Organizes handlers by functionality (connection, game, quiz)
- Provides error handling for each event type

```typescript
// Setting up socket handlers
setupSocketHandlers(io);

// Inside setupSocketHandlers
io.on(EVENTS.CONNECT, (socket: Socket) => {
  // Various event handlers...
  socket.on(EVENTS.CREATE_GAME, (data) => handleCreateGame(socket, io, data));
  // etc.
});
```

### Connection Management (connection.ts)

Handles the Socket.io connection lifecycle:

- Initializes the game session manager singleton
- Provides access to this manager throughout the application
- Processes new socket connections
- Handles socket disconnections

### Game Flow Handlers

Split across multiple files by functionality:

#### Game Session Management (game.ts)

Handles game session lifecycle events:

- `handleCreateGame`: Creates a new game session
- `handleJoinGame`: Adds a player to an existing game
- `handleStartGame`: Begins a game session

#### Quiz Flow Management (quiz.ts)

Handles the quiz gameplay events:

- `handleNextQuestion`: Advances to the next question
- `handleSubmitAnswer`: Records a player's answer
- `handleRevealAnswer`: Shows correct answer and results
- `handleShowLeaderboard`: Displays current standings
- `handleEndGame`: Finalizes the game and shows results

## Event Flow

1. **Client Emits Event**: A client (player or host) emits an event (e.g., `JOIN_GAME`)
2. **Server Handler Processes**: The corresponding handler validates the request
3. **Delegate to Game Manager**: The handler calls the appropriate method on `GameSessionManager`
4. **Game State Updated**: The manager processes the request and updates game state
5. **Broadcast Updates**: Changes are broadcast to relevant clients
6. **Client Updates UI**: Clients receive the updates and refresh their UI

## Reconnection System

The API implements a robust reconnection system:

- Socket ID to player/game mapping is maintained
- Players can reconnect and resume with their score intact
- Host reconnection has special handling with grace periods
- The system can restore game state for reconnecting clients

```typescript
// Example: Player reconnection handler
socket.on('reconnect_player', async (data) => {
  // Find existing player, update socket ID, rejoin room
});

// Example: Host reconnection handler
socket.on('join_host_room', async (data) => {
  // Verify host credentials, restore host access
});
```

## Error Handling

Comprehensive error handling throughout:

- Each event handler is wrapped in try/catch
- Specific error messages are returned to clients
- Validation checks (game exists, user is authorized, etc.)
- Console logging for server-side debugging

## Socket.io Room Structure

The API uses Socket.io rooms for efficient message broadcasting:

- Each game session has its own room identified by the game code
- When a player or host joins a game, their socket joins the room
- Messages can be broadcast to everyone in the room
- Private messages can be sent to specific sockets

## Event Constants

Events are defined in shared constants (`shared/constants.ts`):

- Connection events (`CONNECT`, `DISCONNECT`)
- Game session events (`CREATE_GAME`, `JOIN_GAME`, etc.)
- Quiz events (`NEXT_QUESTION`, `SUBMIT_ANSWER`, etc.)
- State update events (`GAME_STATE_UPDATED`, etc.)

## Future Improvements

Potential enhancements to the WebSocket API:

1. Enhanced authentication and authorization
2. Rate limiting to prevent abuse
3. More granular error reporting
4. Improved logging and monitoring
5. WebSocket connection statistics
6. Support for different game modes
7. Spectator functionality