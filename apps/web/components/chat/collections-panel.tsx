"use client";

/**
 * CollectionsPanel - Panel for managing user's collections
 *
 * Features:
 * - Display list of collections
 * - Shows item count per collection
 */
export function CollectionsPanel() {
    return (
        <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
                <button
                    key={i}
                    className="w-full text-left p-3 rounded-lg glass hover:bg-primary/20 transition-all duration-200 hover-lift stagger-item"
                >
                    <div className="font-medium text-sm font-display">
                        Collection {i}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        5 items
                    </div>
                </button>
            ))}
        </div>
    );
}
