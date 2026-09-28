import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'
import { createSeoSettingsCollection } from '../collections/SeoSettings.js'

const LEGACY_IDENTIFIER = 'enum_seo_settings_technical_seo_collections_sitemap_change_frequency'
const PAYLOAD_IDENTIFIER_LIMIT = 63

function namedChild(fields: Field[], name: string): any {
  return fields.find((field) => 'name' in field && field.name === name)
}

describe('Payload SQL identifier compatibility', () => {
  it('pins the nested sitemap frequency enum below Payload\'s identifier limit', () => {
    const settings = createSeoSettingsCollection(['pages', 'posts'])
    const technicalSeo = namedChild(settings.fields, 'technicalSeo')
    const collections = namedChild(technicalSeo.fields, 'collections')
    const frequency = namedChild(collections.fields, 'sitemapChangeFrequency')

    expect(frequency.type).toBe('select')
    expect(LEGACY_IDENTIFIER).toHaveLength(68)
    expect(LEGACY_IDENTIFIER.length).toBeGreaterThan(PAYLOAD_IDENTIFIER_LIMIT)
    expect(frequency.enumName).toBe('seo_settings_sitemap_frequency')
    expect(frequency.enumName.length).toBeLessThanOrEqual(PAYLOAD_IDENTIFIER_LIMIT)
    expect(frequency.name).toBe('sitemapChangeFrequency')
    expect(frequency.dbName).toBeUndefined()
  })
})
