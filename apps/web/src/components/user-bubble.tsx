import { MarkdownView } from "@horizon/ui";
import { useAuthStore } from "@/stores/auth-store";

interface UserBubbleProps {
  content: string;
}

export function UserBubble({ content }: UserBubbleProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <div
      className="flex items-start justify-end gap-3"
      style={{ animation: "messageIn .4s ease both" }}
    >
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-[10px] mb-3">
          <span className="text-xs text-white/[0.28]">{timeNow()}</span>
          <span className="text-[13px] font-medium text-white/84">You</span>
        </div>
        <div className="relative max-w-[520px] px-6 py-6 bg-white/[0.045] border border-[rgba(255,255,255,0.07)] backdrop-blur-[22px] text-[15px] leading-[1.85]">
          <MarkdownView text={content} />
        </div>
      </div>
      <div className="w-7 h-7 shrink-0 bg-white/[0.09] border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-white text-xs font-semibold">
        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
      </div>
    </div>
  );
}

function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
