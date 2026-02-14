import { UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DragDropOverlayProps {
  isDragging: boolean;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
}

export function DragDropOverlay({
  isDragging,
  onDrop,
  onDragLeave,
}: DragDropOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset counter when not dragging
  useEffect(() => {
    if (!isDragging) {
      dragCounterRef.current = 0;
    }
  }, [isDragging]);

  // If we're not dragging, we don't render anything, so no pointer events block interaction.
  if (!(mounted && isDragging)) {
    return null;
  }

  return createPortal(
    <div
      className="fade-in pointer-events-auto fixed inset-0 z-[100] flex animate-in items-center justify-center bg-background/80 backdrop-blur-md duration-200"
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        // Only hide overlay when we've truly left (counter reaches 0)
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          onDragLeave();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(e);
      }}
    >
      <div className="glass-strong zoom-in-95 pointer-events-none flex animate-in flex-col items-center gap-6 rounded-3xl border-2 border-primary/20 p-10 shadow-2xl duration-200">
        <div className="animate-bounce rounded-full bg-primary/10 p-6 ring-1 ring-primary/20">
          <UploadCloud className="h-16 w-16 text-primary" />
        </div>
        <div className="space-y-2 text-center">
          <h3 className="font-bold font-display text-2xl text-foreground">
            Drop files here
          </h3>
          <p className="max-w-[200px] text-muted-foreground text-sm">
            Add files to your chat context instantly
          </p>
        </div>
        <div className="font-mono text-muted-foreground/50 text-xs uppercase tracking-widest">
          Max 100MB
        </div>
      </div>
    </div>,
    document.body
  );
}
