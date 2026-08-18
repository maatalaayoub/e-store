/**
 * Product-type configuration registry.
 *
 * This is the single source of truth that drives the dynamic product wizard:
 * which product types exist, their inventory behavior, which attributes they
 * expose, and which attributes generate variants. The UI, the validation
 * schema builder, and the server all consume this config so we never scatter
 * `if (productType === 'clothing')` checks across the codebase.
 *
 * Icons are stored as *string* names (resolved to lucide-react components in
 * the UI) so this module stays serializable and safe to import on the server.
 *
 * Phases B/C ship the type metadata + inventory behavior. The per-type
 * `attributeGroups` / `variantAxes` are intentionally light here and get
 * fleshed out in later phases (the dynamic attribute engine consumes them).
 */

/** Field primitive types — shared by the field renderer and the Zod builder. */
export const FIELD_TYPES = Object.freeze({
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  COLOR: 'color',
  DATE: 'date',
  URL: 'url',
  MEASUREMENT: 'measurement',
  FILE: 'file',
});

/** How a product type tracks stock. */
export const INVENTORY_MODES = Object.freeze({
  PHYSICAL: 'physical', // products.stock and/or product_variants.stock
  DIGITAL: 'digital', // secure digital codes / files
  NONE: 'none',
});

/**
 * The type registry. Each entry:
 *  - id            stable identifier persisted in products.product_type
 *  - icon          lucide-react icon name (string)
 *  - labelKey      i18n key under admin.products.form.*
 *  - descKey       i18n key under admin.products.form.*
 *  - isDigital     digital-delivery workflow vs physical
 *  - inventoryMode one of INVENTORY_MODES
 *  - variantAxes   attribute keys that generate variant combinations
 *  - custom        true for the "Other" type (user-defined attributes)
 *  - attributeGroups  filled out by later phases (dynamic attribute engine)
 */
const TYPES = [
  {
    id: 'clothing',
    icon: 'Shirt',
    labelKey: 'type_clothing',
    descKey: 'type_clothing_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color', 'size'],
    attributeGroups: [],
  },
  {
    id: 'perfumes',
    icon: 'SprayCan',
    labelKey: 'type_perfumes',
    descKey: 'type_perfumes_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: [],
    attributeGroups: [],
  },
  {
    id: 'electronics',
    icon: 'Cpu',
    labelKey: 'type_electronics',
    descKey: 'type_electronics_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color'],
    attributeGroups: [],
  },
  {
    id: 'bicycles',
    icon: 'Bike',
    labelKey: 'type_bicycles',
    descKey: 'type_bicycles_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color'],
    attributeGroups: [],
  },
  {
    id: 'motorcycles',
    icon: 'Gauge',
    labelKey: 'type_motorcycles',
    descKey: 'type_motorcycles_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color'],
    attributeGroups: [],
  },
  {
    id: 'supplements',
    icon: 'Pill',
    labelKey: 'type_supplements',
    descKey: 'type_supplements_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: [],
    attributeGroups: [],
  },
  {
    id: 'car-parts',
    icon: 'Wrench',
    labelKey: 'type_car_parts',
    descKey: 'type_car_parts_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: [],
    attributeGroups: [],
  },
  {
    id: 'cars',
    icon: 'Car',
    labelKey: 'type_cars',
    descKey: 'type_cars_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: [],
    attributeGroups: [],
  },
  {
    id: 'home-appliances',
    icon: 'WashingMachine',
    labelKey: 'type_home_appliances',
    descKey: 'type_home_appliances_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color'],
    attributeGroups: [],
  },
  {
    id: 'furniture',
    icon: 'Sofa',
    labelKey: 'type_furniture',
    descKey: 'type_furniture_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: ['color'],
    attributeGroups: [],
  },
  {
    id: 'digital',
    icon: 'Download',
    labelKey: 'type_digital',
    descKey: 'type_digital_desc',
    isDigital: true,
    inventoryMode: INVENTORY_MODES.DIGITAL,
    variantAxes: [],
    attributeGroups: [],
  },
  {
    id: 'other',
    icon: 'Shapes',
    labelKey: 'type_other',
    descKey: 'type_other_desc',
    isDigital: false,
    inventoryMode: INVENTORY_MODES.PHYSICAL,
    variantAxes: [],
    custom: true,
    attributeGroups: [],
  },
];

export const PRODUCT_TYPES = TYPES;

export function listProductTypes() {
  return TYPES;
}

export function getProductType(id) {
  if (!id) return null;
  return TYPES.find((t) => t.id === id) ?? null;
}

export function isKnownProductType(id) {
  return typeof id === 'string' && TYPES.some((t) => t.id === id);
}

/** Variant axes (e.g. ['color','size']) declared by a type, or [] when unknown. */
export function getVariantAxes(id) {
  return getProductType(id)?.variantAxes ?? [];
}
