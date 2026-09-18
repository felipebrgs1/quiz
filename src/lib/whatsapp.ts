import { formatBrazilianPhone, normalizePhone } from "./phone";
import { getAnswerLabel, quizQuestions, type QuestionId, type QuizAnswers } from "./quiz";

export type LeadLike = {
  id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  answers: QuizAnswers;
};

export function getLeadProtocol(lead: LeadLike) {
  return `QZ-${lead.id.slice(0, 8).toUpperCase()}`;
}

export function buildWhatsappUrl(opts: {
  destination: string;
  template: string;
  lead: LeadLike;
}) {
  const digits = normalizePhone(opts.destination);
  if (!digits) return null;
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

  const answersText = quizQuestions
    .map((q) => `${q.title}: ${getAnswerLabel(q.id as QuestionId, opts.lead.answers?.[q.id as QuestionId])}`)
    .join("\n");

  const message = opts.template
    .replace(/{{\s*name\s*}}/g, opts.lead.name)
    .replace(/{{\s*phone\s*}}/g, formatBrazilianPhone(opts.lead.phone_normalized || opts.lead.phone))
    .replace(/{{\s*answers\s*}}/g, answersText)
    .replace(/{{\s*protocol\s*}}/g, getLeadProtocol(opts.lead))
    .trim();

  const url = new URL(`https://wa.me/${phone}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}
