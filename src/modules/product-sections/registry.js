/**
 * Product Sections — type registry & defaults.
 *
 * This file is the single source of truth for every supported section type.
 * Adding a new type only requires:
 *   1. Adding an entry here (id, label, content/config defaults).
 *   2. Mapping the id → React component in
 *      `src/components/shop/product-sections/index.js`.
 *   3. (Optional) custom editor block in
 *      `src/components/admin/product-sections/SectionEditor.js`.
 *
 * Both server and client code import from this module — keep it free of
 * React, Node, and DOM APIs.
 */

export const SECTION_TYPES = Object.freeze({
  DESCRIPTION: 'description',
  GALLERY: 'gallery',
  SHIPPING: 'shipping',
  REVIEWS: 'reviews',
  RATINGS: 'ratings',
  SPECIFICATIONS: 'specifications',
  FAQ: 'faq',
  RICH_TEXT: 'rich_text',
  IMAGE_TEXT: 'image_text',
  VIDEO: 'video',
  BANNER: 'banner',
  RELATED_PRODUCTS: 'related_products',
  CHECKOUT: 'checkout',
  CUSTOM: 'custom',
});

const TYPE_VALUES = new Set(Object.values(SECTION_TYPES));

/** Common config defaults applied to every section. */
const baseConfig = () => ({
  layout: 'default',          // 'default' | 'compact' | 'wide' | 'card'
  width: 'container',         // 'container' | 'wide' | 'full'
  background: 'transparent',  // 'transparent' | 'muted' | 'accent' | 'custom'
  background_color: null,     // hex (only when background === 'custom')
  title_color: null,          // hex or null — section heading color
  border_color: null,         // hex or null (null = no border)
  border_width: 0,            // px (0 = no border)
  padding: 'md',              // 'none' | 'sm' | 'md' | 'lg'
  show_title: true,
});

/**
 * Per-type registry. Each entry exposes:
 *   - label/description   : admin-facing copy (English baseline; admin UI
 *                           may translate via dictionary keys).
 *   - icon                : lucide icon name (admin uses this string lookup)
 *   - global_only         : true → never override-able per product
 *   - per_product_only    : true → cannot appear in global defaults
 *   - defaults()          : factory returning { config, content } for new sections
 *   - translatableFields  : list of `content` keys that are i18n-aware
 */
