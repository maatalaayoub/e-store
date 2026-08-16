"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Search, Loader2, X } from "lucide-react";

const DEFAULT_CENTER = [31.7917, -7.0926]; // Morocco
const DEFAULT_ZOOM = 5;
const MARKER_ZOOM = 15;

function pinIcon(L) {
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="40" viewBox="0 0 24 24" fill="#2563eb" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M12 21s7-6.6 7-11a7 7 0 1 0-14 0c0 4.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5" fill="#fff" stroke="none"/></svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
  });
}

/**
 * Interactive, keyless store-location picker (Leaflet + OpenStreetMap).
 * Click or drag the marker to set coordinates. `onChange(lat, lng)` receives
 * numbers, or `(null, null)` when cleared.
 */
export default function LocationPicker({ lat, lng, onChange, dict = {} }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const hasCoords =
    lat !== "" && lat != null && lng !== "" && lng != null &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  const placeMarker = useCallback((la, ln, fly = false) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    } else {
      const marker = L.marker([la, ln], { draggable: true, icon: pinIcon(L) }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current?.(round(p.lat), round(p.lng));
      });
      markerRef.current = marker;
    }
    if (fly) map.setView([la, ln], Math.max(map.getZoom(), MARKER_ZOOM));
  }, []);

  // Initialize the map (Leaflet is loaded client-side only to avoid SSR window access).
  useEffect(() => {
    let cancelled = false;
    import("leaflet")
      .then((mod) => {
        const L = mod.default ?? mod;
        if (cancelled || !containerRef.current || mapRef.current) return;
        leafletRef.current = L;
        const center = hasCoords ? [Number(lat), Number(lng)] : DEFAULT_CENTER;
        const zoom = hasCoords ? MARKER_ZOOM : DEFAULT_ZOOM;
        const map = L.map(containerRef.current).setView(center, zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        map.on("click", (e) => {
          placeMarker(e.latlng.lat, e.latlng.lng);
          onChangeRef.current?.(round(e.latlng.lat), round(e.latlng.lng));
        });
        mapRef.current = map;
        if (hasCoords) placeMarker(Number(lat), Number(lng));
        setReady(true);
        // Leaflet needs a size recalc once its container is laid out.
        setTimeout(() => map.invalidateSize(), 0);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when coords change from outside (e.g. reset).
  useEffect(() => {
    if (!ready) return;
    if (hasCoords) {
      placeMarker(Number(lat), Number(lng));
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = round(pos.coords.latitude);
        const ln = round(pos.coords.longitude);
        placeMarker(la, ln, true);
        onChangeRef.current?.(la, ln);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const json = await res.json();
      const hit = Array.isArray(json) ? json[0] : null;
      if (hit) {
        const la = round(Number(hit.lat));
        const ln = round(Number(hit.lon));
        placeMarker(la, ln, true);
        onChangeRef.current?.(la, ln);
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChangeRef.current?.(null, null);
  };

  if (failed) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="w-full rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="Latitude"
            value={lat ?? ""}
            onChange={(e) => onChange?.(e.target.value, lng)}
          />
          <input
            className="w-full rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="Longitude"
            value={lng ?? ""}
            onChange={(e) => onChange?.(lat, e.target.value)}
          />
        </div>
        <p className="text-xs text-zinc-400">
          {dict.map_load_failed ?? "Map could not load. Enter coordinates manually."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={search} className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.map_search_placeholder ?? "Search an address…"}
            className="w-full rounded-[5px] border border-zinc-200 bg-white ps-9 pe-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </form>
        <button
          type="button"
          onClick={search}
          disabled={searching || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-[5px] bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {dict.map_search ?? "Search"}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {dict.map_use_location ?? "My location"}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative z-0 h-72 w-full overflow-hidden rounded-[5px] border border-zinc-200 bg-zinc-100"
      />

      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {hasCoords
            ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
            : (dict.map_pick_hint ?? "Click on the map to set the store location.")}
        </span>
        {hasCoords && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-[5px] bg-zinc-100 px-2 py-1 text-zinc-600 hover:bg-zinc-200 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
            {dict.map_clear ?? "Clear"}
          </button>
        )}
      </div>
    </div>
  );
}

function round(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}
