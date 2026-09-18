export type QuestionId =
  | "limitations"
  | "work_situation"
  | "medical_documents"
  | "accident_age"
  | "received_sickness_benefit"
  | "has_lawyer";

export type QuestionType = "single" | "multiple";

export type QuestionOption = {
  value: string;
  label: string;
};

export type QuizQuestion = {
  id: QuestionId;
  title: string;
  subtitle?: string;
  type: QuestionType;
  options: QuestionOption[];
};

export type QuizAnswers = Record<QuestionId, string | string[] | undefined>;

// Mesmo esquema do quiz atual (lib/quiz.ts), sem imagens para o exemplo ficar autocontido.
export const quizQuestions: QuizQuestion[] = [
  {
    id: "limitations",
    type: "single",
    title: "Você ficou com alguma destas limitações após o acidente?",
    subtitle: "Selecione a opção que mais se aplica ao seu caso.",
    options: [
      { value: "pino_placa", label: "Pino ou placa após cirurgia" },
      { value: "dificuldade_andar_correr", label: "Dificuldade para andar ou correr" },
      { value: "perda_forca_braco_mao", label: "Perda de força em braço ou mão" },
      { value: "dor_constante", label: "Dor constante após o acidente" },
      { value: "outra_limitacao", label: "Outra limitação" },
    ],
  },
  {
    id: "work_situation",
    type: "single",
    title: "Na época do acidente, qual era sua situação de trabalho?",
    options: [
      { value: "clt", label: "Trabalhava registrado (CLT)" },
      { value: "rural", label: "Trabalhador rural" },
      { value: "mei", label: "MEI" },
      { value: "autonomo", label: "Autônomo" },
      { value: "desempregado", label: "Desempregado" },
    ],
  },
  {
    id: "medical_documents",
    type: "single",
    title: "Você tem algum atestado, exame ou papel do médico sobre o acidente?",
    options: [
      { value: "sim", label: "Sim" },
      { value: "parcial", label: "Tenho só uma parte dos documentos" },
      { value: "nao", label: "Não" },
    ],
  },
  {
    id: "accident_age",
    type: "single",
    title: "O acidente aconteceu há quanto tempo?",
    options: [
      { value: "menos_1_ano", label: "Menos de 1 ano" },
      { value: "entre_1_3_anos", label: "Entre 1 e 3 anos" },
      { value: "entre_3_5_anos", label: "Entre 3 e 5 anos" },
      { value: "mais_5_anos", label: "Mais de 5 anos" },
    ],
  },
  {
    id: "received_sickness_benefit",
    type: "single",
    title: "Você ficou encostado por conta do seu acidente?",
    options: [
      { value: "sim", label: "Sim" },
      { value: "nao", label: "Não" },
      { value: "nao_sei", label: "Não sei informar" },
    ],
  },
  {
    id: "has_lawyer",
    type: "single",
    title: "Já possui advogado acompanhando este caso?",
    options: [
      { value: "sim", label: "Sim" },
      { value: "nao", label: "Não" },
    ],
  },
];

export const quizIntro = {
  seal: "+5.000 famílias já atendidas",
  title: "Colocou pino ou placa após um acidente?",
  text: "Você pode ter direito a um benefício do INSS pago todo mês, mesmo trabalhando normalmente. São 6 perguntas rápidas, leva menos de 1 minuto.",
  button: "Descobrir se tenho direito",
};

export const leadCapture = {
  title: "Sua análise está prestes a ser concluída",
  subtitle: "Informe seu nome e telefone para o nosso time entrar em contato.",
};

export function getOptionLabel(questionId: QuestionId, value: string) {
  return (
    quizQuestions
      .find((q) => q.id === questionId)
      ?.options.find((o) => o.value === value)?.label ?? value
  );
}

export function getAnswerLabel(questionId: QuestionId, answer: unknown) {
  if (Array.isArray(answer)) {
    return answer.map((v) => getOptionLabel(questionId, String(v))).join(", ");
  }
  if (typeof answer === "string") return getOptionLabel(questionId, answer);
  return "Não respondido";
}
