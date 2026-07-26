/**
 * Customer identity resolution.
 *
 * The storefront lets people place orders as guests (no account). The admin
 * "Customers" screen must therefore combine two very different sources:
 *   1. Registered accounts (rows in `users`).
 *   2. Guest orders (rows in `orders` with `user_id IS NULL`).
 *
 * The same physical person can, and often does, appear multiple times with
 * slightly different information — a typo in the phone number, an extra
 * dot in an email, one order under "John Doe" and another under "Doe John".
 * We deduplicate with a small union-find on **normalised identity keys**:
 *
 *   • phone   — digits only, last 9 kept (strips country codes)
 *   • email   — lowercased, plus-tags removed, gmail dots removed
 *   • user_id — always authoritative
 *   • device  — browser cookie set by DeviceIdInit
 *
 * Any two records that share ANY strong key end up in the same cluster.
 * Weak keys (normalised name + city + address, all three present) act as a
 * lower-confidence fallback so long-standing repeat buyers who happen to
 * change their phone AND email still merge — but we never merge on a weak
 * key alone if it would join two clusters that already have a *different*
 * strong signal in common (implicit — same key means same set).
 *
 * This module is pure and covered by unit tests; keep it dependency-free.
 */

// ─── Normalisation helpers ────────────────────────────────────────────────

/**
 * Reduce a phone number to a comparable canonical form: digits only, last 9
 * kept. This strips leading zeros, country codes and formatting. Anything
 * with fewer than 6 digits is treated as garbage.
 */
export function normalizePhone(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length < 6) return null;
  return digits.slice(-9);
}

/**
 * Canonicalise an email address:
 *   • lowercase, trimmed
 *   • strip "+tag" from the local part
 *   • collapse `googlemail.com` into `gmail.com`
 *   • remove dots from the local part on gmail (address-plus-tags convention)
 */
export function normalizeEmail(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  const at = s.indexOf('@');
  if (at < 1 || at === s.length - 1) return null;
  let local = s.slice(0, at);
  let domain = s.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  if (!local) return null;
  return `${local}@${domain}`;
}

/**
 * Generic text normaliser used by the weak-signal keys: NFKD, strip
 * combining marks, lowercase, replace non-letter/non-digit with a single
 * space, collapse whitespace.
 */
export function normalizeText(raw) {
  if (raw == null) return '';
  return String(raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Order-insensitive name key: "John Doe" and "Doe John" normalise the same.
 * Single-word names normalise fine too, but they contribute much less info
 * so we require the weak key to include address+city as well.
 */
export function normalizeName(raw) {
  const t = normalizeText(raw);
  if (!t) return null;
  return t.split(' ').filter(Boolean).sort().join(' ');
}

const ADDRESS_NOISE = new RegExp(
  '\\b(' +
    'apt|apartment|appartement|appartment|apto|appt|ap|flat|fl|suite|ste|' +
    'no|nr|number|numero|floor|stage|etage|building|bldg|block|' +
    'rue|street|str|st|avenue|ave|av|boulevard|blvd|route|rte|' +
    'road|rd|way|lane|ln|drive|dr|place|plaza|plz' +
  ')\\b',
  'g'
);

/**
 * Address-like key: normalise text, strip common address noise so
 * "12 Rue de la Paix" and "12 Rue Paix Apt 3" have a chance to line up.
 * Returned key is empty ⇒ null so callers can skip.
 */
export function normalizeAddress(raw) {
  const t = normalizeText(raw);
  if (!t) return null;
  const cleaned = t.replace(ADDRESS_NOISE, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

// ─── Union-Find ────────────────────────────────────────────────────────────

class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }
  add(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }
  find(x) {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    // path compression
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const raRank = this.rank.get(ra);
    const rbRank = this.rank.get(rb);
    if (raRank < rbRank) {
      this.parent.set(ra, rb);
    } else if (raRank > rbRank) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, raRank + 1);
    }
  }
}

