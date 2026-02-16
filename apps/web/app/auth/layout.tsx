import { Suspense } from "react";

export const metadata = {
  title: "Sign In - Horizon",
  description: "Sign in to your Horizon account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
