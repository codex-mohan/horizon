import { useEffect, useRef, useState } from "react";
import { FiLink } from "react-icons/fi";

const DEBOUNCE_DELAY = 300;
const MIN_URL_LENGTH = 15;

const Spinner = () => (
  <svg
    className="animate-spin"
    fill="none"
    height="18"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const SmartLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const fetchTitle = async () => {
      if (!href.startsWith("http") || href.length < MIN_URL_LENGTH) {
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
            const data = await response.json();
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
      }, DEBOUNCE_DELAY);
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
      role="tooltip"
    >
      <a
        className="inline-flex items-center gap-1 text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:text-primary/80"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
        <FiLink className="inline-block shrink-0" />
      </a>

      {/* Shadcn UI-style Tooltip with animations */}
      {isTooltipVisible && (
        <div
          // These data attributes mimic Radix for Shadcn-like CSS animations
          className="fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-xs -translate-x-1/2 animate-in rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm shadow-lg data-[state=closed]:animate-out"
          data-state={isTooltipVisible ? "open" : "closed"}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner />
              <span>Fetching title...</span>
            </div>
          ) : (
            <div>
              <span className="block font-semibold text-foreground">{title}</span>
              <span className="mt-1 block max-w-full truncate text-muted-foreground text-xs">
                {href}
              </span>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export default SmartLink;
