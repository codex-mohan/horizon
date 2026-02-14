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
          className="glass hover-lift stagger-item w-full rounded-lg p-3 text-left transition-all duration-200 hover:bg-primary/20"
          key={i}
        >
          <div className="font-display font-medium text-sm">Collection {i}</div>
          <div className="mt-1 text-muted-foreground text-xs">5 items</div>
        </button>
      ))}
    </div>
  );
}
