import { useEffect, useRef, useState } from "react";

interface SmartLinkProps {
  href: string;
  children: React.ReactNode;
}

const Spinner = () => (
  <svg className="animate-spin" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export function SmartLink({ href, children }: SmartLinkProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const fetchTitle = async () => {
      if (!href.startsWith("http") || href.length < 15) {
        setTitle(href);
        setIsLoading(false);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        setIsLoading(true);
        try {
          const response = await fetch(`/api/get-title?url=${encodeURIComponent(href)}`);
          if (isMountedRef.current && response.ok) {
            const data = await response.json() as { title?: string };
            setTitle(data.title || href);
          } else if (isMountedRef.current) {
            setTitle(href);
          }
        } catch {
          if (isMountedRef.current) {
            setTitle(href);
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }, 300);
    };

    fetchTitle();

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [href]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <a
        className="inline-flex items-center gap-1 text-[var(--text-secondary)] underline decoration-[var(--text-secondary)]/50 underline-offset-2 transition-colors hover:text-[var(--text-primary)]"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
        <svg className="inline-block shrink-0" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </a>

      {isTooltipVisible && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-xs -translate-x-1/2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)] text-sm shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-[var(--text-muted)]">Fetching title...</span>
            </div>
          ) : (
            <div>
              <span className="block font-semibold text-[var(--text-primary)]">{title}</span>
              <span className="mt-1 block max-w-full truncate text-[var(--text-muted)] text-xs">{href}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
