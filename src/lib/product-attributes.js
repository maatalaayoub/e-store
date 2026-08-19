import {
  getAttributeSchema,
  getAttributeFieldMap,
  getDeviceTypes,
} from '@/config/product-types/attributes';

/**
 * Shared helpers for the dynamic product-attribute system. Used by the admin
 * wizard (Add/Edit), the server write path (sanitize), and the public product
 * details page (display) so attribute logic lives in exactly one place.
 */

/** Resolve an attribute label through i18n, falling back to the config label. */
export function attrLabel(dict, key, fallback) {
  return dict?.admin?.products?.attributes?.[key] ?? fallback ?? key;
}

/** Resolve a select-option label through i18n, falling back to config/value. */
export function attrOptionLabel(dict, key, value, fallback) {
  if (value == null || value === '') return '';
  return dict?.admin?.products?.attr_options?.[`${key}_${value}`] ?? fallback ?? String(value);
}

/**
 * Keep only attributes defined by the product type's schema, coerced to their
 * declared field type. Unknown keys and empty values are dropped. Returns a
 * plain object, or null when nothing valid remains. Never trusts client input.
 */
export function sanitizeAttributes(typeId, raw) {
  if (!typeId || !raw || typeof raw !== 'object') return null;
  // Electronics fields depend on the chosen device type, stored alongside the
  // attributes as `device_type`.
  const subtype = typeId === 'electronics' && typeof raw.device_type === 'string' ? raw.device_type : null;
  const fields = getAttributeFieldMap(typeId, subtype);
  const out = {};

  // Preserve a valid electronics device type so its schema resolves on read.
  if (typeId === 'electronics' && getDeviceTypes('electronics').some((d) => d.id === subtype)) {
    out.device_type = subtype;
  }

  for (const [key, field] of Object.entries(fields)) {
    const value = raw[key];
    if (value == null) continue;

    if (field.type === 'number') {
      if (value === '' || value === false) continue;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
      continue;
    }

    if (field.type === 'boolean') {
      if (value === true || value === 'true') out[key] = true;
      else if (value === false || value === 'false') out[key] = false;
      continue;
    }

    if (field.type === 'select') {
      const str = String(value).trim();
      const allowed = (field.options ?? []).some((o) => o.value === str);
      if (str && allowed) out[key] = str;
      continue;
    }

    // text / date
    const str = String(value).trim();
    if (str) out[key] = str.slice(0, 500);
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Build a display-ready list of the product's attributes, grouped exactly as
 * the schema defines and skipping empty values. Each entry:
 *   { id, label, items: [{ key, label, value }] }
 */
export function buildDisplayAttributes(typeId, attributes, dict) {
  const subtype = typeId === 'electronics' ? attributes?.device_type : undefined;
  const schema = getAttributeSchema(typeId, subtype);
  if (!schema.length || !attributes || typeof attributes !== 'object') return [];

  const groups = [];

  // Surface the electronics device type itself as the first spec row.
  if (typeId === 'electronics' && subtype) {
    const device = getDeviceTypes('electronics').find((d) => d.id === subtype);
    if (device) {
      groups.push({
        id: 'device',
        label: dict?.admin?.products?.attr_groups?.device ?? 'Device',
        items: [
          {
            key: 'device_type',
            label: dict?.admin?.products?.form?.device_type_label ?? 'Device type',
            value: dict?.admin?.products?.device_types?.[subtype] ?? device.label,
          },
        ],
      });
    }
  }

  for (const group of schema) {
    const items = [];
    for (const field of group.fields) {
      const raw = attributes[field.key];
      if (raw == null || raw === '') continue;

      let value;
      if (field.type === 'boolean') {
        value = raw ? (dict?.common?.yes ?? 'Yes') : (dict?.common?.no ?? 'No');
      } else if (field.type === 'select') {
        const opt = (field.options ?? []).find((o) => o.value === raw);
        value = attrOptionLabel(dict, field.key, raw, opt?.label);
      } else {
        value = String(raw);
        if (field.unit) value = `${value} ${field.unit}`;
      }

      items.push({ key: field.key, label: attrLabel(dict, field.key, field.label), value });
    }
    if (items.length > 0) {
      groups.push({
        id: group.id,
        label: dict?.admin?.products?.attr_groups?.[group.id] ?? group.label,
        items,
      });
    }
  }
  return groups;
}
