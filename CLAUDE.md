# Claude Notes

This file contains useful information and commands that Claude should be aware of when helping with this project.

## Important Commands

### Client
- Install dependencies: `cd client && npm install`
- Start development server: `cd client && npm run dev`
- Build for production: `cd client && npm run build`
- Run linting: `cd client && npm run lint`
- Run type checking: `cd client && npm run typecheck`

### Server
- Install dependencies: `cd server && npm install`
- Start development server: `cd server && npm run dev`
- Build for production: `cd server && npm run build`
- Run linting: `cd server && npm run lint`
- Run type checking: `cd server && npm run typecheck`

## Project Structure

- `client/`: Frontend application built with Next.js
- `server/`: Backend application built with Express and Socket.io
- `shared/`: Shared types and constants
- `quiz-generator/`: AI quiz generation logic
- `claude/`: Prompts and notes for Claude

## Tech Stack

- Frontend: Next.js, React, TailwindCSS
- Backend: Node.js, Express
- Real-time: Socket.io
- Authentication: Supabase Auth
- Payments: Stripe
- Email: Resend
- Storage: Cloudflare R2
- AI: OpenAI API and Claude API
- Database: Supabase PostgreSQL
- API: tRPC

## Environment Variables

### Client
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
```

### Server
```
PORT=3001
CORS_ORIGIN=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
RESEND_API_KEY=
```