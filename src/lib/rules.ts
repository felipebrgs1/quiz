import type { QuestionId, QuizAnswers } from "./quiz";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains_any"
  | "contains_all"
  | "not_contains_any"
  | "is_answered";

export type RuleCondition = {
  questionId: QuestionId;
  operator: ConditionOperator;
  values: string[];
};

export type RuleGroup = {
  logic: "all" | "any";
  conditions: RuleCondition[];
};

export type QualificationRule = {
  id: string | null;
  name: string;
  enabled: boolean;
  priority: number;
  outcome: "qualified" | "unqualified";
  root_logic: "all" | "any";
  groups: RuleGroup[];
};

export type QualificationStatus = "qualified" | "unqualified" | "pending_rules";

export type EvaluationResult = {
  status: QualificationStatus;
  qualified: boolean;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  trace: unknown[];
};

// Mesma lógica de lib/rules.ts do app Next — pura, sem dependência de banco.
export function evaluateRules(answers: QuizAnswers, rules: QualificationRule[]): EvaluationResult {
  const active = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

  if (active.length === 0) {
    return { status: "qualified", qualified: true, matchedRuleId: null, matchedRuleName: null, trace: [] };
  }

  for (const rule of active) {
    const groupResults = rule.groups.map((g) => {
      const condResults = g.conditions.map((c) => evaluateCondition(answers, c));
      return g.logic === "any" ? condResults.some(Boolean) : condResults.every(Boolean);
    });
    const passed = rule.root_logic === "any" ? groupResults.some(Boolean) : groupResults.every(Boolean);
    if (passed) {
      return {
        status: rule.outcome,
        qualified: rule.outcome === "qualified",
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        trace: [{ ruleId: rule.id, name: rule.name, outcome: rule.outcome }],
      };
    }
  }

  return { status: "qualified", qualified: true, matchedRuleId: null, matchedRuleName: null, trace: [] };
}

function evaluateCondition(answers: QuizAnswers, condition: RuleCondition): boolean {
  const answer = answers[condition.questionId];
  const values = Array.isArray(answer) ? answer : typeof answer === "string" && answer ? [answer] : [];

  switch (condition.operator) {
    case "is_answered":
      return values.length > 0;
    case "equals":
      return values.length === 1 && values[0] === condition.values[0];
    case "not_equals":
      return values.length === 0 || values[0] !== condition.values[0];
    case "contains_any":
      return condition.values.some((v) => values.includes(v));
    case "contains_all":
      return condition.values.every((v) => values.includes(v));
    case "not_contains_any":
      return condition.values.every((v) => !values.includes(v));
    default:
      return false;
  }
}
