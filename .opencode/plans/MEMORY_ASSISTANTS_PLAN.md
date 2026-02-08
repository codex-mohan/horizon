# Implementation Plan: Long-Term Memory, Hybrid RAG, and LangGraph Assistants

## Overview

This plan covers implementing:

1. **Long-term Memory** with graph-based hybrid RAG for user preferences
2. **LangGraph Assistants** - Create, manage, and use custom AI assistants
3. **Enhanced UI** - List/Grid views with animations and image badges

---

## Phase 1: Long-Term Memory & Hybrid RAG

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Memory System                            │
├─────────────────────────────────────────────────────────────┤
│  Vector Store (ChromaDB)    │  Graph DB (Neo4j)              │
│  - Conversation embeddings  │  - User preferences            │
│  - Document chunks          │  - Entity relationships        │
│  - Tool results             │  - Conversation topics         │
│  - Important facts          │  - Temporal connections        │
└─────────────────────────────┴────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Hybrid Retriever │
                    │  - Semantic search │
                    │  - Graph traversal │
                    │  - Recency bias    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Context Injector │
                    │  (into prompts)   │
                    └──────────────────┘
```

### 1.2 Database Schema

#### Vector Store (ChromaDB Collections)

```typescript
// Collection: conversation_memories
{
  id: string;
  embedding: number[];  // 1536-dim (OpenAI) or 768-dim (local)
  metadata: {
    user_id: string;
    thread_id: string;
    message_id: string;
    timestamp: string;
    memory_type: "conversation" | "fact" | "preference" | "document";
    importance: number;  // 0-1 score
  }
  document: string;  // The actual text content
}

// Collection: user_preferences
{
  id: string;
  embedding: number[];
  metadata: {
    user_id: string;
    preference_type: "style" | "topic" | "tool" | "format";
    confidence: number;
    source_message_id: string;
  }
  document: string;  // e.g., "User prefers concise answers with code examples"
}
```

#### Graph Database (Neo4j)

```cypher
// Nodes
(:User {id, name, created_at})
(:Conversation {id, thread_id, summary, created_at, updated_at})
(:Topic {name, category})
(:Entity {name, type, metadata})
(:Preference {key, value, confidence, source})

// Relationships
(:User)-[:HAS_CONVERSATION]->(:Conversation)
(:User)-[:HAS_PREFERENCE]->(:Preference)
(:Conversation)-[:HAS_TOPIC]->(:Topic)
(:Conversation)-[:MENTIONS]->(:Entity)
(:Conversation)-[:FOLLOWS]->(:Conversation)  // Temporal link
(:Topic)-[:RELATED_TO]->(:Topic)
```

### 1.3 Implementation Files

**Backend:**

1. `apps/backend/src/memory/vector-store.ts` - ChromaDB integration
2. `apps/backend/src/memory/graph-store.ts` - Neo4j integration
3. `apps/backend/src/memory/hybrid-retriever.ts` - Combined retrieval logic
4. `apps/backend/src/memory/context-injector.ts` - Prompt augmentation
5. `apps/backend/src/memory/preference-extractor.ts` - Extract preferences from conversations

**Packages:** 6. `packages/agent-memory/src/index.ts` - Memory client exports 7. `packages/agent-memory/src/vector/` - Vector store operations 8. `packages/agent-memory/src/graph/` - Graph operations

### 1.4 Memory Operations

```typescript
// Store conversation turn
await memory.storeConversationTurn({
  user_id: "user-123",
  thread_id: "thread-456",
  message_id: "msg-789",
  content: "I prefer Python over JavaScript",
  timestamp: new Date(),
  importance: 0.8,
});

// Retrieve relevant context
const context = await memory.retrieve({
  query: "What programming languages does the user like?",
  user_id: "user-123",
  top_k: 5,
  recency_weight: 0.3,
});

// Extract and store preferences
await memory.extractPreferences(thread_id, user_id);

