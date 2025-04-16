# AI Quiz Game - Client

This is the frontend application for the AI Quiz Game.

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TailwindCSS
- Socket.io Client
- Supabase Auth
- Stripe Payment Integration

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=your_stripe_public_key
```

You can find these values in your Supabase project settings and Stripe dashboard.

3. Start the development server:

```bash
npm run dev
```

## Authentication Flow

The client uses Supabase Auth for authentication. The authentication flow includes:

1. Sign up: `/auth/register`
2. Sign in: `/auth/login`
3. Password reset: `/auth/forgot-password`

When a user registers, Supabase automatically creates a record in the `auth.users` table. A trigger in the database then creates a corresponding record in the `public.users` table with initial credits.

## User Flows

### Player Flow

1. Visit the homepage
2. Enter a 4-letter game code and name
3. Join a game lobby
4. Answer quiz questions as they appear
5. See results and final scores

### Host Flow

1. Sign in or register an account
2. Purchase credits (if needed)
3. Create a new quiz by selecting:
   - Quiz type (multiple choice, true/false, etc.)
   - Theme
   - Number of questions
   - AI service (OpenAI or Claude)
4. Start a game with the created quiz
5. Share the room code with players
6. Control the game progression
7. View results and player scores

## Key Pages

- `/` - Homepage with game join form
- `/auth/login` - Login page
- `/auth/register` - Registration page
- `/auth/forgot-password` - Password reset page
- `/host` - Host dashboard
- `/host/create` - Create quiz flow
- `/host/dashboard` - View created quizzes
- `/host/credits` - Purchase credits
- `/host/lobby` - Game lobby for host
- `/host/game` - Game control panel for host
- `/join` - Player join confirmation
- `/game` - Game screen for players

## Folder Structure

```
├── app/                  # Next.js app router
│   ├── api/              # API routes
│   ├── auth/             # Auth pages
│   ├── game/             # Game screens
│   ├── host/             # Host dashboard
│   └── join/             # Player join page
├── components/           # React components
│   ├── game/             # Game-specific components
│   ├── host/             # Host-specific components
│   ├── player/           # Player-specific components
│   └── ui/               # Reusable UI components
├── lib/                  # Utility functions and hooks
│   ├── api/              # API clients
│   ├── supabase/         # Supabase client
│   └── stripe/           # Stripe integration
├── hooks/                # Custom React hooks
├── styles/               # Global styles
└── public/               # Static assets
```

## Working with Supabase

The application uses Supabase for authentication and data storage. Make sure your Supabase project is properly set up before starting the client:

1. Run the SQL script in `/server/db/schema.sql` to create necessary tables
2. Configure authentication in the Supabase dashboard
3. Set up proper Row Level Security (RLS) policies
4. Create storage buckets for quiz images and documents (if needed)

## Build for Production

```bash
npm run build
npm run start
```