export const SECTION_REGISTRY = Object.freeze({
  [SECTION_TYPES.DESCRIPTION]: {
    label: 'Product Description',
    description: 'Long-form description rendered from the product field.',
    icon: 'AlignLeft',
    defaults: () => ({
      config: { ...baseConfig(), show_title: true, max_height: null },
      content: { title: 'Description' },
    }),
    translatableFields: ['title'],
  },
  [SECTION_TYPES.GALLERY]: {
    label: 'Additional Gallery',
    description: 'Extra image grid below the main gallery.',
    icon: 'Images',
    defaults: () => ({
      config: { ...baseConfig(), columns: 3, aspect: 'square' },
      content: { title: 'Gallery', images: [] }, // images: [{ url, alt }]
    }),
    translatableFields: ['title'],
  },
  [SECTION_TYPES.SHIPPING]: {
    label: 'Shipping & Delivery',
    description: 'Delivery, returns and warranty information.',
    icon: 'Truck',
    defaults: () => ({
      config: { ...baseConfig(), layout: 'card' },
      content: {
        title: 'Shipping & Returns',
        items: [
          { icon: 'Truck', title: 'Free shipping', body: 'Free delivery on orders above $99.' },
          { icon: 'RotateCcw', title: 'Easy returns', body: '30-day no-questions-asked returns.' },
        ],
      },
    }),
    translatableFields: ['title', 'items'],
  },
  [SECTION_TYPES.REVIEWS]: {
    label: 'Customer Reviews',
    description: 'Verified customer reviews list.',
    icon: 'MessageSquareQuote',
    defaults: () => ({
      config: { ...baseConfig(), layout: 'card', limit: 5 },
      content: { title: 'Customer Reviews', empty_text: 'No reviews yet — be the first to share your experience.' },
    }),
    translatableFields: ['title', 'empty_text'],
  },
  [SECTION_TYPES.RATINGS]: {
    label: 'Rating Summary',
    description: 'Aggregate star ratings and distribution chart.',
    icon: 'Star',
    defaults: () => ({
      config: { ...baseConfig(), layout: 'compact' },
      content: { title: 'Ratings' },
    }),
    translatableFields: ['title'],
  },
  [SECTION_TYPES.SPECIFICATIONS]: {
    label: 'Specifications',
    description: 'Key/value spec table.',
    icon: 'List',
    defaults: () => ({
      config: { ...baseConfig() },
      content: {
        title: 'Specifications',
        items: [], // [{ key, value }]
      },
    }),
    translatableFields: ['title', 'items'],
  },
  [SECTION_TYPES.FAQ]: {
    label: 'FAQ / Accordion',
    description: 'Collapsible question/answer list.',
    icon: 'HelpCircle',
    defaults: () => ({
      config: { ...baseConfig() },
      content: {
        title: 'Frequently Asked Questions',
        items: [], // [{ question, answer }]
      },
    }),
    translatableFields: ['title', 'items'],
  },
  [SECTION_TYPES.RICH_TEXT]: {
    label: 'Rich Text Block',
    description: 'Formatted text content.',
    icon: 'Type',
    defaults: () => ({
      config: { ...baseConfig(), align: 'start' },
      content: { title: '', body: '' },
    }),
    translatableFields: ['title', 'body'],
  },
  [SECTION_TYPES.IMAGE_TEXT]: {
    label: 'Image + Text',
    description: 'Side-by-side image and rich text block.',
    icon: 'LayoutPanelLeft',
    defaults: () => ({
      config: { ...baseConfig(), image_position: 'left' }, // 'left' | 'right'
      content: { title: '', body: '', image_url: '', cta_text: '', cta_href: '' },
    }),
    translatableFields: ['title', 'body', 'cta_text'],
  },
  [SECTION_TYPES.VIDEO]: {
    label: 'Video Section',
    description: 'Embedded YouTube / Vimeo / direct video.',
    icon: 'Video',
    defaults: () => ({
      config: { ...baseConfig(), aspect: '16:9', autoplay: false },
      content: { title: '', video_url: '' },
    }),
    translatableFields: ['title'],
  },
  [SECTION_TYPES.BANNER]: {
    label: 'Banner / Promo',
    description: 'Full-width promotional banner with CTA.',
    icon: 'Megaphone',
    defaults: () => ({
      config: { ...baseConfig(), layout: 'wide', width: 'wide' },
      content: { title: '', subtitle: '', image_url: '', cta_text: '', cta_href: '' },
    }),
    translatableFields: ['title', 'subtitle', 'cta_text'],
  },
  [SECTION_TYPES.RELATED_PRODUCTS]: {
    label: 'Related Products',
    description: 'Grid of related/similar products.',
    icon: 'PackageOpen',
    defaults: () => ({
      config: { ...baseConfig(), layout: 'wide', width: 'wide', columns: 4, source: 'category' },
      content: { title: 'You may also like', limit: 8 },
    }),
    translatableFields: ['title'],
  },
  [SECTION_TYPES.CHECKOUT]: {
    label: 'Inline Checkout',
    description: 'On-page order form so customers can buy without leaving the product page.',
    icon: 'ShoppingBag',
    defaults: () => ({
      config: {
        ...baseConfig(),
        layout: 'card',
        // Visible field keys, in render order. Admin can hide / reorder these.
        fields: ['phone', 'fullName', 'country', 'city', 'state', 'zip', 'address'],
        show_coupon: true,
        show_place_order: true,
        show_whatsapp: true,
        // null = show WhatsApp button regardless of country.
        // Otherwise an array like ['Morocco'] restricts it to listed countries.
        whatsapp_countries: ['Morocco'],
        show_summary: true,
        // Granular text color overrides (null = inherit/default)
        label_color: null,
        input_text_color: null,
        placeholder_color: null,
        order_btn_bg: null,
        order_btn_text_color: null,
        whatsapp_btn_bg: null,
        whatsapp_btn_text_color: null,
      },
      content: {
        title: 'Order this product',
        subtitle: '',
      },
    }),
    translatableFields: ['title', 'subtitle'],
  },
  [SECTION_TYPES.CUSTOM]: {
    label: 'Custom Section',
    description: 'Fully custom block with title, body, image and CTA.',
    icon: 'Sparkles',
    defaults: () => ({
      config: {
        ...baseConfig(),
        layout: 'card',
        align: 'start',
        icon: null,
      },
      content: {
        title: '',
        subtitle: '',
        body: '',
        image_url: '',
        cta_text: '',
        cta_href: '',
        // Sanitized HTML fragment (no scripts / event handlers — see sanitize.js)
        html: '',
      },
    }),
    translatableFields: ['title', 'subtitle', 'body', 'cta_text', 'html'],
  },
});

export function isValidType(type) {
  return TYPE_VALUES.has(type);
}

export function getRegistryEntry(type) {
  return SECTION_REGISTRY[type] ?? null;
}

/** Stable cross-platform id generator (no crypto dep needed). */
export function generateSectionId() {
  return 'sec_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Build a fresh section descriptor for the admin builder.
 */
export function createSectionDescriptor(type, overrides = {}) {
  const entry = getRegistryEntry(type);
  if (!entry) throw new Error(`Unknown section type: ${type}`);
  const { config, content } = entry.defaults();
  return {
    id: generateSectionId(),
    type,
    enabled: true,
    order: 0,
    config,
    content,
    translations: null,
    ...overrides,
  };
}

/**
 * Built-in default layout used when no global defaults row exists yet
 * (also used as the seed when an admin clicks "Reset to defaults").
 *
 * Mirrors the original product page layout so existing storefronts look
 * identical after the migration.
 */
export function getBuiltInDefaults() {
  return [
    createSectionDescriptor(SECTION_TYPES.DESCRIPTION, { order: 0 }),
    createSectionDescriptor(SECTION_TYPES.SPECIFICATIONS, { order: 1 }),
    createSectionDescriptor(SECTION_TYPES.SHIPPING, { order: 2 }),
    createSectionDescriptor(SECTION_TYPES.RATINGS, { order: 3 }),
    createSectionDescriptor(SECTION_TYPES.REVIEWS, { order: 4 }),
    createSectionDescriptor(SECTION_TYPES.RELATED_PRODUCTS, { order: 5 }),
  ];
}
