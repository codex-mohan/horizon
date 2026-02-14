import { useEffect, useState } from "react";
import { FiLink } from "react-icons/fi";

// A cool SVG spinner for the loading state
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

const SmartLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the title when the component mounts
    const fetchTitle = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/get-title?url=${encodeURIComponent(href)}`
        );
        // We don't throw an error here, just proceed. If it fails, we'll fallback.
        if (response.ok) {
          const data = await response.json();
          // Use the fetched title, but fallback to the href if it's empty
          console.log(`Got title:${data}`);
          setTitle(data.title || href);
        } else {
          console.error("Failed to fetch title:", response.status);
          setTitle(href);
        }
      } catch (_err) {
        setTitle(href); // On error, just use the URL itself
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch for http/https links
    if (href.startsWith("http")) {
      fetchTitle();
    } else {
      setTitle(href);
      setIsLoading(false);
    }
  }, [href]);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
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
              <p className="font-semibold text-foreground">{title}</p>
              <p className="mt-1 max-w-full truncate text-muted-foreground text-xs">
                {href}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartLink;
