export function matchesNftQuery(query: string, fields: Array<string | null | undefined>) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.filter(Boolean).join(" ").toLocaleLowerCase();
  return terms.every(term => haystack.includes(term));
}
