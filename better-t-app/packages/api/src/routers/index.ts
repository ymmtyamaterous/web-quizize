import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { quizRouter } from "./quiz";
import { quizAttemptRouter } from "./quizAttempt";
import { statsRouter } from "./stats";
import { tagRouter } from "./tag";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  quiz: quizRouter,
  quizAttempt: quizAttemptRouter,
  stats: statsRouter,
  tag: tagRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
