// Onboarding asks what kind of user someone is as free text (eleven suggestions
// plus anything they type). Eleven demo projects would be too many to keep good,
// so they collapse onto five buckets; the raw answer still lives on the profile.
// `personal` is the fallback, so an unmapped or empty answer always resolves.

export type DemoBucket = 'agency' | 'product' | 'marketing' | 'inhouse' | 'personal'

export const DEMO_BUCKETS: DemoBucket[] = ['agency', 'product', 'marketing', 'inhouse', 'personal']

/** Map a free-text user type onto one of the five demo buckets. */
export function demoBucket(userType?: string): DemoBucket {
  const t = (userType || '').trim().toLowerCase()
  if (!t) return 'personal'
  const has = (...keys: string[]) => keys.some(k => t.includes(k))
  // Order matters: check the more specific buckets before the broad ones.
  if (has('agenc', 'freelanc', 'consult')) return 'agency'
  if (has('startup', 'product', 'developer', 'design', 'engineer')) return 'product'
  if (has('market')) return 'marketing'
  if (has('in-house', 'in house', 'inhouse', 'enterprise', 'team', 'company')) return 'inhouse'
  return 'personal'
}
