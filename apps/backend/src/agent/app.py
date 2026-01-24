import os
from fastapi import FastAPI
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from agent.graph import build_graph, AgentState
from agent.config import AgentConfig

app = FastAPI()

graph = build_graph()


@app.get("/health")
async def health():
    return {"status": "healthy"}
