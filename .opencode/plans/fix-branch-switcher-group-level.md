# Plan: Fix Branch Switcher for Agentic Flow

## Understanding from Docs

### LangGraph Branching Patterns:

**Edit Message** (creates new branch):
```typescript
stream.submit(
  { messages: [{ ...originalMsg, content: newText }] },
  { checkpoint: metadata.firstSeenState?.parent_checkpoint }
);
```

**Regenerate/Retry** (regenerates AI response):
```typescript
stream.submit(undefined, { checkpoint: metadata.firstSeenState?.parent_checkpoint });
```

### Key Insight:
- **Edit** = Submit NEW content → creates branch
- **Regenerate/Repeat** = Submit UNDEFINED (no new input) → regenerates AI response from same checkpoint
- **Both** use `parent_checkpoint` (state BEFORE this message)

---

## Structure
```
Group N:
├── User Message (user-1) ← BranchSwitcher HERE
│   ├── branch, branchOptions from USER message metadata
│   └── parent_checkpoint for edit/repeat
├── AI Message 1 (tool calls)
├── AI Message 2 (reasoning)
└── AI Message 3 (final response)
```

### What Should Happen:
1. Branch metadata extracted from **user message** → belongs to entire group
2. **BranchSwitcher** at **user bubble** (where edit/repeat originate)
3. **Repeat** = `submit(undefined, { checkpoint })` → regenerates AI response
4. **Edit** = `submit({ messages: [...] }, { checkpoint })` → creates new branch
5. Each BranchSwitcher is **independent** - state NOT shared between groups

---

## Implementation Plan

### Phase 1: Update `MessageGroup` interface in `message-grouping.ts`

**Add checkpoint storage:**
```typescript
export interface MessageGroup {
  // ... existing fields
  /** User message's checkpoint data - used for edit/repeat operations */
  userMessageCheckpoint?: {
    checkpoint?: { checkpoint_id: string };
    parent_checkpoint?: { checkpoint_id: string };
  };
}
```

### Phase 2: Update `groupMessages()` in `message-grouping.ts`

**When creating group for user message:**
```typescript
if (msg.type === "human") {
  const userMetadata = chat.getMessagesMetadata(msg);
  
  currentGroup = {
    id: `group-${msg.id || i}`,
    userMessage: { ... },
    userAttachments,
    toolSteps: [],
    assistantMessage: null,
    firstAssistantMessageId: undefined,
    isLastGroup: false,
    branch: userMetadata?.branch,              // From USER message
    branchOptions: userMetadata?.branchOptions, // From USER message
    userMessageCheckpoint: userMetadata?.firstSeenState, // For edit/repeat
  };
}
```

**For AI messages in existing group:** DO NOT overwrite branch/branchOptions - preserve user's metadata.

### Phase 3: Update `MessageGroupProps` in `message-group.tsx`

**Add props:**
```typescript
interface MessageGroupProps {
  // ... existing
  /** User message's checkpoint for edit/repeat */
  userMessageCheckpoint?: {
    checkpoint?: { checkpoint_id: string };
    parent_checkpoint?: { checkpoint_id: string };
  };
}
```

### Phase 4: Add BranchSwitcher + Repeat to User Bubble in `message-group.tsx`

**Pass props to ChatBubble for user message:**
```tsx
{userMessage && (
  <ChatBubble
    message={userMessage}
    onEdit={onEdit}
    onDelete={onDelete}
    isLastGroup={isLastGroup}
    isLoading={isLoading}
    branch={branch}                    // For BranchSwitcher
    branchOptions={branchOptions}      // For BranchSwitcher
    onBranchChange={onBranchChange}    // For BranchSwitcher
    userMessageCheckpoint={userMessageCheckpoint} // For onRepeat
  />
)}
```

### Phase 5: Update `ChatBubbleProps` in `chat-bubble.tsx`

**Add props:**
```typescript
interface ChatBubbleProps {
  // ... existing
  branch?: string;
  branchOptions?: string[];
  onBranchChange?: (branch: string) => void;
  /** User message's checkpoint - used for repeat action */
  userMessageCheckpoint?: {
    checkpoint?: { checkpoint_id: string };
    parent_checkpoint?: { checkpoint_id: string };
  };
}
```

### Phase 6: Add Repeat Button + BranchSwitcher to User Bubble in `chat-bubble.tsx`

**Add to user action bar (near Edit button):**

