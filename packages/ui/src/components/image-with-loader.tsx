import { useEffect, useState } from "react";
import { cn } from "../utils.js";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ZoomableImageWithLoader({ src, alt, className }: ZoomableImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);

    const img = new window.Image();
    img.src = src;
    img.onload = () => setIsLoading(false);
    img.onerror = () => {
      setIsLoading(false);
      setIsError(true);
    };
  }, [src]);

  const openModal = () => {
    if (!(isLoading || isError)) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className={cn("group relative flex w-full items-center justify-center", className)}>
        <button
          className="relative block h-full w-full overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)] focus:outline-none"
          disabled={isLoading || isError}
          onClick={openModal}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          )}

          {isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-red-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.714 1.714 0 0 0 1.475 2.625h16.536a1.714 1.714 0 0 0 1.475-2.625l-8.106-13.534a1.714 1.714 0 0 0-2.95 0z" /><path d="M12 16h.01" />
              </svg>
              <span className="mt-1 text-xs">Load failed</span>
            </div>
          )}

          {!(isLoading || isError) && (
            <img alt={alt} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300" src={src} />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate p-2 text-white text-xs">{src}</p>
          </div>
        </button>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-2 text-zinc-300 transition hover:bg-black/75 hover:text-white"
              onClick={() => setIsModalOpen(false)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
            <img alt={alt} className="max-h-[90vh] max-w-[90vw]" src={src} />
          </div>
        </div>
      )}
    </>
  );
}
