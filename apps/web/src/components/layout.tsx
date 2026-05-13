import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth-store";
import { useSessionStore } from "@/stores/session-store";
import { Sidebar } from "@/components/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token, isInitialized, fetchUser } = useAuthStore();
  const { fetchSessions } = useSessionStore();

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated && !token) {
      navigate("/login", { replace: true });
    } else if (token && !isAuthenticated) {
      fetchUser();
    } else if (isAuthenticated) {
      fetchSessions();
    }
  }, [isInitialized, isAuthenticated, token, navigate, fetchUser, fetchSessions]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-screen bg-bg-void items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen bg-bg-void text-text-primary overflow-hidden">
        {/* Ambient haze layer */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute w-[900px] h-[900px] top-[-350px] left-1/2 -translate-x-1/2"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 65%)",
              filter: "blur(100px)",
            }}
          />
          <div
            className="absolute w-[900px] h-[900px] right-[-250px] bottom-[-500px] opacity-45"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 65%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        {/* Atmospheric gradient overlay */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 50% -12%, rgba(140,160,255,0.13) 0%, rgba(120,140,220,0.06) 18%, transparent 42%),
                radial-gradient(ellipse at 50% 18%, rgba(255,255,255,0.03) 0%, transparent 62%),
                radial-gradient(ellipse at 50% 100%, rgba(90,100,180,0.05) 0%, transparent 60%)
              `,
            }}
          />
        </div>

        <Sidebar />

        <main className="flex-1 flex flex-col relative z-[2] min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-w-0 overflow-hidden"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </TooltipProvider>
  );
}