```tsx
{/* User message action bar */}
{isUser && showActions && (
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-row-reverse">
    {/* Copy - existing */}
    <Button onClick={handleCopy} ... />
    
    {/* Repeat button - NEW */}
    {userMessageCheckpoint && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Repeat message (regenerates AI response)"
          >
            <RotateCw className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Repeat message</p>
        </TooltipContent>
      </Tooltip>
    )}
    
    {/* BranchSwitcher - NEW, each instance is independent */}
    {branchOptions && branchOptions.length > 1 && (
      <BranchSwitcher
        branch={branch}
        branchOptions={branchOptions}
        onSelect={(b) => onBranchChange?.(b)}
        size="sm"
      />
    )}
    
    {/* Edit - existing */}
    {onEdit && <Button onClick={handleEditClick} ... />}
  </div>
)}
```

### Phase 7: Add `handleRepeat` in `chat-area.tsx`

**Follows "regenerate" pattern from docs:**
```typescript
const handleRepeat = useCallback(
  (messageId: string) => {
    // Find the group containing this user message
    const group = messageGroups.find(g => g.userMessage?.id === messageId);
    if (!group?.userMessageCheckpoint) {
      toast.error("Cannot repeat: checkpoint not available");
      return;
    }

    const checkpoint = group.userMessageCheckpoint.parent_checkpoint;
    if (!checkpoint) {
      toast.error("Cannot repeat: no parent checkpoint");
      return;
    }

    // Submit undefined (no new input) - just regenerate AI response
    chat.submit(undefined, { checkpoint });
    toast.success("Regenerating response...");
  },
  [chat, messageGroups]
);
```

### Phase 8: Update `handleEdit` to use user message checkpoint

```typescript
const handleEdit = useCallback(
  (messageId: string, content: string, isLastGroup: boolean) => {
    // Find group for this message
    const group = messageGroups.find(g => g.userMessage?.id === messageId);
    const checkpoint = group?.userMessageCheckpoint?.parent_checkpoint;

    if (!checkpoint) {
      toast.error("Cannot edit: checkpoint not available");
      return;
    }

    // Submit with new content - creates new branch
    chat.submit(
      { messages: [{ type: "human", content }] },
      { checkpoint }
    );
    toast.success(isLastGroup ? "Created new branch" : "Replacing conversation");
  },
  [chat, messageGroups]
);
```

### Phase 9: Remove BranchSwitcher from Assistant Actions in `message-group.tsx`

**Remove from lines ~192-198:**
- Delete the `{isLastGroup && branchOptions && branchOptions.length > 1 && ...}` block
- BranchSwitcher is ONLY at user bubble now

### Phase 10: Pass `onRepeat` from `chat-area.tsx` to `MessageGroup`

**In `chat-area.tsx` render:**
```tsx
<MessageGroup
  ...
  onRepeat={handleRepeat}  // NEW
  ...
/>
```

---

## File Changes Summary

| Phase | File | Changes |
|-------|------|---------|
| 1-2 | `message-grouping.ts` | Add `userMessageCheckpoint` to group, extract branch from user message |
| 3-4 | `message-group.tsx` | Add checkpoint prop, pass user bubble controls, REMOVE BranchSwitcher from assistant |
| 5-6 | `chat-bubble.tsx` | Add branch/repeat props, add BranchSwitcher + Repeat to user actions |
| 7-8 | `chat-area.tsx` | Add `handleRepeat`, update `handleEdit` to use group checkpoint |
| 9 | `message-group.tsx` | Remove BranchSwitcher from assistant section |
| 10 | `chat-area.tsx` | Pass `onRepeat` to MessageGroup |

---

## Key Points

1. **BranchSwitcher location**: User bubble ONLY (where edit/repeat originate)
2. **Each BranchSwitcher is independent**: Each group has its own instance, state not shared
3. **Repeat follows regenerate pattern**: `submit(undefined, { checkpoint })` - no new input
4. **Edit follows edit pattern**: `submit({ messages: [...] }, { checkpoint })` - with new content
5. **Checkpoint source**: `group.userMessageCheckpoint.parent_checkpoint` (user message's)

---

## Testing Checklist

- [ ] Edit user message → creates branch, BranchSwitcher appears on user bubble
- [ ] Repeat user message → regenerates AI response (no new input sent)
- [ ] Switch branch on user bubble → conversation updates to that branch
- [ ] Multiple branches → BranchSwitcher shows on each user bubble independently
- [ ] Edit on non-last group → confirmation dialog, then branch creation
- [ ] First message (root) edit → works with root checkpoint
- [ ] Switch branch on Group 1 does NOT affect Group 2's BranchSwitcher (independent state)
