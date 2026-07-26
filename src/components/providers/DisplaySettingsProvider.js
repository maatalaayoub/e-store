/**
 * DisplaySettingsProvider
 *
 * Hydrates client components with the public storefront display settings that
 * were fetched server-side in the locale layout. Consumers read the settings
 * from React context — no client-side fetch, no first-paint flicker.
 *
 * Consumers may still hit `/api/v1/display-settings` for on-demand refreshes,
 * but the initial render always has the correct values.
 */

'use client';

import { createContext, useContext } from 'react';

const DisplaySettingsContext = createContext(null);

export default function DisplaySettingsProvider({ initial, children }) {
  return (
    <DisplaySettingsContext.Provider value={initial ?? null}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

/** Returns the server-hydrated display settings, or null if no provider is present. */
export function useDisplaySettings() {
  return useContext(DisplaySettingsContext);
}
