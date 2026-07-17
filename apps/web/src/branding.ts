export interface ProductBrand {
  profile: string;
  productName: string;
  shortName: string;
  companyName: string;
  tagline: string;
  accent: string;
  accentSecondary: string;
}

const clean = (value: string | undefined, fallback: string, maxLength = 80): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const color = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : fallback;
};

export function resolveProductBrand(env: Readonly<Record<string, string | undefined>>): ProductBrand {
  return Object.freeze({
    profile: clean(env.NEXT_PUBLIC_OD_BRAND_PROFILE, 'open-design'),
    productName: clean(env.NEXT_PUBLIC_OD_PRODUCT_NAME, 'Open Design'),
    shortName: clean(env.NEXT_PUBLIC_OD_SHORT_NAME, 'Open Design'),
    companyName: clean(env.NEXT_PUBLIC_OD_COMPANY_NAME, 'Nexu Labs'),
    tagline: clean(env.NEXT_PUBLIC_OD_TAGLINE, 'The open-source Claude Design alternative.', 240),
    accent: color(env.NEXT_PUBLIC_OD_ACCENT, '#c96442'),
    accentSecondary: color(env.NEXT_PUBLIC_OD_ACCENT_SECONDARY, '#2563eb'),
  });
}

// Keep every public key as a direct property access. Next.js statically replaces
// NEXT_PUBLIC_* expressions in browser bundles, but cannot inline a dynamic read
// of the whole process.env object.
export const PRODUCT_BRAND = resolveProductBrand({
  NEXT_PUBLIC_OD_BRAND_PROFILE: process.env.NEXT_PUBLIC_OD_BRAND_PROFILE,
  NEXT_PUBLIC_OD_PRODUCT_NAME: process.env.NEXT_PUBLIC_OD_PRODUCT_NAME,
  NEXT_PUBLIC_OD_SHORT_NAME: process.env.NEXT_PUBLIC_OD_SHORT_NAME,
  NEXT_PUBLIC_OD_COMPANY_NAME: process.env.NEXT_PUBLIC_OD_COMPANY_NAME,
  NEXT_PUBLIC_OD_TAGLINE: process.env.NEXT_PUBLIC_OD_TAGLINE,
  NEXT_PUBLIC_OD_ACCENT: process.env.NEXT_PUBLIC_OD_ACCENT,
  NEXT_PUBLIC_OD_ACCENT_SECONDARY: process.env.NEXT_PUBLIC_OD_ACCENT_SECONDARY,
});

const brandedCopy: Partial<Record<string, (brand: ProductBrand) => string>> = {
  'app.brand': (brand) => brand.productName,
  'app.brandSubtitle': (brand) => `by ${brand.companyName}`,
  'homeHero.subtitlePrefix': (brand) => brand.tagline,
  'settings.welcomeTitle': (brand) => `Welcome to ${brand.productName}`,
  'settings.onboardingCreateBody': (brand) =>
    `Describe the site, app, deck, document, image, or video you want. ${brand.shortName} will create a project and keep the work editable.`,
  'settings.onboardingMemoryCalloutBody': (brand) =>
    `These answers seed your Memory profile. ${brand.shortName} reuses it on every task — and keeps learning as you work.`,
};

const cognitumCopy: Partial<Record<string, (brand: ProductBrand) => string>> = {
  'settings.onboardingCloudTitle': () => 'Sign in to Cognitum',
  'settings.onboardingCloudBody': (brand) =>
    `Connect ${brand.productName} to Cognitum Meta-LLM for tenant-isolated model routing, metering, memory, and continuous optimization.`,
  'settings.onboardingCloudSignIn': () => 'Sign in with Cognitum',
  'settings.onboardingCloudContinue': () => 'Continue with Cognitum',
};

export function applyProductBrand(key: string, translated: string): string {
  if (PRODUCT_BRAND.profile === 'cognitum-media-factory') {
    const cognitumOverride = cognitumCopy[key];
    if (cognitumOverride) return cognitumOverride(PRODUCT_BRAND);
  }
  const override = brandedCopy[key];
  return override ? override(PRODUCT_BRAND) : translated;
}
