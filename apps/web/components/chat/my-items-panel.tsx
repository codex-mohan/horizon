"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { FileText, Grid3x3, ImageIcon, List, SortAsc } from "lucide-react";
import { useState } from "react";

/**
 * MyItemsPanel - Panel for managing user's uploaded and generated items
 *
 * Features:
 * - Toggle between grid and list view
 * - Sort by name or date
 * - Separate tabs for uploaded and generated items
 */
export function MyItemsPanel() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [_sortBy, setSortBy] = useState<"name" | "date">("date");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-border border-b p-4">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="transition-transform duration-200 hover:scale-110"
                size="icon-sm"
                variant="ghost"
              >
                {viewMode === "grid" ? (
                  <Grid3x3 className="size-4" />
                ) : (
                  <List className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="animate-scale-in">
              <DropdownMenuItem onClick={() => setViewMode("grid")}>
                <Grid3x3 className="mr-2 size-4" />
                Grid View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("list")}>
                <List className="mr-2 size-4" />
                List View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="transition-transform duration-200 hover:scale-110"
                size="icon-sm"
                variant="ghost"
              >
                <SortAsc className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="animate-scale-in">
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                Sort by Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("date")}>
                Sort by Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs className="flex flex-1 flex-col" defaultValue="uploaded">
        <TabsList className="w-full justify-start rounded-none border-border border-b bg-transparent px-4">
          <TabsTrigger value="uploaded">Uploaded</TabsTrigger>
          <TabsTrigger value="generated">Generated</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-0 flex-1" value="uploaded">
          <ScrollArea className="h-full">
            <div
              className={cn(
                "p-4",
                viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"
              )}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  className={cn(
                    "glass hover-lift stagger-item cursor-pointer overflow-hidden rounded-lg transition-all duration-200 hover:bg-primary/20",
                    viewMode === "grid"
                      ? "hover-glow aspect-square"
                      : "flex items-center gap-3 p-3"
                  )}
                  key={i}
                >
                  {viewMode === "grid" ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <FileText className="size-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <FileText className="size-6 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-sm">
                          Document {i}.pdf
                        </div>
                        <div className="text-muted-foreground text-xs">
                          2.4 MB
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent className="mt-0 flex-1" value="generated">
          <ScrollArea className="h-full">
            <div
              className={cn(
                "p-4",
                viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"
              )}
            >
              {[1, 2, 3].map((i) => (
                <div
                  className={cn(
                    "glass hover-lift stagger-item cursor-pointer overflow-hidden rounded-lg transition-all duration-200 hover:bg-primary/20",
                    viewMode === "grid"
                      ? "hover-glow aspect-square"
                      : "flex items-center gap-3 p-3"
                  )}
                  key={i}
                >
                  {viewMode === "grid" ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="size-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="size-6 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-sm">
                          Generated {i}.png
                        </div>
                        <div className="text-muted-foreground text-xs">
                          1.2 MB
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
