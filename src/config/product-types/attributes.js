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

/**
 * Electronics uses a second level of specialization: the seller picks a device
 * type (TV, Smartphone, …) and only that device's relevant specs are shown.
 * Fields are referenced by key from FIELD_LIBRARY so specs stay reusable and
 * new device types can be added without touching the UI.
 */
const FIELD_LIBRARY = {
  brand: t('brand', 'text', 'Brand'),
  model: t('model', 'text', 'Model'),
  screen_size: t('screen_size', 'text', 'Screen size', { placeholder: 'e.g. 6.7"' }),
  resolution: t('resolution', 'text', 'Resolution'),
  display_technology: t('display_technology', 'select', 'Display technology', {
    options: [sel('led', 'LED'), sel('oled', 'OLED'), sel('qled', 'QLED'), sel('lcd', 'LCD'), sel('amoled', 'AMOLED'), sel('ips', 'IPS')],
  }),
  refresh_rate: t('refresh_rate', 'text', 'Refresh rate', { placeholder: 'e.g. 120 Hz' }),
  ram: t('ram', 'text', 'RAM', { placeholder: 'e.g. 8 GB' }),
  storage: t('storage', 'text', 'Storage', { placeholder: 'e.g. 256 GB' }),
  processor: t('processor', 'text', 'Processor'),
  gpu: t('gpu', 'text', 'GPU'),
  battery_capacity: t('battery_capacity', 'text', 'Battery capacity', { placeholder: 'e.g. 5000 mAh' }),
  camera: t('camera', 'text', 'Camera'),
  megapixels: t('megapixels', 'text', 'Megapixels'),
  lens: t('lens', 'text', 'Lens'),
  operating_system: t('operating_system', 'text', 'Operating system'),
  connectivity: t('connectivity', 'text', 'Connectivity'),
  bluetooth: t('bluetooth', 'text', 'Bluetooth'),
  wifi: t('wifi', 'text', 'Wi-Fi'),
  sim_support: t('sim_support', 'select', 'SIM support', {
    options: [sel('single', 'Single SIM'), sel('dual', 'Dual SIM'), sel('esim', 'eSIM'), sel('none', 'No SIM')],
  }),
  ports: t('ports', 'text', 'Ports'),
  weight: t('weight', 'text', 'Weight'),
  dimensions: t('dimensions', 'text', 'Dimensions'),
  charging_type: t('charging_type', 'text', 'Charging type'),
  water_resistance: t('water_resistance', 'text', 'Water resistance'),
  warranty: t('warranty', 'text', 'Warranty'),
  edition: t('edition', 'text', 'Edition'),
  generation: t('generation', 'text', 'Generation'),
  controller_included: t('controller_included', 'boolean', 'Controller included'),
  power: t('power', 'text', 'Power'),
  print_technology: t('print_technology', 'text', 'Print technology'),
  switch_type: t('switch_type', 'text', 'Switch type'),
};

