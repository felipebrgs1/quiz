export type QuestionId =
  | "captacao"
  | "pre_venda"
  | "fechamento"
  | "pos_venda_indicacao"
  | "pos_venda_acompanhamento";

export type QuestionType = "single";

export type QuestionOption = {
  value: string;
  label: string;
  /** Pontos da alternativa (1 a 4). Nunca exibidos no quiz. */
  score: number;
};

export type QuizQuestion = {
  id: QuestionId;
  /** Pilar avaliado — exibido como gargalo no resultado. */
  pillar: string;
  title: string;
  subtitle?: string;
  type: QuestionType;
  options: QuestionOption[];
};

export type QuizAnswers = Record<QuestionId, string | undefined>;

export const quizQuestions: QuizQuestion[] = [
  {
    id: "captacao",
    pillar: "Captação",
    type: "single",
    title: "Hoje, como a maioria dos seus clientes chegam até você?",
    options: [
      { value: "boca_boca", label: "Só indicação de conhecidos, boca a boca", score: 1 },
      { value: "redes_sem_estrategia", label: "Indicação + redes sociais, mas sem estratégia definida", score: 2 },
      { value: "pago_sem_funil", label: "Tenho tráfego pago ou marketing ativo, mas sem funil estruturado", score: 3 },
      { value: "captacao_estruturada", label: "Tenho canal de captação estruturado — tráfego pago, funil e CRM", score: 4 },
    ],
  },
  {
    id: "pre_venda",
    pillar: "Pré-venda / Atendimento",
    type: "single",
    title: "Quando um cliente em potencial te procura, o que acontece?",
    options: [
      { value: "eu_atendo", label: "Eu mesmo atendo, sem processo, quando sobra tempo", score: 1 },
      { value: "alguem_sem_processo", label: "Tenho alguém que atende, mas sem script ou processo claro", score: 2 },
      { value: "processo_sem_crm", label: "Tenho atendimento com processo definido, mas ainda sem CRM", score: 3 },
      { value: "pre_venda_crm", label: "Tenho pré-venda estruturada, com CRM e follow-up automatizado", score: 4 },
    ],
  },
  {
    id: "fechamento",
    pillar: "Fechamento",
    type: "single",
    title: "Qual sua taxa de conversão aproximada — de quem entra em contato até fechar contrato?",
    options: [
      { value: "nunca_medi", label: "Não sei, nunca medi", score: 1 },
      { value: "abaixo_20", label: "Abaixo de 20%", score: 2 },
      { value: "entre_20_40", label: "Entre 20% e 40%", score: 3 },
      { value: "acima_40", label: "Acima de 40%, com processo replicável", score: 4 },
    ],
  },
  {
    id: "pos_venda_indicacao",
    pillar: "Pós-venda — geração de indicações",
    type: "single",
    title: "Depois que o caso é fechado, o que você faz pra gerar novos clientes a partir dele?",
    options: [
      { value: "nada", label: "Nada, o cliente vai embora", score: 1 },
      { value: "indicacao_informal", label: "Peço indicação informalmente, às vezes", score: 2 },
      { value: "followup_nao_sistematico", label: "Tenho follow-up, mas não é sistemático", score: 3 },
      { value: "programa_embaixadores", label: "Tenho programa estruturado de indicação/embaixadores", score: 4 },
    ],
  },
  {
    id: "pos_venda_acompanhamento",
    pillar: "Pós-venda — acompanhamento do cliente",
    type: "single",
    title: "Depois que o contrato é assinado, como é o acompanhamento do cliente durante o processo?",
    options: [
      { value: "so_no_fim", label: "O cliente só recebe notícia quando o processo termina", score: 1 },
      { value: "satisfacao_sem_prazo", label: "Eu ou minha equipe damos satisfação de vez em quando, sem prazo fixo", score: 2 },
      { value: "atualizacoes_manuais", label: "Temos atualizações periódicas, mas tudo feito manualmente", score: 3 },
      { value: "comunicacao_estruturada", label: "Temos processo estruturado de comunicação, com prazos definidos e ferramenta de acompanhamento — CRM ou portal do cliente", score: 4 },
    ],
  },
];

export type TierId = "artesanal" | "transicao" | "estruturado" | "maquina";

export const TIERS: Record<TierId, { stage: number; name: string; min: number; max: number; description: string }> = {
  artesanal: {
    stage: 1,
    name: "Escritório Artesanal",
    min: 5,
    max: 8,
    description: "depende 100% de você, cresce por sorte e indicação, sem nenhum processo replicável.",
  },
  transicao: {
    stage: 2,
    name: "Escritório em Transição",
    min: 9,
    max: 12,
    description: "já tem peças soltas, mas nada conversando entre si.",
  },
  estruturado: {
    stage: 3,
    name: "Escritório Estruturado",
    min: 13,
    max: 16,
    description: "processo rodando em pelo menos 3 dos 4 pilares, falta afinar o resto.",
  },
  maquina: {
    stage: 4,
    name: "Escritório Máquina de Vendas",
    min: 17,
    max: 20,
    description: "os 4 pilares funcionando de forma redonda.",
  },
};

export function tierForScore(total: number): TierId {
  if (total <= 8) return "artesanal";
  if (total <= 12) return "transicao";
  if (total <= 16) return "estruturado";
  return "maquina";
}

export type DiagnosticScore = {
  questionId: QuestionId;
  pillar: string;
  score: number;
};

export type Diagnostic = {
  total: number;
  tier: TierId;
  perQuestion: DiagnosticScore[];
  /** Pilares com a nota mais baixa (pode haver empate). */
  bottleneck: string[];
};

export function scoreDiagnostic(answers: QuizAnswers): Diagnostic {
  const perQuestion = quizQuestions.map((q) => ({
    questionId: q.id,
    pillar: q.pillar,
    score: q.options.find((o) => o.value === answers[q.id])?.score ?? 0,
  }));
  const total = perQuestion.reduce((sum, s) => sum + s.score, 0);
  const min = Math.min(...perQuestion.map((s) => s.score));
  const bottleneck = [...new Set(perQuestion.filter((s) => s.score === min).map((s) => s.pillar))];
  return { total, tier: tierForScore(total), perQuestion, bottleneck };
}

export function bottleneckText(bottleneck: string[]) {
  return bottleneck.join(" e ");
}

export const quizIntro = {
  seal: "Diagnóstico gratuito · Evento",
  title: "Em que estágio está o seu escritório?",
  text: "5 perguntas rápidas sobre captação, atendimento, fechamento e pós-venda. Leva menos de 1 minuto e você descobre seu estágio + maior gargalo na hora.",
  button: "Fazer meu diagnóstico",
};

export const leadCapture = {
  title: "Quase lá — registre seu Raio-X",
  subtitle: "Informe seu nome e WhatsApp para validar seu diagnóstico gratuito no estande.",
};

export function getOptionLabel(questionId: QuestionId, value: string) {
  return (
    quizQuestions
      .find((q) => q.id === questionId)
      ?.options.find((o) => o.value === value)?.label ?? value
  );
}

export function getAnswerLabel(questionId: QuestionId, answer: unknown) {
  if (typeof answer === "string") return getOptionLabel(questionId, answer);
  return "Não respondido";
}

export function getAnswerScore(questionId: QuestionId, answer: unknown) {
  if (typeof answer !== "string") return 0;
  return quizQuestions.find((q) => q.id === questionId)?.options.find((o) => o.value === answer)?.score ?? 0;
}
