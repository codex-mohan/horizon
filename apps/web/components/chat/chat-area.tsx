"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Plus, Wrench, SlidersHorizontal, Paperclip, LinkIcon, Pencil, Send, X, Mic } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { GradientButton } from "@workspace/ui/components/gradient-button"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu"
import { ChatBubble } from "./chat-bubble"
import { cn } from "@workspace/ui/lib/utils"
import type { Message, AttachedFile } from "./chat-interface"
import { FileAttachment } from "@workspace/ui/components/file-attachment"

interface ChatAreaProps {
  messages: Message[]
  attachedFiles: AttachedFile[]
  onMessagesChange: (messages: Message[]) => void
  onAttachedFilesChange: (files: AttachedFile[]) => void
  onSettingsOpen: () => void
}

const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
]

export function ChatArea({
  messages,
  attachedFiles,
  onMessagesChange,
  onAttachedFilesChange,
  onSettingsOpen,
}: ChatAreaProps) {
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile()
          if (blob) {
            const url = URL.createObjectURL(blob)
            onAttachedFilesChange([
              ...attachedFiles,
              {
                id: Date.now().toString(),
                name: `image-${Date.now()}.png`,
                type: item.type,
                url,
                size: blob.size,
              },
            ])
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [attachedFiles, onAttachedFilesChange])

  const wordCount = input.trim().split(/\s+/).filter(Boolean).length

  const handleSend = () => {
    if (!input.trim() && attachedFiles.length === 0) return

    if (isEditing) {
      onMessagesChange(messages.map((msg) => (msg.id === isEditing ? { ...msg, content: input } : msg)))
      setIsEditing(null)
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp: new Date(),
        attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
      }

      onMessagesChange([...messages, userMessage])

      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "This is a simulated response. Connect this to your LangGraph.js backend for real streaming responses.",
          timestamp: new Date(),
          streaming: true,
        }
        onMessagesChange([...messages, userMessage, aiMessage])
      }, 500)
    }

    setInput("")
    onAttachedFilesChange([])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles: AttachedFile[] = files.map((file) => ({
      id: Date.now().toString() + file.name,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      size: file.size,
    }))
    onAttachedFilesChange([...attachedFiles, ...newFiles])
  }

  const handleEdit = (messageId: string, content: string) => {
    setIsEditing(messageId)
    setInput(content)
    textareaRef.current?.focus()
  }

  const handleRetry = (messageId: string, content: string) => {
    console.log("Retry message:", messageId, content)
    // Implement retry logic - could resend the user's previous message to get a new response
  }

  const handleFork = (messageId: string, content: string) => {
    console.log("Fork message:", messageId, content)
    // Implement fork to new conversation
  }

  const handleSpeak = (messageId: string, content: string) => {
    console.log("Speak message:", messageId, content)
    // Speech synthesis is handled in the bubble component
  }

  const handleSummarize = (messageId: string, content: string) => {
    console.log("Summarize message:", messageId, content)
    // Implement summarize logic
  }

  const handleShare = (messageId: string, content: string) => {
    console.log("Share message:", messageId, content)
    // Implement share logic
  }

  const handleDelete = (messageId: string) => {
    onMessagesChange(messages.filter((msg) => msg.id !== messageId))
  }

  const modelGroups = {
    OpenAI: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    Anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    Google: ["gemini-pro", "gemini-pro-vision"],
    Local: ["ollama/llama2", "vllm/mistral"],
  }

  const renderChatInput = () => (
    <div className="glass-strong rounded-xl p-4 space-y-3 hover-lift">
      {attachedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
          {attachedFiles.map((file) => (
            <FileAttachment
              key={file.id}
              file={file}
              size={file.size}
              onRemove={() => onAttachedFilesChange(attachedFiles.filter((f) => f.id !== file.id))}
              variant="input"
            />
          ))}
        </div>
      )}

      {/* Editing Indicator */}
      {isEditing && (
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground/80">Editing message</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(null)
              setInput("")
            }}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="size-3 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder="Ask me anything..."
        className="min-h-20 max-h-[150px] resize-none bg-transparent border-0 focus-visible:ring-0 transition-all duration-200"
      />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
        {/* Left controls */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:scale-110 transition-transform duration-200"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-100 animate-scale-in">
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="size-4 mr-2" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LinkIcon className="size-4 mr-2" />
                      Add URL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Attach files</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="hover:scale-110 transition-transform duration-200">
                  <Wrench className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Tools</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onSettingsOpen}
                  className="hover:scale-110 transition-transform duration-200"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Model settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground transition-opacity duration-200">{wordCount} words</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs hover:scale-105 transition-transform duration-200"
              >
                {selectedModel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-100 animate-scale-in">
              {Object.entries(modelGroups).map(([group, models]) => (
                <div key={group}>
                  <DropdownMenuLabel className="text-xs">{group}</DropdownMenuLabel>
                  {models.map((model) => (
                    <DropdownMenuItem key={model} onClick={() => setSelectedModel(model)}>
                      {model}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="hover:scale-110 transition-transform duration-200">
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Voice input</p>
              </TooltipContent>
            </Tooltip>

            <GradientButton
              height={9}
              width={9}
              useThemeGradient
              onClick={handleSend}
              disabled={!input.trim() && attachedFiles.length === 0}
              glowIntensity="high"
              icon={isEditing ? <Pencil className="size-4" /> : <Send className="size-4" />}
              className="p-0 text-white"
            >
            </GradientButton>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col relative z-10">
      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          hasMessages ? "p-4" : "flex items-center justify-center",
        )}
      >
        {!hasMessages ? (
          <div className="max-w-3xl w-full space-y-8 animate-slide-up">
            {/* Greeting */}
            <div className="text-center space-y-4">
              <div className="inline-block">
                <div className="text-6xl font-bold bg-linear-to-r from-(--gradient-from) via-(--gradient-via) to-(--gradient-to) bg-clip-text text-transparent animate-pulse">
                  Horizon
                </div>
                <div className="text-sm text-muted-foreground mt-2 animate-slide-up" style={{ animationDelay: "0.1s" }}>
                  by Singularity.ai
                </div>
              </div>
              <p className="text-xl text-muted-foreground animate-slide-up" style={{ animationDelay: "0.2s" }}>
                Experience the event horizon of AI conversations
              </p>
            </div>

            {/* Chat Input (Centered) */}
            <div className="space-y-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
              {renderChatInput()}

              {/* Suggested Prompts */}
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    className="cursor-pointer transition-all duration-200 hover:scale-105 hover-lift hover-glow stagger-item glass-badge"
                    style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onEdit={handleEdit}
                onRetry={handleRetry}
                onFork={handleFork}
                onSpeak={handleSpeak}
                onSummarize={handleSummarize}
                onShare={handleShare}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat Input (Bottom) - Only shown when there are messages */}
      {hasMessages && (
        <div className="border-t border-border p-4 animate-slide-up">
          <div className="max-w-4xl mx-auto">{renderChatInput()}</div>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
    </div>
  )
}