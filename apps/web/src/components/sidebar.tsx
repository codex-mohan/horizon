import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  PenSquare,
  Search,
  Library,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useSessionStore } from "@/stores/session-store";
import { HorizonLogoStatic } from "@/components/animated-logo";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: MessageSquare, label: "Chats", path: "/" },
  { icon: PenSquare, label: "New Chat", action: "newChat" },
  { icon: Search, label: "Search", action: "search" },
  { icon: Library, label: "Library", action: "library" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { createSession } = useSessionStore();
  const [chatsOpen, setChatsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isChatRoute = location.pathname.startsWith("/c") || location.pathname === "/";

  const handleNewChat = async () => {
    const session = await createSession("New Chat");
    navigate(`/c/${session.id}`);
  };

  return (
    <>
      <aside className="w-[72px] shrink-0 flex flex-col items-center py-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border-r border-[rgba(255,255,255,0.035)] backdrop-blur-[22px] z-20">
        <button
          onClick={() => navigate("/")}
          className="w-[42px] h-[42px] flex items-center justify-center mb-7 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] border border-[rgba(255,255,255,0.08)] relative overflow-hidden"
          aria-label="Home"
        >
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.1)_50%,transparent_80%)] animate-[sheen_8s_linear_infinite]" />
          <HorizonLogoStatic size={18} />
        </button>

        <nav className="flex flex-col gap-[10px]">
          {navItems.map((item) => {
            const isActive = item.path ? location.pathname === item.path : false;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.path) navigate(item.path);
                  if (item.label === "Chats") setChatsOpen(true);
                  if (item.label === "New Chat") handleNewChat();
                }}
                className={cn(
                  "w-[44px] h-[44px] flex items-center justify-center bg-transparent border border-transparent text-white/40 hover:text-white hover:border-white/[0.06] hover:bg-white/[0.03] transition-all duration-250",
                  isActive && "text-white bg-white/[0.04] border-white/[0.08]"
                )}
                title={item.label}
                aria-label={item.label}
              >
                <item.icon size={18} strokeWidth={1.8} />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto mb-[6px] flex flex-col items-center gap-[10px] pt-4 border-t border-[rgba(255,255,255,0.08)] w-full">
          <button
            onClick={() => navigate("/settings")}
            className="w-[44px] h-[44px] flex items-center justify-center text-white/40 hover:text-white hover:border-white/[0.06] hover:bg-white/[0.03] border border-transparent transition-all duration-250"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={18} strokeWidth={1.8} />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
              className="w-[32px] h-[32px] flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white font-sora text-[11px] font-semibold hover:opacity-85 transition-opacity"
              aria-label="User menu"
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute left-[calc(100%+10px)] bottom-1 w-[200px] bg-[rgba(15,18,25,0.6)] backdrop-blur-[38px] saturate-[180%] border border-[rgba(255,255,255,0.06)] shadow-[0_20px_60px_rgba(0,0,0,0.45)] z-50">
                  <div className="px-4 py-[14px] border-b border-[rgba(255,255,255,0.05)]">
                    <div className="text-[13px] font-sora font-semibold text-white">{user?.name ?? "User"}</div>
                    <div className="text-[11px] text-text-muted mt-[2px]">{user?.email ?? "user@horizon.ai"}</div>
                  </div>
                  <button
                    onClick={() => { navigate("/settings"); setUserMenuOpen(false); }}
                    className="flex items-center gap-[10px] w-full px-4 py-[10px] bg-transparent border-none text-text-secondary text-[13px] hover:text-white hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <Settings size={16} className="text-text-muted shrink-0" />
                    Settings
                  </button>
                  <div className="h-px bg-[rgba(255,255,255,0.05)] mx-0 my-1" />
                  <button
                    onClick={() => { logout(); navigate("/login"); }}
                    className="flex items-center gap-[10px] w-full px-4 py-[10px] bg-transparent border-none text-text-secondary text-[13px] hover:text-white hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <LogOut size={16} className="text-text-muted shrink-0" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <ChatsDialog open={chatsOpen} onClose={() => setChatsOpen(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Chats Dialog
// ---------------------------------------------------------------------------

interface ChatsDialogProps {
  open: boolean;
  onClose: () => void;
}

function ChatsDialog({ open, onClose }: ChatsDialogProps) {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, updateSessionTitle } = useSessionStore();
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filtered = filter
    ? sessions.filter((s) => s.title.toLowerCase().includes(filter.toLowerCase()))
    : sessions;

  const handleSelect = (id: string) => {
    navigate(`/c/${id}`);
    onClose();
  };

  const handleNew = async () => {
    const session = await createSession("New Chat");
    navigate(`/c/${session.id}`);
    onClose();
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const submitRename = (id: string) => {
    if (editTitle.trim()) {
      updateSessionTitle(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    if (editingId === id) {
      setEditingId(null);
      setEditTitle("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-[rgba(15,18,25,0.55)] backdrop-blur-[42px] saturate-[180%] border-[rgba(255,255,255,0.06)] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <DialogHeader className="flex flex-row items-center justify-between px-[18px] py-[14px] border-b border-[rgba(255,255,255,0.05)]">
          <DialogTitle className="text-[13px] font-sora font-semibold tracking-[0.08em] uppercase text-white">
            Conversations
          </DialogTitle>
          <Button
            size="sm"
            onClick={handleNew}
          >
            <PenSquare className="size-3 mr-1.5" />
            New
          </Button>
        </DialogHeader>

        <div className="px-[18px] py-3 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-[10px] px-3 py-2 bg-white/[0.02] border border-[rgba(255,255,255,0.05)]">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-text-muted outline-none"
            />
            {filter && (
              <button onClick={() => setFilter("")} className="text-text-muted hover:text-text-secondary">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">
              {filter ? "No conversations match your search" : "No conversations yet"}
            </div>
          ) : (
            filtered.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelect(session.id)}
                className="flex items-center justify-between px-[18px] py-3 hover:bg-white/[0.025] transition-colors cursor-pointer group border-b border-[rgba(255,255,255,0.035)] last:border-b-0"
              >
                {editingId === session.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(session.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => submitRename(session.id)}
                    className="flex-1 mr-2 px-2 py-1 bg-bg-void border border-[rgba(255,255,255,0.05)] text-xs text-white outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-[13px] text-text-secondary truncate flex-1 mr-[14px]">
                    {session.title || "New Chat"}
                  </span>
                )}

                <div className="flex items-center gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(session.id, session.title || "New Chat");
                    }}
                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                    title="Rename"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3L21 7L8 20L3 21L4 16L17 3Z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-[18px] py-[10px] border-t border-[rgba(255,255,255,0.05)] text-[11px] text-text-muted text-center tracking-[0.04em]">
          {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
        </div>
      </DialogContent>
    </Dialog>
  );
}
