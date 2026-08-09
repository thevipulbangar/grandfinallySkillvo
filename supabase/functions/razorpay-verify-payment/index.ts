// Verifies the Razorpay checkout signature and credits the wallet.
// Deploy: supabase functions deploy razorpay-verify-payment
//
// Signature spec: HMAC-SHA256(order_id + "|" + payment_id, key_secret).

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Incomplete payment response.' }, 400);
    }

    const db = serviceClient();
    const { data: payment, error: lookupError } = await db
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!payment) return json({ error: 'Unknown order.' }, 404);
    if (payment.user_id !== user.id) return json({ error: 'This order belongs to another account.' }, 403);

    // Replay guard: a second call for a settled order must not credit again.
    if (payment.status === 'paid') {
      const { data: profile } = await db.from('profiles').select('credits').eq('id', user.id).single();
      return json({ credits: payment.credits, newBalance: profile?.credits ?? 0, paymentId: payment.id });
    }

    const expected = await hmacSha256Hex(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      Deno.env.get('RAZORPAY_KEY_SECRET')!,
    );

    if (!timingSafeEqual(expected, razorpay_signature)) {
      await db
        .from('payments')
        .update({ status: 'failed', failure_reason: 'signature_mismatch' })
        .eq('id', payment.id);
      return json({ error: 'Payment signature verification failed.' }, 400);
    }

    await db
      .from('payments')
      .update({
        status: 'paid',
        razorpay_payment_id,
        razorpay_signature,
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    const { data: newBalance, error: creditError } = await db.rpc('adjust_credits', {
      p_user_id: user.id,
      p_amount: payment.credits,
      p_reason: 'purchase',
      p_description: `${payment.pack_name} pack — ${payment.credits} credits`,
      p_payment_id: payment.id,
    });
    if (creditError) throw creditError;

    await db.from('notifications').insert({
      user_id: user.id,
      type: 'credit_added',
      message: `💳 Payment successful — ${payment.credits} Skillvo Credits added to your wallet.`,
      metadata: { payment_id: payment.id },
    });

    return json({ credits: payment.credits, newBalance, paymentId: payment.id });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not verify the payment.' }, 500);
  }
});
