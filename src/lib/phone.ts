export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatBrazilianPhone(phone: string) {
  const digits = normalizePhone(phone);
  const withoutCC =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  if (withoutCC.length <= 10) {
    const ddd = withoutCC.slice(0, 2);
    const p1 = withoutCC.slice(2, 6);
    const p2 = withoutCC.slice(6, 10);
    return [`${ddd ? `(${ddd}` : ""}`, `${ddd.length === 2 ? ") " : ""}`, p1, p2 ? `-${p2}` : ""].join("");
  }

  const ddd = withoutCC.slice(0, 2);
  const p1 = withoutCC.slice(2, 7);
  const p2 = withoutCC.slice(7, 11);
  return [`${ddd ? `(${ddd}` : ""}`, `${ddd.length === 2 ? ") " : ""}`, p1, p2 ? `-${p2}` : ""].join("");
}

export function maskBrazilianPhoneInput(phone: string) {
  return formatBrazilianPhone(normalizePhone(phone).slice(0, 11));
}
