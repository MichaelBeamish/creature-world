/**
 * Picks the world seed: `?seed=<integer>` in the URL wins (to reproduce or share a world);
 * otherwise a fresh random one per visit. `random` is injected so this stays testable.
 */
export function resolveSeed(search: string, random: () => number = Math.random): number {
  const param = new URLSearchParams(search).get('seed')
  if (param !== null && /^-?\d+$/.test(param.trim())) return Number.parseInt(param, 10) | 0
  return Math.floor(random() * 2 ** 31)
}
