from __future__ import annotations

import ast
from dataclasses import dataclass


@dataclass(frozen=True)
class BusinessRuleMutation:
    operator_id: str
    rule_id: str
    description: str = ""
    line_number: int = 0


class _ActiveEncounterLimitMutator(ast.NodeTransformer):
    def __init__(self) -> None:
        self.applied = False

    def visit_Compare(self, node: ast.Compare) -> ast.AST:
        if self.applied:
            return node
        if (
            isinstance(node.left, ast.Call)
            and isinstance(node.left.func, ast.Attribute)
            and node.left.func.attr == "count"
            and any(isinstance(op, ast.GtE) for op in node.ops)
        ):
            node.ops = [ast.LtE()]
            self.applied = True
        return node


class _RestartEligibilityMutator(ast.NodeTransformer):
    def __init__(self) -> None:
        self.applied = False

    def visit_Compare(self, node: ast.Compare) -> ast.AST:
        if self.applied:
            return node
        if isinstance(node.left, ast.Attribute) and node.left.attr == "modified_date":
            node.ops = [ast.Gt()]
            self.applied = True
        return node


class _StatusHistoryMutator(ast.NodeTransformer):
    def __init__(self) -> None:
        self.applied = False

    def visit_Compare(self, node: ast.Compare) -> ast.AST:
        if self.applied:
            return node
        if node.ops and isinstance(node.ops[0], ast.NotEq):
            node.ops = [ast.Eq()]
            self.applied = True
        return node


def apply_operator(source: str, operator_id: str) -> str:
    tree = ast.parse(source)
    mutators = {
        "BR01_ACTIVE_LIMIT_COMPARISON": _ActiveEncounterLimitMutator(),
        "BR06_RESTART_ELAPSED_TIME": _RestartEligibilityMutator(),
        "BR03_STATUS_HISTORY_CHANGE": _StatusHistoryMutator(),
    }
    mutator = mutators.get(operator_id)
    if mutator is None:
        raise ValueError(f"Unknown business-rule mutation operator: {operator_id}")
    mutated = ast.fix_missing_locations(mutator.visit(tree))
    if not mutator.applied:
        raise RuntimeError(
            f"Operator {operator_id} did not find its business-rule target"
        )
    return ast.unparse(mutated)


def operator_catalog() -> tuple[BusinessRuleMutation, ...]:
    return (
        BusinessRuleMutation(
            operator_id="BR01_ACTIVE_LIMIT_COMPARISON",
            rule_id="BR-ENC-01",
            description="Changes active encounter limit comparison to the opposite boundary.",
        ),
        BusinessRuleMutation(
            operator_id="BR06_RESTART_ELAPSED_TIME",
            rule_id="BR-ENC-06",
            description="Changes restart elapsed-time comparison while preserving the other eligibility conditions.",
        ),
        BusinessRuleMutation(
            operator_id="BR03_STATUS_HISTORY_CHANGE",
            rule_id="BR-ENC-03",
            description="Changes status-change inequality to equality.",
        ),
    )
