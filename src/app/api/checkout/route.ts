import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();
    if (!items || !items.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const origin = request.headers.get("origin") || "https://cleatvault.vercel.app";
    const PRICE = 9900;

    const lineItems = items.map((item: { name: string; size: string; qty: number }) => ({
      name: `${item.name} — Size ${item.size}`,
      quantity: String(Math.min(Math.max(1, parseInt(String(item.qty)) || 1), 10)),
      base_price_money: { amount: PRICE, currency: "GBP" },
    }));

    const subtotal = PRICE * lineItems.reduce((s: number, li: { quantity: string }) => s + parseInt(li.quantity), 0);
    const freeShipping = subtotal >= 15000;

    const body: Record<string, unknown> = {
      idempotency_key: `cv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        line_items: lineItems,
        ...(freeShipping ? {} : {
          service_charges: [{
            name: "Standard delivery (2–4 days)",
            amount_money: { amount: 495, currency: "GBP" },
            calculation_phase: "SUBTOTAL_PHASE",
          }],
        }),
      },
      checkout_options: {
        redirect_url: `${origin}/success.html`,
        ask_for_shipping_address: true,
      },
    };

    const res = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Square-Version": "2024-01-18",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const url = data.payment_link?.url;

    if (!url) {
      console.error("Square response:", JSON.stringify(data));
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
