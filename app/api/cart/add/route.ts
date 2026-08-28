import { NextResponse } from "next/server";
import { findBookBySlug } from "@/lib/mock-books";

type CartItemType = "book" | "product";

interface AddToCartBody {
  itemId: string;
  type: CartItemType;
  qty?: number;
  editionId?: string;
  // For type "product": there's no product-catalog fixture in this mock
  // layer (only businesses, which are profiles, not SKUs), so the client
  // supplies these and the server just echoes/validates shape. For type
  // "book" the server looks the item up itself and ignores these if sent.
  title?: string;
  price?: number;
  currency?: string;
  image?: string;
}

function isValidBody(value: unknown): value is AddToCartBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.itemId === "string" &&
    (v.type === "book" || v.type === "product")
  );
}

/**
 * POST /api/cart/add
 *
 * Judgment call: cart state itself lives client-side (useCartStore, Zustand
 * + localStorage per the brief) — this endpoint doesn't persist a
 * server-side cart. It exists to mirror the real backend's contract (so a
 * future cross-device/server-authoritative cart is a drop-in swap) by
 * validating the item and echoing back the normalized line the client
 * should add to its store.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "itemId (string) and type ('book'|'product') are required" },
      { status: 400 }
    );
  }

  const qty = body.qty && body.qty > 0 ? body.qty : 1;

  if (body.type === "book") {
    const book = findBookBySlug(body.itemId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      item: {
        id: `book:${book.slug}:${body.editionId ?? ""}`,
        itemId: book.slug,
        editionId: body.editionId,
        type: "book" as const,
        title: book.title,
        price: book.price,
        currency: book.currency,
        image: book.cover,
        qty,
      },
    });
  }

  // type === "product" — no server-side catalog to validate against; trust
  // client-supplied fields (see judgment-call note above).
  return NextResponse.json({
    success: true,
    item: {
      id: `product:${body.itemId}`,
      itemId: body.itemId,
      type: "product" as const,
      title: body.title ?? "Unknown product",
      price: body.price ?? 0,
      currency: body.currency ?? "KES",
      image: body.image,
      qty,
    },
  });
}