// Query user preferences graph
const prefs = await memory.getUserPreferences(user_id);
```

### 1.5 Integration with Agent

Modify `apps/backend/src/agent/nodes/agent.ts`:

```typescript
const agentNode = async (state: AgentState, config: RunnableConfig) => {
  // Retrieve relevant memories
  const memories = await memory.retrieve({
    query: state.messages[state.messages.length - 1].content,
    user_id: config.configurable?.user_id,
    top_k: 3,
  });

  // Augment prompt with memories
  const augmentedMessages = [
    new SystemMessage(`Relevant context: ${memories.join("\n")}`),
    ...state.messages,
  ];

  // Call LLM with augmented context
  const response = await llm.invoke(augmentedMessages);

  // Store important facts from response
  await memory.extractAndStore(response, user_id);

  return { messages: [response] };
};
```

---

## Phase 2: LangGraph Assistants

### 2.1 Assistant Data Model

```typescript
interface Assistant {
  id: string; // UUID
  user_id: string; // Owner
  name: string; // Display name
  description: string; // Short description
  avatar_url?: string; // Image URL/base64
  system_prompt: string; // System instructions
  model_config: {
    provider: "openai" | "anthropic" | "groq" | "ollama";
    model: string;
    temperature: number;
    max_tokens: number;
  };
  tools: string[]; // Enabled tool names
  memory_enabled: boolean; // Use long-term memory
  is_default: boolean; // Is default assistant
  is_public: boolean; // Shareable with others
  created_at: Date;
  updated_at: Date;
}
```

### 2.2 Database Schema

```sql
-- Assistants table
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  system_prompt TEXT NOT NULL,
  model_provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  tools JSONB DEFAULT '[]',
  memory_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Assistant usage stats
CREATE TABLE assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES assistants(id),
  user_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  message_count INTEGER DEFAULT 0,
  token_usage JSONB DEFAULT '{}',
  last_used TIMESTAMP DEFAULT NOW()
);
```

### 2.3 API Endpoints

**Assistants API:**

```typescript
// apps/backend/src/index.ts additions

// Create assistant
POST /assistants
Body: { name, description, system_prompt, model_config, tools, memory_enabled, avatar }

// List assistants
GET /assistants?user_id=xxx&include_public=true

// Get assistant
GET /assistants/:id

// Update assistant
PUT /assistants/:id

// Delete assistant
DELETE /assistants/:id

// Set default assistant
POST /assistants/:id/default

// Clone assistant (public ones)
POST /assistants/:id/clone
```

### 2.4 LangGraph Integration

Create `apps/backend/src/agent/assistant-graph.ts`:

```typescript
// Graph that uses assistant configuration
export function createAssistantGraph(assistant: Assistant) {
  return new StateGraph(AgentStateAnnotation)
    .addNode("agent", createAgentNode(assistant))
    .addNode("tools", new ToolNode(getToolsForAssistant(assistant)))
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile({ checkpointer });
}

