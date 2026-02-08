import { UploadCloud } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

interface DragDropOverlayProps {
    isDragging: boolean;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: () => void;
}

export function DragDropOverlay({ isDragging, onDrop, onDragLeave }: DragDropOverlayProps) {
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
    if (!mounted || !isDragging) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto"
            onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounterRef.current++;
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop(e);
            }}
        >
            <div className="glass-strong rounded-3xl p-10 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200 border-2 border-primary/20 shadow-2xl pointer-events-none">
                <div className="rounded-full bg-primary/10 p-6 ring-1 ring-primary/20 animate-bounce">
                    <UploadCloud className="w-16 h-16 text-primary" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-display font-bold text-foreground">
                        Drop files here
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-[200px]">
                        Add files to your chat context instantly
                    </p>
                </div>
                <div className="text-xs text-muted-foreground/50 font-mono uppercase tracking-widest">
                    Max 100MB
                </div>
            </div>
        </div>,
        document.body
    );
}
