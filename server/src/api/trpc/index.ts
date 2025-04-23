import { initTRPC } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';

export function createTRPCContext(opts: CreateExpressContextOptions) {
  return {};
}

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Define your app's routers
const userRouter = router({
  // User-related procedures
});

const quizRouter = router({
  // Quiz-related procedures
});

const paymentRouter = router({
  // Payment-related procedures
});

// Root router
export const appRouter = router({
  user: userRouter,
  quiz: quizRouter,
  payment: paymentRouter,
});
