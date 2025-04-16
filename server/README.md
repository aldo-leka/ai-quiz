# AI Quiz Game - Server

This is the backend application for the AI Quiz Game.

## Tech Stack

- Node.js
- Express
- Socket.io
- tRPC
- Supabase (PostgreSQL)
- Stripe
- Resend
- Cloudflare R2
- OpenAI API / Claude API

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up your Supabase database:
   - Log in to your Supabase account
   - Create a new project
   - Go to the SQL Editor
   - Copy the contents of `/server/db/schema.sql`
   - Paste into the SQL Editor and run the query
   - This will create all necessary tables and set up triggers

3. Set up environment variables:

Create a `.env` file with the following variables:

```
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Cloudflare R2 
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key

# Resend
RESEND_API_KEY=your_resend_api_key

# Database (only needed for local development without Supabase)
DATABASE_URL=your_postgres_url
```

4. Start the development server:

```bash
npm run dev
```

## Database Schema

The application uses Supabase PostgreSQL. The database schema includes:

- `users` - User accounts and credit information
- `quizzes` - Quiz metadata and details
- `questions` - Questions for each quiz
- `games` - Game sessions
- `players` - Player information for each game
- `answers` - Player answers for questions
- `payments` - Payment records for credit purchases

The full schema is defined in `/server/db/schema.sql`. Make sure to run this script in your Supabase SQL Editor before starting the application.

## Authentication

The server uses Supabase Auth for authentication. When a user signs up via the client application, a trigger in the Supabase database automatically creates a record in the `users` table with initial credits.

## API Endpoints

### REST API

- `/api/auth/user` - Get current user information
- `/api/quiz/generate` - Generate a quiz using AI
- `/api/quiz/generate-from-document` - Generate a quiz from a document
- `/api/quiz/themes` - Get quiz theme suggestions
- `/api/payments/create-checkout-session` - Create a Stripe checkout session
- `/api/payments/webhook` - Handle Stripe webhook events

### Socket.io

The server uses Socket.io for real-time communication. Key events include:

- `create_game` - Create a new game session
- `join_game` - Join an existing game
- `start_game` - Start a game
- `next_question` - Move to the next question
- `submit_answer` - Submit an answer to a question
- `reveal_answer` - Reveal the correct answer

## Folder Structure

```
├── src/
│   ├── api/             # API routes
│   │   ├── trpc/        # tRPC router definitions
│   │   ├── rest/        # Express REST endpoints
│   │   └── ws/          # WebSocket handlers
│   ├── auth/            # Authentication logic
│   ├── db/              # Database schemas and queries
│   ├── game/            # Game session management
│   ├── payments/        # Stripe integration
│   ├── quiz/            # Quiz management
│   ├── rag/             # RAG implementation
│   ├── services/        # External service integrations
│   │   ├── ai/          # OpenAI/Claude integration
│   │   ├── email/       # Resend integration
│   │   └── storage/     # Cloudflare R2 integration
│   ├── types/           # Server-specific type definitions
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   ├── server.ts        # Server entry point
│   └── socket.ts        # Socket.io setup
└── prisma/              # Prisma schema and migrations
```

## Building for Production

```bash
npm run build
npm run start
```