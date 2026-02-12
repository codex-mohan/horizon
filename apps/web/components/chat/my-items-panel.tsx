"use client";

import {
    ImageIcon,
    FileText,
    Grid3x3,
    List,
    SortAsc,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
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
    const [sortBy, setSortBy] = useState<"name" | "date">("date");

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hover:scale-110 transition-transform duration-200"
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
                                <Grid3x3 className="size-4 mr-2" />
                                Grid View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setViewMode("list")}>
                                <List className="size-4 mr-2" />
                                List View
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hover:scale-110 transition-transform duration-200"
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

            <Tabs defaultValue="uploaded" className="flex-1 flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
                    <TabsTrigger value="uploaded">Uploaded</TabsTrigger>
                    <TabsTrigger value="generated">Generated</TabsTrigger>
                </TabsList>

                <TabsContent value="uploaded" className="flex-1 mt-0">
                    <ScrollArea className="h-full">
                        <div
                            className={cn(
                                "p-4",
                                viewMode === "grid"
                                    ? "grid grid-cols-2 gap-3"
                                    : "space-y-2",
                            )}
                        >
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "glass rounded-lg overflow-hidden hover:bg-primary/20 transition-all duration-200 cursor-pointer hover-lift stagger-item",
                                        viewMode === "grid"
                                            ? "aspect-square hover-glow"
                                            : "p-3 flex items-center gap-3",
                                    )}
                                >
                                    {viewMode === "grid" ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileText className="size-8 text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <>
                                            <FileText className="size-6 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    Document {i}.pdf
                                                </div>
                                                <div className="text-xs text-muted-foreground">
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

                <TabsContent value="generated" className="flex-1 mt-0">
                    <ScrollArea className="h-full">
                        <div
                            className={cn(
                                "p-4",
                                viewMode === "grid"
                                    ? "grid grid-cols-2 gap-3"
                                    : "space-y-2",
                            )}
                        >
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "glass rounded-lg overflow-hidden hover:bg-primary/20 transition-all duration-200 cursor-pointer hover-lift stagger-item",
                                        viewMode === "grid"
                                            ? "aspect-square hover-glow"
                                            : "p-3 flex items-center gap-3",
                                    )}
                                >
                                    {viewMode === "grid" ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="size-8 text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <>
                                            <ImageIcon className="size-6 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    Generated {i}.png
                                                </div>
                                                <div className="text-xs text-muted-foreground">
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