// Agent node uses assistant's system prompt and model
const createAgentNode = (assistant: Assistant) => async (state: AgentState) => {
  const llm = createLLM(assistant.model_config);
  const systemPrompt = new SystemMessage(assistant.system_prompt);
  // ... rest of logic
};
```

---

## Phase 3: Enhanced Assistants UI

### 3.1 View Components Architecture

```
components/assistants/
├── AssistantView.tsx              # Main view container
├── AssistantList.tsx              # List view component
├── AssistantGrid.tsx              # Grid view component
├── AssistantCard.tsx              # Card component (used in both views)
├── AssistantListItem.tsx          # List item component
├── CreateAssistantDialog.tsx      # Create new assistant
├── EditAssistantDialog.tsx        # Edit assistant
├── ViewToggle.tsx                 # List/Grid toggle button
├── SortDropdown.tsx               # Sort options
└── AssistantDetailSheet.tsx       # Side panel for details
```

### 3.2 List View Design

```tsx
// List View - Similar to current "my-items" list
<div className="space-y-2">
  {assistants.map((assistant) => (
    <div
      className="flex items-center gap-4 p-4 glass rounded-lg 
                    hover:bg-primary/10 transition-all duration-300
                    group cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar
          className="size-12 ring-2 ring-primary/20 
                          group-hover:ring-primary/50 transition-all"
        >
          <AvatarImage src={assistant.avatar_url} />
          <AvatarFallback>{assistant.name[0]}</AvatarFallback>
        </Avatar>
        {assistant.is_default && (
          <Badge
            className="absolute -top-1 -right-1 size-5 p-0 
                          flex items-center justify-center"
          >
            <Star className="size-3" />
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{assistant.name}</h3>
          {assistant.memory_enabled && (
            <Brain className="size-4 text-primary" />
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {assistant.description}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{assistant.model_config.model}</span>
          <span>•</span>
          <span>{assistant.tools.length} tools</span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="opacity-0 group-hover:opacity-100 
                    transition-opacity flex items-center gap-2"
      >
        <Button variant="ghost" size="icon" onClick={() => select(assistant)}>
          <MessageSquare className="size-4" />
        </Button>
        <DropdownMenu>
          {/* Edit, Duplicate, Delete, Set Default */}
        </DropdownMenu>
      </div>
    </div>
  ))}
</div>
```

### 3.3 Grid View Design

```tsx
// Grid View with Framer Motion animations
<motion.div
  layout
  className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
>
  <AnimatePresence mode="popLayout">
    {assistants.map((assistant) => (
      <motion.div
        key={assistant.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          layout: { duration: 0.3 },
        }}
        className="group relative aspect-square glass rounded-xl overflow-hidden
                  cursor-pointer hover:shadow-2xl hover:shadow-primary/20"
        onClick={() => select(assistant)}
      >
        {/* Background Gradient */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 
                      to-accent/5 opacity-0 group-hover:opacity-100 
                      transition-opacity duration-500"
        />

        {/* Avatar - Large centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative"
            whileHover={{ scale: 1.1, rotate: 2 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Avatar
              className="size-24 ring-4 ring-background/50 
                             group-hover:ring-primary/30 transition-all duration-500"
            >
              <AvatarImage src={assistant.avatar_url} />
              <AvatarFallback className="text-4xl">
                {assistant.name[0]}
              </AvatarFallback>
            </Avatar>

            {/* Default badge */}
            {assistant.is_default && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-primary text-primary-foreground
                          rounded-full p-1.5 shadow-lg"
              >
                <Star className="size-4 fill-current" />
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Info Overlay - Appears on hover */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t 
                    from-background/90 to-transparent"
        >
          <h3 className="font-semibold text-lg truncate">{assistant.name}</h3>
          <p
            className="text-sm text-muted-foreground line-clamp-2 
                       group-hover:line-clamp-3 transition-all"
          >
            {assistant.description}
          </p>

          {/* Quick Actions */}
          <div
            className="flex items-center gap-2 mt-3 opacity-0 
                        group-hover:opacity-100 transition-opacity"
          >
            <Button size="sm" className="flex-1">
              <MessageSquare className="size-4 mr-2" />
              Chat
            </Button>
            <Button size="sm" variant="ghost">
              <Settings className="size-4" />
            </Button>
          </div>
        </motion.div>

        {/* Top Right Actions */}
        <div
          className="absolute top-3 right-3 flex gap-1 opacity-0 
                      group-hover:opacity-100 transition-opacity"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="glass">
                <Brain className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Memory enabled</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="glass">
                <MoreHorizontal className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Set as Default</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    ))}
  </AnimatePresence>
</motion.div>
```

### 3.4 View Toggle Component

```tsx
// View Toggle with smooth animation
<div className="flex items-center gap-2 bg-muted rounded-lg p-1">
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={() => setViewMode("list")}
    className={cn(
      "relative p-2 rounded-md transition-colors",
      viewMode === "list" ? "text-foreground" : "text-muted-foreground",
    )}
  >
    {viewMode === "list" && (
      <motion.div
        layoutId="activeView"
        className="absolute inset-0 bg-background rounded-md shadow-sm"
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    )}
    <List className="size-4 relative z-10" />
  </motion.button>

  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={() => setViewMode("grid")}
    className={cn(
      "relative p-2 rounded-md transition-colors",
      viewMode === "grid" ? "text-foreground" : "text-muted-foreground",
    )}
  >
    {viewMode === "grid" && (
      <motion.div
        layoutId="activeView"
        className="absolute inset-0 bg-background rounded-md shadow-sm"
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    )}
    <Grid3x3 className="size-4 relative z-10" />
  </motion.button>
</div>
```

---

## Phase 4: Integration & Store Management

### 4.1 Zustand Store

```typescript
// apps/web/lib/stores/assistants.ts
interface AssistantsState {
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  defaultAssistant: Assistant | null;
  viewMode: "list" | "grid";
  sortBy: "name" | "date" | "usage";
  isLoading: boolean;

  // Actions
  fetchAssistants: () => Promise<void>;
  createAssistant: (data: CreateAssistantData) => Promise<Assistant>;
  updateAssistant: (id: string, data: Partial<Assistant>) => Promise<void>;
  deleteAssistant: (id: string) => Promise<void>;
  setDefaultAssistant: (id: string) => Promise<void>;
  selectAssistant: (assistant: Assistant) => void;
  setViewMode: (mode: "list" | "grid") => void;
  setSortBy: (sort: "name" | "date" | "usage") => void;
}
```

### 4.2 API Client

```typescript
// apps/web/lib/assistants.ts
export interface AssistantsClient {
  list: (filters?: AssistantFilters) => Promise<Assistant[]>;
  get: (id: string) => Promise<Assistant>;
  create: (data: CreateAssistantData) => Promise<Assistant>;
  update: (id: string, data: Partial<Assistant>) => Promise<Assistant>;
  delete: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  clone: (id: string) => Promise<Assistant>;
}

export const createAssistantsClient = (apiUrl: string): AssistantsClient => ({
  // Implementation
});
```

---

## Phase 5: Implementation Timeline

### Week 1: Foundation

- [ ] Set up ChromaDB and Neo4j infrastructure
- [ ] Create memory packages (@horizon/agent-memory)
- [ ] Implement basic vector store operations
- [ ] Create database schema for assistants

### Week 2: Memory System

- [ ] Implement graph store operations
- [ ] Create hybrid retriever
- [ ] Build preference extractor
- [ ] Integrate memory into agent node
- [ ] Write tests for memory operations

### Week 3: Assistants Backend

- [ ] Create assistants API endpoints
- [ ] Implement CRUD operations
- [ ] Add assistant-graph.ts with configurable agents
- [ ] Create default assistants (General, Code, Research, etc.)

### Week 4: Assistants UI - Core

- [ ] Create assistants store
- [ ] Build AssistantView component
- [ ] Implement list view with all features
- [ ] Add create/edit dialogs

### Week 5: Assistants UI - Polish

- [ ] Implement grid view with Framer Motion
- [ ] Add smooth transitions between views
- [ ] Create assistant card component
- [ ] Add hover effects and animations
- [ ] Implement avatar upload

### Week 6: Integration & Testing

- [ ] Connect sidebar assistants tab
- [ ] Integrate with chat interface
- [ ] Add memory visualization in UI
- [ ] Performance optimization
- [ ] End-to-end testing

---

## Phase 6: Technical Dependencies

### New Packages

```json
// packages/agent-memory/package.json
{
  "dependencies": {
    "chromadb": "^1.8.0",
    "neo4j-driver": "^5.15.0",
    "langchain": "^0.1.0",
    "@langchain/openai": "^0.0.14"
  }
}
```

### Environment Variables

```env
# Vector Store
CHROMA_DB_URL=http://localhost:8000
CHROMA_COLLECTION_NAME=horizon_memories

# Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Embeddings
OPENAI_API_KEY=sk-...
# Or use local embeddings
USE_LOCAL_EMBEDDINGS=true
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### Docker Services

```yaml
# docker-compose.yaml additions
services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma-data:/chroma/chroma

  neo4j:
    image: neo4j:latest
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password
    volumes:
      - neo4j-data:/data
```

---

## Key Design Decisions

1. **Hybrid RAG**: Combines semantic search (vector) with relationship traversal (graph) for better context retrieval
2. **Assistant Configuration**: JSON-based configuration allows flexible customization without code changes
3. **View Modes**: List for quick scanning, Grid for visual browsing - both with smooth Framer Motion transitions
4. **Memory Visualization**: Users can see what the AI remembers about them (transparency builds trust)
5. **Public Assistants**: Community can share assistants, fostering ecosystem growth

---

## Questions for You

1. **Memory Scope**: Should memories be per-user only, or should there be shared/cross-user knowledge?
2. **Privacy**: Should users have granular control over what gets stored? (e.g., "Don't remember this")
3. **Assistant Marketplace**: Do you want a public gallery where users can discover assistants?
4. **Avatar Generation**: Should we integrate AI avatar generation (DALL-E, Midjourney) for assistants?
5. **Memory Limits**: Should we cap memory storage per user? (e.g., last 1000 conversations)

Would you like me to proceed with implementation, or would you like to adjust any aspects of this plan?
