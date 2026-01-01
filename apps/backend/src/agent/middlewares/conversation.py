from langchain.agents.middleware import dynamic_prompt, ModelRequest, model_call_limit

@dynamic_prompt
def conversation_len_prompt(request: ModelRequest) -> str:
    """Dynamically generate a prompt based on conversation length."""
    messages_count = len(request.messages)
    
    