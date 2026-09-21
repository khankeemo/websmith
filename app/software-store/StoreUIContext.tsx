"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { STORAGE_CART_KEY, STORAGE_WISHLIST_KEY } from "./store-state";

type DrawerHandlers = {
  openCart: () => void;
  openWishlist: () => void;
  openHistory: () => void;
  openEmailCenter: () => void;
};

type StoreUIContextType = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cartCount: number;
  wishlistCount: number;
  setCartCount: (c: number) => void;
  setWishlistCount: (w: number) => void;
  openCart: () => void;
  openWishlist: () => void;
  openHistory: () => void;
  openEmailCenter: () => void;
  setDrawerHandlers: (handlers: DrawerHandlers) => void;
};

const StoreUIContext = createContext<StoreUIContextType | null>(null);

export function StoreUIProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [handlers, setHandlers] = useState<Partial<DrawerHandlers>>({});

  useEffect(() => {
    const updateCounts = () => {
      try {
        const c = localStorage.getItem(STORAGE_CART_KEY);
        if (c) {
          const items = JSON.parse(c);
          if (Array.isArray(items)) {
            setCartCount(items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0));
          }
        } else {
          setCartCount(0);
        }
        const w = localStorage.getItem(STORAGE_WISHLIST_KEY);
        if (w) {
          const items = JSON.parse(w);
          if (Array.isArray(items)) {
            setWishlistCount(items.length || 0);
          }
        } else {
          setWishlistCount(0);
        }
      } catch {}
    };

    updateCounts();
    window.addEventListener("storage", updateCounts);
    window.addEventListener("wsd-store-counts-updated", updateCounts);
    return () => {
      window.removeEventListener("storage", updateCounts);
      window.removeEventListener("wsd-store-counts-updated", updateCounts);
    };
  }, []);

  const openCart = useCallback(() => handlers.openCart?.(), [handlers]);
  const openWishlist = useCallback(() => handlers.openWishlist?.(), [handlers]);
  const openHistory = useCallback(() => handlers.openHistory?.(), [handlers]);
  const openEmailCenter = useCallback(() => handlers.openEmailCenter?.(), [handlers]);

  const setDrawerHandlers = useCallback((h: DrawerHandlers) => {
    setHandlers(h);
  }, []);

  return (
    <StoreUIContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        cartCount,
        wishlistCount,
        setCartCount,
        setWishlistCount,
        openCart,
        openWishlist,
        openHistory,
        openEmailCenter,
        setDrawerHandlers,
      }}
    >
      {children}
    </StoreUIContext.Provider>
  );
}

export function useStoreUI() {
  return useContext(StoreUIContext);
}
