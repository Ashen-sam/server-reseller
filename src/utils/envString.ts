/** Trim and strip wrapping quotes (common when copying env from dashboards). */
export function normalizeEnvString(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}
