'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const AdminOrderViewContext = createContext({
  pendingOrderId: null,
  setPendingOrderId: () => {},
  openOrder: () => {},
  clearPendingOrder: () => {},
});

export function AdminOrderViewProvider({ children }) {
  const [pendingOrderId, setPendingOrderId] = useState(null);

  const openOrder = useCallback((id) => {
    setPendingOrderId(id);
  }, []);

  const clearPendingOrder = useCallback(() => {
    setPendingOrderId(null);
  }, []);

  return (
    <AdminOrderViewContext.Provider
      value={{ pendingOrderId, setPendingOrderId, openOrder, clearPendingOrder }}
    >
      {children}
    </AdminOrderViewContext.Provider>
  );
}

export function useAdminOrderView() {
  return useContext(AdminOrderViewContext);
}
