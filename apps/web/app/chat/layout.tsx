import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - Horizon",
  description: "AI Chat Interface by Singularity.ai",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