const dev = (id, icon, label, fields) => ({ id, icon, label, fields });
export const ELECTRONICS_DEVICE_TYPES = [
  dev('tv', 'Tv', 'TV', ['brand', 'model', 'screen_size', 'resolution', 'display_technology', 'refresh_rate', 'operating_system', 'connectivity', 'ports', 'warranty']),
  dev('smartphone', 'Smartphone', 'Smartphone', ['brand', 'model', 'screen_size', 'resolution', 'ram', 'storage', 'processor', 'battery_capacity', 'camera', 'operating_system', 'sim_support', 'connectivity', 'charging_type', 'water_resistance', 'warranty']),
  dev('tablet', 'Tablet', 'Tablet', ['brand', 'model', 'screen_size', 'resolution', 'ram', 'storage', 'processor', 'battery_capacity', 'operating_system', 'sim_support', 'connectivity', 'warranty']),
  dev('smartwatch', 'Watch', 'Smartwatch', ['brand', 'model', 'screen_size', 'battery_capacity', 'connectivity', 'bluetooth', 'water_resistance', 'operating_system', 'warranty']),
  dev('laptop', 'Laptop', 'Laptop', ['brand', 'model', 'screen_size', 'resolution', 'ram', 'storage', 'processor', 'gpu', 'battery_capacity', 'operating_system', 'connectivity', 'weight', 'warranty']),
  dev('desktop', 'HardDrive', 'Desktop PC', ['brand', 'model', 'ram', 'storage', 'processor', 'gpu', 'operating_system', 'connectivity', 'ports', 'warranty']),
  dev('console', 'Gamepad2', 'Gaming Console', ['brand', 'model', 'storage', 'edition', 'generation', 'connectivity', 'controller_included', 'warranty']),
  dev('monitor', 'Monitor', 'Monitor', ['brand', 'model', 'screen_size', 'resolution', 'display_technology', 'refresh_rate', 'ports', 'connectivity', 'warranty']),
  dev('camera', 'Camera', 'Camera', ['brand', 'model', 'megapixels', 'lens', 'resolution', 'battery_capacity', 'connectivity', 'weight', 'warranty']),
  dev('headphones', 'Headphones', 'Headphones / Earbuds', ['brand', 'model', 'bluetooth', 'battery_capacity', 'connectivity', 'water_resistance', 'charging_type', 'warranty']),
  dev('speaker', 'Speaker', 'Speaker', ['brand', 'model', 'power', 'bluetooth', 'battery_capacity', 'connectivity', 'warranty']),
  dev('router', 'Router', 'Router', ['brand', 'model', 'wifi', 'ports', 'connectivity', 'warranty']),
  dev('keyboard', 'Keyboard', 'Keyboard', ['brand', 'model', 'switch_type', 'connectivity', 'bluetooth', 'warranty']),
  dev('mouse', 'Mouse', 'Mouse', ['brand', 'model', 'connectivity', 'bluetooth', 'warranty']),
  dev('printer', 'Printer', 'Printer', ['brand', 'model', 'print_technology', 'connectivity', 'warranty']),
  dev('other', 'Cpu', 'Other device', ['brand', 'model', 'connectivity', 'warranty']),
];

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
    // Electronics fields are resolved dynamically from the selected device
    // type (see ELECTRONICS_DEVICE_TYPES + getAttributeSchema). This static
    // entry is intentionally empty so a device must be picked first.
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

/** Device types for a product type (only electronics for now), or []. */
export function getDeviceTypes(typeId) {
  return typeId === 'electronics' ? ELECTRONICS_DEVICE_TYPES : [];
}

/**
 * Which configurable variant dimensions a product supports (['ram','storage']).
 * Derived from the selected electronics device's own field list so it stays a
 * single source of truth — a device that has no RAM field gets no RAM variants.
 */
export function getVariantDimensions(typeId, subtype) {
  if (typeId !== 'electronics' || !subtype) return [];
  const device = ELECTRONICS_DEVICE_TYPES.find((d) => d.id === subtype);
  if (!device) return [];
  const dims = [];
  if (device.fields.includes('ram')) dims.push('ram');
  if (device.fields.includes('storage')) dims.push('storage');
  return dims;
}

// Suggested option presets for the RAM / Storage variant builders. Sellers can
// pick from these or type their own — nothing here is enforced.
export const RAM_OPTION_PRESETS = ['2 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '24 GB', '32 GB', '64 GB'];
export const STORAGE_OPTION_PRESETS = ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];

/** Build the electronics attribute groups for a selected device type. */
function electronicsGroups(subtype) {
  const device = ELECTRONICS_DEVICE_TYPES.find((d) => d.id === subtype);
  if (!device) return [];
  return [
    {
      id: 'specs',
      label: 'Specifications',
      fields: device.fields.map((k) => FIELD_LIBRARY[k]).filter(Boolean),
    },
  ];
}

/**
 * Returns the attribute group list for a product type. Electronics resolves
 * from the selected device subtype; other types use their static schema.
 */
export function getAttributeSchema(typeId, subtype) {
  if (typeId === 'electronics') return electronicsGroups(subtype);
  return ATTRIBUTE_SCHEMAS[typeId] ?? [];
}

/** Flat list of every field for a type (across groups). */
export function getAttributeFields(typeId, subtype) {
  return getAttributeSchema(typeId, subtype).flatMap((g) => g.fields);
}

/** Map of key → field spec for a type. */
export function getAttributeFieldMap(typeId, subtype) {
  const map = {};
  for (const f of getAttributeFields(typeId, subtype)) map[f.key] = f;
  return map;
}
