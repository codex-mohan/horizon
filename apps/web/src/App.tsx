import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Layout } from "@/components/layout";
import { LoginPage } from "@/routes/login";
import { SignupPage } from "@/routes/signup";
import { PricingPage } from "@/routes/pricing";
import { ChatHome } from "@/routes/chat-home";
import { ChatSession } from "@/routes/chat-session";
import { SettingsPage } from "@/routes/settings";

export default function App() {
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    init();
  }, [init]);

  // Show nothing while auth is initializing to prevent flash of login page
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<ChatHome />} />
        <Route path="/c/:sessionId" element={<ChatSession />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
