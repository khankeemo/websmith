"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  const handlersRef = useRef<Partial<DrawerHandlers>>({});

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

  const openCart = useCallback(() => handlersRef.current.openCart?.(), []);
  const openWishlist = useCallback(() => handlersRef.current.openWishlist?.(), []);
  const openHistory = useCallback(() => handlersRef.current.openHistory?.(), []);
  const openEmailCenter = useCallback(() => handlersRef.current.openEmailCenter?.(), []);

  const setDrawerHandlers = useCallback((h: DrawerHandlers) => {
    handlersRef.current = h;
  }, []);

  const value = useMemo(
    () => ({
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
    }),
    [searchQuery, cartCount, wishlistCount, openCart, openWishlist, openHistory, openEmailCenter, setDrawerHandlers]
  );

  return (
    <StoreUIContext.Provider value={value}>
      {children}
    </StoreUIContext.Provider>
  );
}

export function useStoreUI() {
  return useContext(StoreUIContext);
}
