# AI Quiz Game

A multiplayer quiz game inspired by Jackbox.tv where hosts can create AI-generated quizzes and players join with their mobile devices.

## Features

- Real-time multiplayer gameplay
- Room-based game sessions with 4-letter codes
- Host authentication via Supabase
- Credit-based system for quiz creation
- Payment processing via Stripe
- AI-generated quizzes using OpenAI or Claude
- Custom quiz creation from PDF/DOCX files using RAG
- Mobile-friendly player interface
- Support for various quiz formats (multiple choice, flashcards, timed, etc.)
- Transactional emails via Resend

## Project Structure

```
├── client/            # Next.js frontend application
├── server/            # Express backend application
├── shared/            # Shared types and constants
├── quiz-generator/    # AI quiz generation logic
└── claude/            # Prompts and notes for Claude
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- OpenAI or Anthropic API key
- Cloudflare R2 account
- Resend account

### Installation and Setup

1. Clone the repository
2. Install dependencies and build the shared packages:

```bash
# Install all dependencies and build shared packages
npm run setup
```

3. Set up your database in Supabase:
   - Log in to your Supabase account
   - Create a new project
   - Go to the SQL Editor
   - Copy the contents of `/server/db/schema.sql`
   - Paste into the SQL Editor and run the query

4. Set up environment variables:
   - Copy `.env.example` to `.env` in the client directory
   - Copy `.env.example` to `.env` in the server directory
   - Fill in the values for your Supabase, Stripe, etc.

5. Start the development servers:

```bash
# Start both client and server in development mode
npm run dev
```

### Available Scripts

- `npm run setup` - Install dependencies and build shared libraries
- `npm run dev` - Start both client and server in development mode
- `npm run dev:client` - Start only the client in development mode
- `npm run dev:server` - Start only the server in development mode
- `npm run build` - Build all packages for production
- `npm run build:libs` - Build only the shared libraries
- `npm run start` - Start the production server
- `npm run lint` - Run linting on all packages
- `npm run typecheck` - Run type checking on all packages

## Authentication Flow

1. Users sign up via Supabase Auth
2. On successful registration, a trigger creates a record in the `users` table
3. New users get 3 free credits to create quizzes
4. Login/logout is handled via Supabase Auth

## Game Flow

1. Host creates a quiz from the dashboard
2. Host starts a game, receiving a 4-letter room code
3. Players join by entering the room code on the homepage
4. Host controls the game progression (questions, timers, etc.)
5. Players answer questions on their devices
6. Scores are calculated and a leaderboard is shown

## Database Setup

The project uses Supabase PostgreSQL. The database schema is defined in `/server/db/schema.sql`. Make sure to run this script in your Supabase SQL Editor before starting the application.

### Database Migrations

When needed, database migrations can be found in `/server/db/migrations/`. Apply them in numeric order to update your database schema.

#### Current Migrations

1. `001_add_transaction_functions.sql` - Adds transaction support, necessary columns for game state persistence, and the time_limit column for timed quizzes.

## License

MIT