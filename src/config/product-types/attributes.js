/**
 * Per-product-type attribute schemas — the single source of truth for the
 * dynamic fields shown in the product wizard (Add/Edit), used for validation,
 * and rendered on the public product details page.
 *
 * A schema is a list of groups; each group has fields. A field:
 *   { key, type, label, required?, options?, placeholder?, unit? }
 *   - key       stable identifier persisted under products.attributes[key]
 *   - type      'text' | 'number' | 'select' | 'boolean' | 'date'
 *   - label     English fallback; i18n lookup key is the same `key`
 *   - options   [{ value, label }] for select fields
 *
 * Labels are resolved at render time via src/lib/product-attributes.js so the
 * i18n system stays authoritative and configs remain serializable/server-safe.
 * Color & Size are NOT attributes here — they remain the existing variant
 * editors, gated per type by `variantAxes` in ./index.js.
 */

const t = (key, type, label, extra = {}) => ({ key, type, label, ...extra });

const sel = (value, label) => ({ value, label });

// Reusable option sets.
const GENDER = [sel('men', 'Men'), sel('women', 'Women'), sel('unisex', 'Unisex'), sel('kids', 'Kids')];
const CONDITION = [sel('new', 'New'), sel('used', 'Used'), sel('refurbished', 'Refurbished')];
const FUEL = [sel('petrol', 'Petrol'), sel('diesel', 'Diesel'), sel('electric', 'Electric'), sel('hybrid', 'Hybrid')];
const TRANSMISSION = [sel('manual', 'Manual'), sel('automatic', 'Automatic')];

