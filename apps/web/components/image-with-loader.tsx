"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AlertTriangle, Download, Link as LinkIcon, Loader, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ZoomableImageWithLoader = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // This effect preloads the image and manages loading/error states
  useEffect(() => {
    // Reset states when the src changes
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
    // Only open the modal if the image has loaded successfully
    if (!(isLoading || isError)) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = alt || "downloaded_image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(src);
    toast("URL Copied", {
      description: "URL copied to clipboard!",
    });
  };

  return (
    <div className="group relative flex items-center justify-center">
      {/* The clickable thumbnail area */}
      <button
        className={cn(
          "relative overflow-hidden border border-zinc-700 transition",
          "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
          "bg-zinc-800", // Set a background for loading/error states
          className // For sizing and aspect ratio
        )}
        disabled={isLoading || isError}
        onClick={openModal}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-10 w-10">
              <Loader className="absolute inset-0 m-auto h-10 w-10 animate-spin text-zinc-400" />
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-red-400">
            <AlertTriangle className="h-6 w-6" />
            <span className="mt-1 text-xs">Load failed</span>
          </div>
        )}

        {/* Standard <img> tag for the thumbnail */}
        {!(isLoading || isError) && (
          <img
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
            src={src}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="truncate p-2 text-white text-xs">{src}</p>
        </div>
      </button>

      {/* The Modal for the full-size image */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex animate-[fade-in_0.2s_ease-out] items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking on the image
          >
            <div className="absolute top-2 right-2 z-10 space-x-2">
              <button
                className="rounded-full bg-black/50 p-2 text-zinc-300 transition hover:bg-black/75 hover:text-white"
                onClick={copyUrl}
                title="Copy image URL"
              >
                <LinkIcon className="h-5 w-5" />
              </button>
              <button
                className="rounded-full bg-black/50 p-2 text-zinc-300 transition hover:bg-black/75 hover:text-white"
                onClick={downloadImage}
                title="Download image"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                className="rounded-full bg-black/50 p-2 text-zinc-300 transition hover:bg-black/75 hover:text-white"
                onClick={closeModal}
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Standard <img> tag for the modal image */}
            <img alt={alt} className="max-h-[90vh] max-w-[90vw] rounded-lg" src={src} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoomableImageWithLoader;
