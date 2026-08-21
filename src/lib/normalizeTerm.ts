export function normalizeTerm(term: string) {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}