const K = {
  user:     (id) => `u:${id}`,
  order:    (id) => `o:${id}`,
  phone:    (p)  => `p:${p}`,
  email:    (e)  => `e:${e}`,
  device:   (d)  => `d:${d}`,
  nameaddr: (n, c, a) => `na:${n}|${c}|${a}`,
};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build customer clusters from raw admin data.
 *
 * @param {object} input
 * @param {Array}  input.users    Rows from `users` (any subset of columns).
 * @param {Array}  input.orders   Rows from `orders` (with `shipping_address`,
 *                                `device_id`, `total_amount`, `status`).
 * @param {Array=} input.devices  Rows from `user_devices` — used to bridge
 *                                a registered user to guest orders placed
 *                                from a browser they later logged in from.
 *
 * @returns {Array} clusters — one per person, in insertion-stable order.
 *          Each cluster has:
 *            id            — user UUID, or "guest:<earliest-order-uuid>"
 *            kind          — "user" | "guest"
 *            name, email, phone, address, city, country
 *            role, is_banned, banned_reason
 *            joined_at     — earliest signal we have for this person
 *            orders        — count of non-cancelled orders
 *            spent         — sum of non-cancelled order totals (MAD)
 *            last_order_at — most recent order timestamp
 *            signals       — array of strings ("phone" | "email" | "device")
 *            user_ids      — every registered account merged into the cluster
 *            order_ids     — every order id merged into the cluster
 *            guest_orders  — count of guest (user_id IS NULL) orders in the cluster
 */
