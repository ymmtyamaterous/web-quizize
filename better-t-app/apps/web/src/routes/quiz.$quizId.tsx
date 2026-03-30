import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/quiz/$quizId")({
  component: () => <Outlet />,
  beforeLoad: async ({ context }) => {
    // authは親の quiz.tsx で確認済みだが念のため
    return {};
  },
});
