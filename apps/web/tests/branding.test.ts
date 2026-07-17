import { describe, expect, it } from 'vitest';
import { resolveProductBrand } from '../src/branding';

describe('product branding', () => {
  it('keeps the upstream identity when no distribution profile is configured', () => {
    expect(resolveProductBrand({})).toMatchObject({
      profile: 'open-design',
      productName: 'Open Design',
      accent: '#c96442',
    });
  });

  it('resolves the Cognitum Media Factory deployment profile', () => {
    expect(resolveProductBrand({
      NEXT_PUBLIC_OD_BRAND_PROFILE: 'cognitum-media-factory',
      NEXT_PUBLIC_OD_PRODUCT_NAME: 'Cognitum Media Factory',
      NEXT_PUBLIC_OD_SHORT_NAME: 'Media Factory',
      NEXT_PUBLIC_OD_COMPANY_NAME: 'Cognitum',
      NEXT_PUBLIC_OD_TAGLINE: 'Create every governed asset.',
      NEXT_PUBLIC_OD_ACCENT: '#0BBCCC',
      NEXT_PUBLIC_OD_ACCENT_SECONDARY: '#2EB85C',
    })).toEqual({
      profile: 'cognitum-media-factory',
      productName: 'Cognitum Media Factory',
      shortName: 'Media Factory',
      companyName: 'Cognitum',
      tagline: 'Create every governed asset.',
      accent: '#0bbccc',
      accentSecondary: '#2eb85c',
    });
  });

  it('rejects unsafe color values and bounds public copy', () => {
    const brand = resolveProductBrand({
      NEXT_PUBLIC_OD_PRODUCT_NAME: 'x'.repeat(200),
      NEXT_PUBLIC_OD_ACCENT: 'red; background: url(evil)',
    });
    expect(brand.productName).toHaveLength(80);
    expect(brand.accent).toBe('#c96442');
  });
});
