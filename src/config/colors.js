/**
 * Predefined product color palette.
 *
 * Each entry: { id, name, hex, translations }
 *   id           — stable identifier, used as React key
 *   name         — canonical English name persisted to the DB
 *   hex          — internal hex value sent to the server / used as swatch
 *   translations — display-only names per locale (never persisted)
 *
 * Colors are grouped by hue family so the picker renders them in a logical order.
 */
export const PREDEFINED_COLORS = [
  // Whites & Creams
  { id: "white",       name: "White",       hex: "#FFFFFF", translations: { fr: "Blanc",         ar: "أبيض",          dr: "بيض"            } },
  { id: "cream",       name: "Cream",       hex: "#FFFDD0", translations: { fr: "Crème",         ar: "كريمي",          dr: "كريمي"           } },
  { id: "ivory",       name: "Ivory",       hex: "#FFFFF0", translations: { fr: "Ivoire",        ar: "عاجي",           dr: "عاجي"            } },
  { id: "beige",       name: "Beige",       hex: "#F5F5DC", translations: { fr: "Beige",         ar: "بيج",            dr: "بيج"             } },

  // Grays
  { id: "light-gray",  name: "Light Gray",  hex: "#D1D5DB", translations: { fr: "Gris clair",   ar: "رمادي فاتح",     dr: "رمادي فاتح"      } },
  { id: "gray",        name: "Gray",        hex: "#6B7280", translations: { fr: "Gris",          ar: "رمادي",          dr: "رمادي"           } },
  { id: "dark-gray",   name: "Dark Gray",   hex: "#374151", translations: { fr: "Gris foncé",   ar: "رمادي داكن",     dr: "رمادي قاتم"      } },
  { id: "charcoal",    name: "Charcoal",    hex: "#2D2D2D", translations: { fr: "Anthracite",    ar: "فحمي",           dr: "فحمي"            } },

  // Black
  { id: "black",       name: "Black",       hex: "#111111", translations: { fr: "Noir",          ar: "أسود",           dr: "كحل"             } },

  // Browns
  { id: "light-brown", name: "Light Brown", hex: "#C4956A", translations: { fr: "Marron clair", ar: "بني فاتح",       dr: "قهواوي فاتح"     } },
  { id: "brown",       name: "Brown",       hex: "#92400E", translations: { fr: "Marron",        ar: "بني",            dr: "قهواوي"          } },
  { id: "dark-brown",  name: "Dark Brown",  hex: "#5C2D0E", translations: { fr: "Marron foncé", ar: "بني داكن",       dr: "قهواوي قاتم"     } },
  { id: "tan",         name: "Tan",         hex: "#D2B48C", translations: { fr: "Fauve",         ar: "أسمر",           dr: "سمراوي"          } },
  { id: "caramel",     name: "Caramel",     hex: "#C68E3A", translations: { fr: "Caramel",       ar: "كراميل",         dr: "كراميل"          } },

  // Reds
  { id: "light-red",   name: "Light Red",   hex: "#FCA5A5", translations: { fr: "Rouge clair",  ar: "أحمر فاتح",      dr: "أحمر فاتح"       } },
  { id: "red",         name: "Red",         hex: "#DC2626", translations: { fr: "Rouge",         ar: "أحمر",           dr: "أحمر"            } },
  { id: "dark-red",    name: "Dark Red",    hex: "#7F1D1D", translations: { fr: "Rouge foncé",  ar: "أحمر داكن",      dr: "أحمر قاتم"       } },
  { id: "crimson",     name: "Crimson",     hex: "#DC143C", translations: { fr: "Cramoisi",      ar: "قرمزي",          dr: "قرمزي"           } },
  { id: "maroon",      name: "Maroon",      hex: "#800000", translations: { fr: "Bordeaux",      ar: "كستنائي",        dr: "كستناوي"         } },

  // Oranges
  { id: "light-orange", name: "Light Orange", hex: "#FED7AA", translations: { fr: "Orange clair", ar: "برتقالي فاتح",  dr: "برتقالي فاتح"   } },
  { id: "orange",       name: "Orange",       hex: "#EA580C", translations: { fr: "Orange",        ar: "برتقالي",       dr: "برتقالي"         } },
  { id: "dark-orange",  name: "Dark Orange",  hex: "#C2410C", translations: { fr: "Orange foncé", ar: "برتقالي داكن",  dr: "برتقالي قاتم"   } },
  { id: "coral",        name: "Coral",        hex: "#FF7F7F", translations: { fr: "Corail",        ar: "مرجاني",        dr: "مرجاني"          } },
  { id: "salmon",       name: "Salmon",       hex: "#FA8072", translations: { fr: "Saumon",        ar: "سلموني",        dr: "سلموني"          } },

  // Yellows
  { id: "light-yellow", name: "Light Yellow", hex: "#FEF08A", translations: { fr: "Jaune clair",  ar: "أصفر فاتح",     dr: "صفر فاتح"        } },
  { id: "yellow",       name: "Yellow",       hex: "#EAB308", translations: { fr: "Jaune",         ar: "أصفر",          dr: "صفر"             } },
  { id: "dark-yellow",  name: "Dark Yellow",  hex: "#A16207", translations: { fr: "Jaune foncé",  ar: "أصفر داكن",     dr: "صفر قاتم"        } },
  { id: "gold",         name: "Gold",         hex: "#FFD700", translations: { fr: "Or",            ar: "ذهبي",          dr: "ذهبي"            } },
  { id: "mustard",      name: "Mustard",      hex: "#D4A017", translations: { fr: "Moutarde",      ar: "خردلي",         dr: "خردلي"           } },

  // Greens
  { id: "light-green",  name: "Light Green",  hex: "#86EFAC", translations: { fr: "Vert clair",   ar: "أخضر فاتح",     dr: "خضر فاتح"        } },
  { id: "green",        name: "Green",        hex: "#16A34A", translations: { fr: "Vert",          ar: "أخضر",          dr: "خضر"             } },
  { id: "dark-green",   name: "Dark Green",   hex: "#14532D", translations: { fr: "Vert foncé",   ar: "أخضر داكن",     dr: "خضر قاتم"        } },
  { id: "olive",        name: "Olive",        hex: "#6B7C41", translations: { fr: "Olive",         ar: "زيتوني",        dr: "زيتوني"          } },
  { id: "lime",         name: "Lime",         hex: "#84CC16", translations: { fr: "Citron vert",  ar: "ليموني",        dr: "ليموني"          } },
  { id: "mint",         name: "Mint",         hex: "#98FF98", translations: { fr: "Menthe",        ar: "نعناعي",        dr: "نعناعي"          } },
  { id: "forest-green", name: "Forest Green", hex: "#228B22", translations: { fr: "Vert forêt",   ar: "أخضر الغابة",   dr: "خضر الغابة"      } },

  // Cyans & Teals
  { id: "light-cyan",   name: "Light Cyan",   hex: "#A5F3FC", translations: { fr: "Cyan clair",   ar: "سماوي فاتح",    dr: "سماوي فاتح"      } },
  { id: "cyan",         name: "Cyan",         hex: "#06B6D4", translations: { fr: "Cyan",          ar: "سماوي",         dr: "سماوي"           } },
  { id: "teal",         name: "Teal",         hex: "#0F766E", translations: { fr: "Sarcelle",      ar: "أخضر مزرق",     dr: "أخضر مزرق"       } },
  { id: "turquoise",    name: "Turquoise",    hex: "#40E0D0", translations: { fr: "Turquoise",     ar: "فيروزي",        dr: "فيروزي"          } },
  { id: "aqua",         name: "Aqua",         hex: "#00FFFF", translations: { fr: "Aqua",          ar: "أكوا",          dr: "أكوا"            } },

  // Blues
  { id: "sky-blue",     name: "Sky Blue",     hex: "#38BDF8", translations: { fr: "Bleu ciel",    ar: "أزرق سماوي",    dr: "أزرق سما"        } },
  { id: "light-blue",   name: "Light Blue",   hex: "#93C5FD", translations: { fr: "Bleu clair",   ar: "أزرق فاتح",     dr: "أزرق فاتح"       } },
  { id: "blue",         name: "Blue",         hex: "#2563EB", translations: { fr: "Bleu",          ar: "أزرق",          dr: "أزرق"            } },
  { id: "dark-blue",    name: "Dark Blue",    hex: "#1E3A8A", translations: { fr: "Bleu foncé",   ar: "أزرق داكن",     dr: "أزرق قاتم"       } },
  { id: "navy-blue",    name: "Navy Blue",    hex: "#003153", translations: { fr: "Bleu marine",  ar: "كحلي",          dr: "كحلي"            } },
  { id: "royal-blue",   name: "Royal Blue",   hex: "#4169E1", translations: { fr: "Bleu royal",   ar: "أزرق ملكي",     dr: "أزرق ملكي"       } },
  { id: "cobalt",       name: "Cobalt",       hex: "#0047AB", translations: { fr: "Cobalt",        ar: "كوبالتي",       dr: "كوبالتي"         } },

  // Purples & Violets
  { id: "lavender",     name: "Lavender",     hex: "#E9D5FF", translations: { fr: "Lavande",       ar: "لافندر",        dr: "لافندر"          } },
  { id: "light-purple", name: "Light Purple", hex: "#C084FC", translations: { fr: "Violet clair", ar: "بنفسجي فاتح",   dr: "بنفسجي فاتح"     } },
  { id: "purple",       name: "Purple",       hex: "#7C3AED", translations: { fr: "Violet",        ar: "بنفسجي",        dr: "بنفسجي"          } },
  { id: "dark-purple",  name: "Dark Purple",  hex: "#4C1D95", translations: { fr: "Violet foncé", ar: "بنفسجي داكن",   dr: "بنفسجي قاتم"     } },
  { id: "violet",       name: "Violet",       hex: "#8B00FF", translations: { fr: "Violet pur",   ar: "أرجواني",       dr: "أرجواني"         } },
  { id: "indigo",       name: "Indigo",       hex: "#4F46E5", translations: { fr: "Indigo",        ar: "نيلي",          dr: "نيلي"            } },

  // Pinks & Magentas
  { id: "light-pink",   name: "Light Pink",   hex: "#FBCFE8", translations: { fr: "Rose clair",   ar: "وردي فاتح",     dr: "وردي فاتح"       } },
  { id: "pink",         name: "Pink",         hex: "#EC4899", translations: { fr: "Rose",          ar: "وردي",          dr: "وردي"            } },
  { id: "hot-pink",     name: "Hot Pink",     hex: "#FF69B4", translations: { fr: "Rose vif",      ar: "وردي فاقع",     dr: "وردي فاقع"       } },
  { id: "magenta",      name: "Magenta",      hex: "#FF00FF", translations: { fr: "Magenta",       ar: "ماجنتا",        dr: "ماجنتا"          } },
  { id: "rose",         name: "Rose",         hex: "#FB7185", translations: { fr: "Rose foncé",   ar: "وردي محمر",     dr: "وردي محمر"       } },
  { id: "fuchsia",      name: "Fuchsia",      hex: "#D946EF", translations: { fr: "Fuchsia",       ar: "فوشيا",         dr: "فوشيا"           } },

  // Silvers & Metallics
  { id: "silver",       name: "Silver",       hex: "#C0C0C0", translations: { fr: "Argent",        ar: "فضي",           dr: "فضي"             } },
  { id: "platinum",     name: "Platinum",     hex: "#E5E4E2", translations: { fr: "Platine",       ar: "بلاتيني",       dr: "بلاتيني"         } },
  { id: "champagne",    name: "Champagne",    hex: "#F7E7CE", translations: { fr: "Champagne",     ar: "شمبانيا",       dr: "شمبانيا"         } },
];

/** Find a predefined color by hex value (case-insensitive). */
export function findColorByHex(hex) {
  if (!hex) return null;
  const normalized = hex.trim().toUpperCase();
  return PREDEFINED_COLORS.find((c) => c.hex.toUpperCase() === normalized) ?? null;
}

/** Find a predefined color by id. */
export function findColorById(id) {
  if (!id) return null;
  return PREDEFINED_COLORS.find((c) => c.id === id) ?? null;
}

/**
 * Localized display name for a stored color `{ name, hex }`.
 * Matches the hex to the predefined palette and returns its locale name,
 * falling back to the stored English name for custom/legacy colors.
 */
export function localizeColorName(color, locale = "en") {
  if (!color) return "";
  const predefined = findColorByHex(color.hex);
  if (!predefined) return color.name ?? "";
  return predefined.translations?.[locale] ?? predefined.name;
}

