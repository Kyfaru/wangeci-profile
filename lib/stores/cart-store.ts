"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItemType = "book" | "product";

export interface CartItem {
  /** Unique cart line id — typically `${type}:${itemId}:${editionId ?? ""}`. */
  id: string;
  itemId: string;
  editionId?: string;
  type: CartItemType;
  title: string;
  price: number;
  currency: string;
  image?: string;
  qty: number;
}

export type NewCartItem = Omit<CartItem, "qty"> & { qty?: number };

interface CartState {
  items: CartItem[];
  addItem: (item: NewCartItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          const addQty = item.qty ?? 1;

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + addQty } : i
              ),
            };
          }

          return { items: [...state.items, { ...item, qty: addQty }] };
        }),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
        })),

      clear: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.qty * i.price, 0),
    }),
    {
      name: "wangeci-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
