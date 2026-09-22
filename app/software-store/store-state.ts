// FILE: app/software-store/store-state.ts
// PURPOSE: Single source of truth for Software Store client state — cart,
//          wishlist and compare hooks plus shared formatters and motion
//          variants. Shared by the storefront (app/software-store/page.tsx)
//          and the product details page (app/software-store/product/[id]/page.tsx).
//          Everything is persisted to localStorage keyed per-feature so the
//          storefront and product pages stay in sync.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { StoreProduct, StoreProductPlan } from "./services/softwareStoreService";

export const STORAGE_CART_KEY = "software_store_cart";
export const STORAGE_WISHLIST_KEY = "software_store_wishlist";
export const STORAGE_COMPARE_KEY = "software_store_compare";
export const STORAGE_HISTORY_EMAIL_KEY = "software_store_history_email";
export const MAX_COMPARE = 4;
export const GST_RATE = 0.18;

// Scoped premium dark theme — CSS variables are redefined only inside the
// software store subtree, so the rest of the site is untouched. Shared by the
// storefront wrapper AND the portaled Email Center modal (which escapes the
// store subtree via createPortal and therefore needs the vars applied inline).
export const STORE_DARK_STYLE = {
  "--bg-primary": "transparent",
  "--bg-secondary": "rgba(15, 23, 42, 0.75)",
  "--bg-tertiary": "rgba(30, 41, 59, 0.75)",
  "--text-primary": "#F1F5F9",
  "--text-secondary": "#94A3B8",
  "--text-muted": "#64748B",
  "--border-color": "rgba(255, 255, 255, 0.12)",
  "--card-shadow": "0 20px 60px -15px rgba(0, 0, 0, 0.6)",
  colorScheme: "dark",
} as CSSProperties;

export interface CartItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  quantity: number;
  addedAt: string;
}

export interface WishlistItem {
  product: StoreProduct;
  plan?: StoreProductPlan;
  addedAt: string;
}

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

export const formatDuration = (days: number) => {
  if (days >= 365) {
    const y = Math.floor(days / 365);
    return y === 1 ? "1 year" : `${y} years`;
  }
  if (days >= 30) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month" : `${m} months`;
  }
  return `${days} days`;
};

export const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
};

export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
};

export const slideInRight = {
  hidden: { x: "100%" },
  show: {
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    x: "100%",
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const staggerItem = (i: number) => ({
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, type: "spring" as const, stiffness: 260, damping: 24 },
  },
});

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CART_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(newItems));
  }, []);

  const addItem = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && (!plan || i.plan?.id === plan.id));
      if (existing) {
        const updated = prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
        localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
        return updated;
      }
      const updated = [...prev, { product, plan, quantity: 1, addedAt: new Date().toISOString() }];
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string, planId?: number) => {
    setItems((prev) => {
      const updated = prev.filter((i) => !(i.product.id === productId && (!planId || i.plan?.id === planId)));
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, planId: number | undefined, delta: number) => {
    setItems((prev) => {
      const updated = prev.map((i) => {
        if (i.product.id === productId && (!planId || i.plan?.id === planId)) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      });
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_CART_KEY);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + (i.plan?.price || i.product.price || 0) * i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, persist };
}

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_WISHLIST_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const addItem = useCallback((product: StoreProduct, plan?: StoreProductPlan) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.product.id === product.id && (!plan || i.plan?.id === plan.id));
      if (exists) return prev;
      const updated = [...prev, { product, plan, addedAt: new Date().toISOString() }];
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string, planId?: number) => {
    setItems((prev) => {
      const updated = prev.filter((i) => !(i.product.id === productId && (!planId || i.plan?.id === planId)));
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isInWishlist = useCallback(
    (productId: string, planId?: number) => {
      return items.some((i) => i.product.id === productId && (!planId || i.plan?.id === planId));
    },
    [items]
  );

  return { items, addItem, removeItem, isInWishlist };
}

export function useCompare() {
  const [items, setItems] = useState<StoreProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_COMPARE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback((product: StoreProduct) => {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      const next = exists ? prev.filter((p) => p.id !== product.id) : [...prev, product].slice(-MAX_COMPARE);
      localStorage.setItem(STORAGE_COMPARE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      localStorage.setItem(STORAGE_COMPARE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_COMPARE_KEY);
  }, []);

  const isInCompare = useCallback(
    (productId: string) => {
      return items.some((p) => p.id === productId);
    },
    [items]
  );

  return { items, toggle, remove, clear, isInCompare };
}