export function buildCustomerClusters({ users = [], orders = [], devices = [] }) {
  const uf = new UnionFind();
  const userEntries = [];   // {key, ref}
  const orderEntries = [];  // {key, ref, isGuest}

  // 1. Every registered user contributes an anchor node and links it to any
  //    identity signals we know about them.
  for (const u of users) {
    if (!u?.id) continue;
    const anchor = K.user(u.id);
    uf.add(anchor);
    userEntries.push({ key: anchor, ref: u });

    const p = normalizePhone(u.phone_number);
    if (p) uf.union(anchor, K.phone(p));

    const e = normalizeEmail(u.email);
    if (e) uf.union(anchor, K.email(e));

    const n = normalizeName(u.full_name);
    const city = normalizeText(u.city);
    const addr = normalizeAddress(u.address);
    if (n && city && addr) uf.union(anchor, K.nameaddr(n, city, addr));
  }

  // 2. `user_devices` bridges a registered user to any guest order that
  //    later shares the same browser cookie.
  for (const d of devices) {
    if (!d?.user_id || !d?.device_id) continue;
    uf.union(K.user(d.user_id), K.device(d.device_id));
  }

  // 3. Every order (including guest orders) contributes signals. Registered
  //    orders anchor on their user; guest orders anchor on their own id.
  for (const o of orders) {
    if (!o?.id) continue;
    const isGuest = !o.user_id;
    const anchor = isGuest ? K.order(o.id) : K.user(o.user_id);
    uf.add(anchor);
    orderEntries.push({ key: anchor, ref: o, isGuest });

    const s = o.shipping_address ?? {};
    const p = normalizePhone(s.phone);
    if (p) uf.union(anchor, K.phone(p));

    // Some checkouts capture email in the shipping payload (future-proofing).
    const e = normalizeEmail(s.email);
    if (e) uf.union(anchor, K.email(e));

    if (o.device_id) uf.union(anchor, K.device(o.device_id));

    const n = normalizeName(s.full_name);
    const city = normalizeText(s.city);
    const addr = normalizeAddress(s.address);
    if (n && city && addr) uf.union(anchor, K.nameaddr(n, city, addr));
  }

  // 4. Gather clusters keyed by root.
  const clusters = new Map();
  const getCluster = (root) => {
    let c = clusters.get(root);
    if (!c) {
      c = { users: [], orders: [] };
      clusters.set(root, c);
    }
    return c;
  };

  for (const u of userEntries) getCluster(uf.find(u.key)).users.push(u.ref);
  for (const o of orderEntries) getCluster(uf.find(o.key)).orders.push(o.ref);

  // 5. Reduce each cluster to a display record.
  const out = [];
  for (const c of clusters.values()) {
    const usersSorted = c.users
      .slice()
      .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
    const primary = usersSorted[0] ?? null;

    const ordersSorted = c.orders
      .slice()
      .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
    const latest = ordersSorted[0];
    const oldestOrder = ordersSorted[ordersSorted.length - 1];

    // Prefer the registered account for contact info; fall back to the most
    // recent shipping payload (the customer's freshest self-reported data).
    const sa = latest?.shipping_address ?? {};
    const name =
      primary?.full_name ||
      sa.full_name ||
      primary?.email?.split('@')[0] ||
      'Guest customer';
    const email = primary?.email || sa.email || null;
    const phone = primary?.phone_number || sa.phone || null;
    const address = primary?.address || sa.address || null;
    const city = primary?.city || sa.city || null;
    const country = primary?.country || sa.country || null;

    const nonCancelled = ordersSorted.filter((o) => o.status !== 'cancelled');
    const spent = nonCancelled.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const lastOrderAt = nonCancelled[0]?.created_at ?? null;

    // Signals collected for this cluster (what we merged on).
    const signalSet = new Set();
    const seenPhones = new Set();
    const seenEmails = new Set();
    const seenDevices = new Set();
    for (const u of c.users) {
      const p = normalizePhone(u.phone_number);
      if (p) { signalSet.add('phone'); seenPhones.add(p); }
      const e = normalizeEmail(u.email);
      if (e) { signalSet.add('email'); seenEmails.add(e); }
    }
    for (const o of c.orders) {
      const p = normalizePhone(o.shipping_address?.phone);
      if (p) { signalSet.add('phone'); seenPhones.add(p); }
      const e = normalizeEmail(o.shipping_address?.email);
      if (e) { signalSet.add('email'); seenEmails.add(e); }
      if (o.device_id) { signalSet.add('device'); seenDevices.add(o.device_id); }
    }
    for (const d of devices) {
      // Only count devices that belong to a user in this cluster.
      if (!d?.user_id || !d?.device_id) continue;
      if (usersSorted.some((u) => u.id === d.user_id)) {
        signalSet.add('device');
        seenDevices.add(d.device_id);
      }
    }

    const guestOrderCount = c.orders.filter((o) => !o.user_id).length;
    const joinedAt =
      primary?.created_at ??
      oldestOrder?.created_at ??
      null;

    const id = primary
      ? primary.id
      : `guest:${oldestOrder?.id ?? 'unknown'}`;

    out.push({
      id,
      kind: primary ? 'user' : 'guest',
      name,
      email: email ?? '',
      phone: phone ?? '',
      address: address ?? '',
      city: city ?? '',
      country: country ?? '',
      role: primary?.role ?? null,
      is_banned: Boolean(primary?.is_banned),
      banned_reason: primary?.banned_reason ?? null,
      joined_at: joinedAt,
      orders: nonCancelled.length,
      spent: Number(spent.toFixed(2)),
      last_order_at: lastOrderAt,
      signals: [...signalSet],
      user_ids: usersSorted.map((u) => u.id),
      order_ids: ordersSorted.map((o) => o.id),
      device_ids: [...seenDevices],
      guest_orders: guestOrderCount,
    });
  }

  return out;
}

/**
 * Find the cluster in `clusters` that matches the given admin URL id.
 * Accepts either a user UUID or the "guest:<order-uuid>" form emitted by
 * `buildCustomerClusters()`.
 */
export function findClusterById(clusters, id) {
  if (!id) return null;
  if (typeof id === 'string' && id.startsWith('guest:')) {
    const orderId = id.slice('guest:'.length);
    return clusters.find((c) => c.order_ids.includes(orderId)) ?? null;
  }
  return clusters.find((c) => c.user_ids.includes(id)) ?? null;
}
