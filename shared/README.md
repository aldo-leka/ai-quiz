# AI Quiz Game - Shared

This package contains shared types, constants, and utilities used by both the client and server applications.

## Contents

### Types

- Game session types
- Player types
- Quiz types
- Socket event types
- API request/response types

### Constants

- Quiz types
- Game states
- Socket event names
- Error codes

### Utilities

- Type guards
- Validation functions
- Shared helper functions

## Usage

Both the client and server packages import from this shared package to ensure type consistency across the application.

```typescript
// Example usage in client or server
import { GameSession, Player, QuizType } from '../shared/types';
import { EVENTS, GAME_STATES } from '../shared/constants';
```