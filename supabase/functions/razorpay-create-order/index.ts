// Creates a Razorpay order and records a 'created' payment row.
// Deploy: supabase functions deploy razorpay-create-order
//
// The credit packs are defined here, server-side, so a tampered client cannot
// buy 10,000 credits for ₹1.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

// Keyed by the pack names rendered in the wallet UI (src/App.tsx). Keep the two
// in step: an unknown name is rejected with a 400.
const CREDIT_PACKS: Record<string, { credits: number; rupees: number }> = {
  'Starter Credit Pack': { credits: 50, rupees: 39 },
  'Popular Learning Pack': { credits: 100, rupees: 69 },
  'Pro Scholar Pack': { credits: 500, rupees: 299 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const { packName } = await req.json();

    const pack = CREDIT_PACKS[packName];
    if (!pack) return json({ error: 'Unknown credit pack.' }, 400);

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const amountPaise = pack.rupees * 100;

    const receipt = `skv_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { user_id: user.id, pack_name: packName, credits: String(pack.credits) },
      }),
    });

    if (!razorpayRes.ok) {
      console.error('razorpay order failed', await razorpayRes.text());
      return json({ error: 'Payment provider rejected the order.' }, 502);
    }

    const order = await razorpayRes.json();
    const db = serviceClient();

    const { data: payment, error } = await db
      .from('payments')
      .insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        pack_name: packName,
        credits: pack.credits,
        amount_paise: amountPaise,
        currency: 'INR',
        status: 'created',
      })
      .select('id')
      .single();

    if (error) throw error;

    return json({
      orderId: order.id,
      amountPaise,
      currency: 'INR',
      keyId,
      paymentRowId: payment.id,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not create the payment order.' }, 500);
  }
});
