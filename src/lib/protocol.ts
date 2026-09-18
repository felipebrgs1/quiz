/** Código curto para identificar o diagnóstico no estande. */
export function getLeadProtocol(lead: { id: string }) {
  return `QZ-${lead.id.slice(0, 8).toUpperCase()}`;
}
