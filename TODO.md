# PROJECT TODOs

- [x] Reorganise the function in the Frontend @ web
- [] Implement proper sandboxing @ backend
- [] Improve the theme to have more contrast as some UI components are difficult to see.
- [] Make the memory feature functional
- [] Implement features for the dummy logic
- [] Fix the issue when loading conversation and if the user's token expires it is stuck into loading state.
- [] Fix the security when the user is not logged and can still see the chat interface and has user logged in as @username it happens instead of sending the user back to login/signup page

## File Attachments & My Items Storage System

### Phase 1: Basic File Support (In Progress)
- [x] Display attached files in user message bubbles
- [x] Send images as multimodal content (base64) to LangGraph
- [ ] Handle non-image files (PDF, Word, etc.) with text extraction

### Phase 2: Persistent Storage
- [ ] Implement disk/cloud storage for uploaded files
- [ ] Create file upload API endpoint with validation
- [ ] Store file metadata in database

### Phase 3: Document Processing & RAG
- [ ] Integrate Docling or Unstructured for document parsing
- [ ] Support PDF, DOCX, PPTX, HTML parsing
- [ ] Implement text chunking with RecursiveCharacterTextSplitter
- [ ] Connect to vector store (Qdrant) for embeddings

### Phase 4: My Items Panel
- [ ] Display uploaded files in My Items sidebar
- [ ] Show generated files (images, summaries, etc.)
- [ ] File preview and download functionality
- [ ] Delete/manage uploaded files

### Phase 5: Chat with Docs
- [ ] Select files for RAG context
- [ ] Query across multiple documents
- [ ] Citation/source linking in responses
