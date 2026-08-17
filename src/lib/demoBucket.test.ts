import { describe, it, expect } from 'vitest'
import { demoBucket } from './demoBucket'

describe('demoBucket', () => {
  it('maps agency-ish types to agency', () => {
    expect(demoBucket('Agency')).toBe('agency')
    expect(demoBucket('Freelancer')).toBe('agency')
    expect(demoBucket('Consultant')).toBe('agency')
  })

  it('maps product-ish types to product', () => {
    expect(demoBucket('Startup')).toBe('product')
    expect(demoBucket('Product manager')).toBe('product')
    expect(demoBucket('Developer')).toBe('product')
    expect(demoBucket('Designer')).toBe('product')
  })

  it('maps marketers to marketing', () => {
    expect(demoBucket('Marketer')).toBe('marketing')
    expect(demoBucket('Marketing lead')).toBe('marketing')
  })

  it('maps in-house / enterprise to inhouse', () => {
    expect(demoBucket('In-house team')).toBe('inhouse')
    expect(demoBucket('Enterprise')).toBe('inhouse')
  })

  it('falls back to personal for empty or unrecognised', () => {
    expect(demoBucket('')).toBe('personal')
    expect(demoBucket(undefined)).toBe('personal')
    expect(demoBucket('Personal use')).toBe('personal')
    expect(demoBucket('Something nobody expected')).toBe('personal')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(demoBucket('  AGENCY ')).toBe('agency')
    expect(demoBucket('freelance designer')).toBe('agency') // agency wins on first match
  })
})
