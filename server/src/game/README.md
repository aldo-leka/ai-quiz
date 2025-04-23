# Game Management System

This directory contains the game management components of the AI Quiz application, which handle real-time multiplayer quiz sessions. The system uses a modular architecture with specialized managers to handle different aspects of game flow.

## High-Level Overview

The game management system is responsible for:

1. Creating and managing quiz game sessions
2. Handling player connections and disconnections
3. Managing the flow of questions, answers, and scoring
4. Maintaining game state and broadcasting updates
5. Supporting player reconnection and session persistence

The system follows a manager pattern where a main `GameSessionManager` class delegates to specialized managers for different concerns. This separation of responsibilities makes the code more maintainable and easier to extend.

## Integration with WebSocket API

The game management system connects with the WebSocket API (`server/src/api/ws`) as follows:

- The WebSocket API initializes the `GameSessionManager` when the server starts
- Socket.io event handlers in the WS API call methods on the `GameSessionManager`
- The `GameSessionManager` processes these requests and broadcasts updates
- All real-time communication with clients happens through the Socket.io server provided to the `GameSessionManager`

## Detailed Architecture

### GameSessionManager (GameSessionManager.ts)

This is the main entry point and facade for the entire game management system. It:

- Delegates to specialized managers for different responsibilities
- Exposes a simplified API for the WebSocket handlers to use
- Maintains backward compatibility with existing code
- Organizes methods by functionality (session, player, game state, etc.)

```typescript
// Example: Creating a new game session
const gameSessionManager = new GameSessionManager(io);
const gameSession = gameSessionManager.createGameSession(
  hostId, hostName, hostAvatar, quizId, hostUserId
);
```

### Manager Classes

The system is divided into several specialized manager classes:

#### SessionManager (managers/SessionManager.ts)

Responsible for creating, retrieving, and persisting game sessions:

- Generates unique game codes
- Maintains in-memory cache of active sessions
- Maps socket IDs to players
- Handles database persistence
- Initializes and coordinates other managers

#### PlayerManager (managers/PlayerManager.ts)

Handles player-related operations:

- Adding players to games
- Processing player disconnections
- Handling player reconnections
- Managing host reconnection with grace periods

#### GameStateManager (managers/GameStateManager.ts)

Controls the flow of the game:

- Starting and ending games
- Transitioning between game states (lobby, question, answer, leaderboard)
- Coordinating with other managers during state changes
- Finalizing game results

#### QuestionManager (managers/QuestionManager.ts)

Manages question progression and answer processing:

- Advancing to the next question
- Recording and validating player answers
- Calculating scores based on correctness and speed
- Generating question results

#### TimerManager (managers/TimerManager.ts)

Handles timing-related aspects:

- Starting question timers
- Broadcasting timer updates
- Handling timer expiration
- Managing timeouts for different game phases

## Game Flow

1. **Game Creation**: Host creates a new game session with a unique code
2. **Lobby Phase**: Players join the game using the code
3. **Game Start**: Host starts the game, moving to the question phase
4. **Question Phase**: Question is displayed to all players
5. **Answer Submission**: Players submit answers, scored based on correctness and speed
6. **Answer Reveal**: Correct answer is shown with player results
7. **Leaderboard**: Current standings are displayed between questions
8. **Game End**: Final results are displayed and saved

## Data Structures

The system uses several key data structures:

- `GameSession`: Contains all game state, players, questions, etc.
- `Player`: Represents a player with ID, name, score, etc.
- `PlayerAnswer`: Records a player's answer to a question
- `QuestionResult`: Contains the results of a question round
- `GameResult`: Represents the final outcome of a completed game

## Reconnection Support

The system implements robust reconnection handling:

- Players can disconnect and reconnect to the same game
- Hosts have a grace period to reconnect before the game is terminated
- Session data is persisted to allow reconnections across server restarts
- Socket-to-player mapping is maintained to facilitate reconnection

## Future Improvements

Potential enhancements to the game management system:

1. More sophisticated session cleanup and garbage collection
2. Enhanced scoring algorithms and game modes
3. Support for team-based play
4. Additional game state types beyond the current flow
5. More detailed analytics and reporting on game sessions