export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function getMemberOverflow(
  memberCount: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (memberCount <= 3) {
    return `${memberCount} ${t("communities.members")}`
  }
  return `${memberCount - 3}+`
}
