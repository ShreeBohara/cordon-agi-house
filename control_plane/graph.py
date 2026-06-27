"""The contact graph: who handed work to whom.

A thin wrapper over ``networkx.DiGraph``. Edges carry a ``carried_taint`` flag so
the cascade can be computed over the *taint-carrying* sub-graph only — delegation
that never passed tainted data does not spread infection.
"""
from __future__ import annotations

import networkx as nx


class ContactGraph:
    def __init__(self) -> None:
        self.g = nx.DiGraph()

    def add_agent(self, agent_id: str) -> None:
        self.g.add_node(agent_id)

    def add_contact(self, frm: str, to: str, carried_taint: bool = False, reason: str = "handoff") -> None:
        self.g.add_node(frm)
        self.g.add_node(to)
        self.g.add_edge(frm, to, carried_taint=bool(carried_taint), reason=reason)

    # --- taint-carrying sub-graph ---
    def _taint_subgraph(self) -> nx.DiGraph:
        edges = [(u, v) for u, v, d in self.g.edges(data=True) if d.get("carried_taint")]
        return self.g.edge_subgraph(edges) if edges else nx.DiGraph()

    def trace_origin(self, node: str) -> str:
        """Walk back along taint edges to the earliest tainted ancestor (patient zero)."""
        sub = self._taint_subgraph()
        if node not in sub:
            return node
        candidates = nx.ancestors(sub, node) | {node}
        roots = [n for n in candidates if sub.in_degree(n) == 0]
        return roots[0] if roots else node

    def exposed_set(self, origin: str) -> set[str]:
        """{origin} plus everything reachable from it over taint-carrying edges."""
        sub = self._taint_subgraph()
        exposed = {origin}
        if origin in sub:
            exposed |= nx.descendants(sub, origin)
        return exposed

    def quarantine_order(self, origin: str) -> list[str]:
        """The exposed set in topological (infection) order. Cycle-safe."""
        exposed = self.exposed_set(origin)
        sub = self.g.subgraph(exposed)
        try:
            ordered = list(nx.topological_sort(sub))
        except nx.NetworkXUnfeasible:  # cycle guard
            ordered = []
        for n in exposed:  # include any isolated nodes
            if n not in ordered:
                ordered.append(n)
        return ordered

    def descendants(self, node: str) -> set[str]:
        return nx.descendants(self.g, node) if node in self.g else set()

    def ancestors(self, node: str) -> set[str]:
        return nx.ancestors(self.g, node) if node in self.g else set()

    def clear(self) -> None:
        self.g.clear()
