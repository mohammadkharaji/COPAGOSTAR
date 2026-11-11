"""LangGraph StateGraph: recall -> (answer | tool -> answer)."""
from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from . import db as memdb
from . import llm as lllm
from . import sales_tool


class AgentState(TypedDict, total=False):
    question: str
    memories: list[str]
    db_result: str | None
    used_memory: bool
    used_db: bool
    answer: str


def _recall(state: AgentState) -> AgentState:
    rows = memdb.search_memories(state["question"])
    return {"memories": [r.rule or r.question for r in rows], "used_memory": bool(rows)}


def _should_query(state: AgentState) -> str:
    return "tool" if not state.get("memories") else "answer"


def _tool(state: AgentState) -> AgentState:
    return {"db_result": sales_tool.query_sales_db(state["question"]), "used_db": True}


def _build_answer(llm):
    def _answer(state: AgentState) -> AgentState:
        prompt = (
            f"سؤال کاربر: {state['question']}\n"
            f"حافظه موجود: {state.get('memories') or '-'}\n"
            + (f"نتیجه دیتابیس: {state['db_result']}\n" if state.get("db_result") else "")
            + "به فارسی پاسخ بده."
        )
        out = llm.invoke([{"role": "user", "content": prompt}])
        return {"answer": out.content if hasattr(out, "content") else str(out)}
    return _answer


def build_graph(llm=None):
    llm = llm or lllm.get_llm()
    g = StateGraph(AgentState)
    g.add_node("recall", _recall)
    g.add_node("tool", _tool)
    g.add_node("answer", _build_answer(llm))
    g.add_edge(START, "recall")
    g.add_conditional_edges("recall", _should_query, {"tool": "tool", "answer": "answer"})
    g.add_edge("tool", "answer")
    g.add_edge("answer", END)
    return g.compile()


def run(question: str, llm=None) -> dict:
    return build_graph(llm).invoke({"question": question})