export const ATTRIBUTE_SCHEMAS = {
  clothing: [
    {
      id: 'details',
      label: 'Clothing details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('gender', 'select', 'Gender', { options: GENDER }),
        t('material', 'text', 'Material'),
        t('fit', 'select', 'Fit', {
          options: [sel('regular', 'Regular'), sel('slim', 'Slim'), sel('relaxed', 'Relaxed'), sel('oversized', 'Oversized')],
        }),
        t('season', 'select', 'Season', {
          options: [sel('all_season', 'All season'), sel('summer', 'Summer'), sel('winter', 'Winter'), sel('spring', 'Spring'), sel('autumn', 'Autumn')],
        }),
        t('pattern', 'text', 'Pattern'),
        t('care_instructions', 'text', 'Care instructions'),
      ],
    },
  ],
  perfumes: [
    {
      id: 'details',
      label: 'Fragrance details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('fragrance_type', 'select', 'Fragrance type', {
          options: [sel('edp', 'Eau de Parfum'), sel('edt', 'Eau de Toilette'), sel('parfum', 'Parfum'), sel('cologne', 'Cologne')],
        }),
        t('gender', 'select', 'Gender', { options: GENDER }),
        t('volume', 'text', 'Volume', { placeholder: 'e.g. 50 ml' }),
        t('concentration', 'text', 'Concentration'),
        t('fragrance_family', 'text', 'Fragrance family'),
        t('top_notes', 'text', 'Top notes'),
        t('middle_notes', 'text', 'Middle notes'),
        t('base_notes', 'text', 'Base notes'),
        t('country_of_origin', 'text', 'Country of origin'),
      ],
    },
  ],
  electronics: [
    {
      id: 'general',
      label: 'General',
      fields: [
        t('brand', 'text', 'Brand'),
        t('model', 'text', 'Model'),
        t('warranty', 'text', 'Warranty'),
        t('operating_system', 'text', 'Operating system'),
        t('connectivity', 'text', 'Connectivity'),
      ],
    },
    {
      id: 'hardware',
      label: 'Hardware',
      fields: [
        t('ram', 'text', 'RAM', { placeholder: 'e.g. 8 GB' }),
        t('storage', 'text', 'Storage', { placeholder: 'e.g. 256 GB' }),
        t('processor', 'text', 'Processor'),
        t('screen_size', 'text', 'Screen size', { placeholder: 'e.g. 6.7"' }),
        t('resolution', 'text', 'Resolution'),
        t('battery_capacity', 'text', 'Battery capacity', { placeholder: 'e.g. 5000 mAh' }),
      ],
    },
  ],
  bicycles: [
    {
      id: 'details',
      label: 'Bicycle details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('model', 'text', 'Model'),
        t('bike_type', 'text', 'Bike type'),
        t('frame_material', 'text', 'Frame material'),
        t('frame_size', 'text', 'Frame size'),
        t('wheel_size', 'text', 'Wheel size'),
        t('gears', 'number', 'Number of gears'),
        t('brake_type', 'text', 'Brake type'),
        t('suspension', 'text', 'Suspension'),
        t('weight', 'text', 'Weight', { placeholder: 'e.g. 12 kg' }),
      ],
    },
  ],
  motorcycles: [
    {
      id: 'details',
      label: 'Motorcycle details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('model', 'text', 'Model'),
        t('year', 'number', 'Year'),
        t('engine_capacity', 'text', 'Engine capacity', { placeholder: 'e.g. 600 cc' }),
        t('fuel_type', 'select', 'Fuel type', { options: FUEL }),
        t('transmission', 'select', 'Transmission', { options: TRANSMISSION }),
        t('mileage', 'number', 'Mileage', { unit: 'km' }),
        t('horsepower', 'number', 'Horsepower', { unit: 'hp' }),
        t('condition', 'select', 'Condition', { options: CONDITION }),
      ],
    },
  ],
  cars: [
    {
      id: 'general',
      label: 'Vehicle',
      fields: [
        t('brand', 'text', 'Brand'),
        t('model', 'text', 'Model'),
        t('year', 'number', 'Year'),
        t('body_type', 'text', 'Body type'),
        t('condition', 'select', 'Condition', { options: CONDITION }),
        t('vin', 'text', 'VIN'),
      ],
    },
    {
      id: 'specs',
      label: 'Specifications',
      fields: [
        t('mileage', 'number', 'Mileage', { unit: 'km' }),
        t('fuel_type', 'select', 'Fuel type', { options: FUEL }),
        t('transmission', 'select', 'Transmission', { options: TRANSMISSION }),
        t('engine', 'text', 'Engine'),
        t('horsepower', 'number', 'Horsepower', { unit: 'hp' }),
        t('doors', 'number', 'Doors'),
      ],
    },
  ],
  supplements: [
    {
      id: 'details',
      label: 'Supplement details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('supplement_type', 'text', 'Supplement type'),
        t('form', 'select', 'Form', {
          options: [sel('capsules', 'Capsules'), sel('powder', 'Powder'), sel('tablets', 'Tablets'), sel('liquid', 'Liquid'), sel('gummies', 'Gummies')],
        }),
        t('quantity', 'text', 'Quantity'),
        t('serving_size', 'text', 'Serving size'),
        t('ingredients', 'text', 'Ingredients'),
        t('flavor', 'text', 'Flavor'),
        t('target', 'text', 'Target'),
        t('expiration_date', 'date', 'Expiration date'),
        t('country_of_origin', 'text', 'Country of origin'),
      ],
    },
  ],
  'car-parts': [
    {
      id: 'details',
      label: 'Part details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('part_number', 'text', 'Part number'),
        t('oem_number', 'text', 'OEM number'),
        t('compatible_brands', 'text', 'Compatible brands'),
        t('compatible_models', 'text', 'Compatible models'),
        t('vehicle_year', 'text', 'Vehicle year'),
        t('material', 'text', 'Material'),
        t('condition', 'select', 'Condition', { options: CONDITION }),
      ],
    },
  ],
  'home-appliances': [
    {
      id: 'details',
      label: 'Appliance details',
      fields: [
        t('brand', 'text', 'Brand'),
        t('model', 'text', 'Model'),
        t('power', 'text', 'Power'),
        t('voltage', 'text', 'Voltage'),
        t('capacity', 'text', 'Capacity'),
        t('energy_rating', 'text', 'Energy rating'),
        t('dimensions', 'text', 'Dimensions'),
        t('weight', 'text', 'Weight'),
        t('warranty', 'text', 'Warranty'),
      ],
    },
  ],
  furniture: [
    {
      id: 'details',
      label: 'Furniture details',
      fields: [
        t('material', 'text', 'Material'),
        t('dimensions', 'text', 'Dimensions'),
        t('width', 'text', 'Width'),
        t('height', 'text', 'Height'),
        t('depth', 'text', 'Depth'),
        t('weight', 'text', 'Weight'),
        t('room', 'text', 'Room'),
        t('style', 'text', 'Style'),
        t('assembly_required', 'boolean', 'Assembly required'),
        t('number_of_seats', 'number', 'Number of seats'),
      ],
    },
  ],
  digital: [
    {
      id: 'details',
      label: 'Digital details',
      fields: [
        t('digital_product_type', 'text', 'Digital product type'),
        t('platform', 'text', 'Platform'),
        t('region', 'text', 'Region'),
        t('license_type', 'text', 'License type'),
        t('duration', 'text', 'Duration'),
        t('delivery_method', 'select', 'Delivery method', {
          options: [sel('instant', 'Instant'), sel('email', 'Email'), sel('manual', 'Manual')],
        }),
        t('activation_instructions', 'text', 'Activation instructions'),
      ],
    },
  ],
  // "Other" has no predefined attributes (custom-attribute engine is a later phase).
  other: [],
};

/** Returns the attribute group list for a product type, or [] when unknown. */
export function getAttributeSchema(typeId) {
  return ATTRIBUTE_SCHEMAS[typeId] ?? [];
}

/** Flat list of every field for a type (across groups). */
export function getAttributeFields(typeId) {
  return getAttributeSchema(typeId).flatMap((g) => g.fields);
}

/** Map of key → field spec for a type. */
export function getAttributeFieldMap(typeId) {
  const map = {};
  for (const f of getAttributeFields(typeId)) map[f.key] = f;
  return map;
}
