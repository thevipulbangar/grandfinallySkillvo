/**
 * Razorpay credit purchases.
 *
 * The browser never sees the Razorpay key secret: it asks the
 * `razorpay-create-order` Edge Function for an order, opens Razorpay Checkout
 * with the public key id, and hands the result back to
 * `razorpay-verify-payment`, which checks the HMAC signature and credits the
 * wallet server-side.
 */
import { supabase } from '../lib/supabase';
import type { PaymentRow } from '../lib/database.types';

export interface CreditPackage {
  packName: string;
  credits: number;
  priceRupees: number;
  popular?: boolean;
}

interface CreateOrderResponse {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  paymentRowId: string;
}

export interface CheckoutResult {
  credits: number;
  newBalance: number;
  paymentId: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout')));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
    document.head.appendChild(script);
  });
}

export async function createOrder(pack: CreditPackage): Promise<CreateOrderResponse> {
  const { data, error } = await supabase.functions.invoke<CreateOrderResponse>('razorpay-create-order', {
    body: { packName: pack.packName, credits: pack.credits, amountRupees: pack.priceRupees },
  });
  if (error) throw error;
  if (!data) throw new Error('Could not create the payment order.');
  return data;
}

/**
 * Full purchase flow. Resolves once the payment is verified and the credits
 * are in the wallet; rejects if the user dismisses checkout or verification
 * fails.
 */
export async function purchaseCredits(
  pack: CreditPackage,
  buyer: { name: string; email: string },
): Promise<CheckoutResult> {
  await loadRazorpayScript();
  const order = await createOrder(pack);

  const razorpayResponse = await new Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: 'Skillvo',
      description: `${pack.credits} Skillvo Credits — ${pack.packName}`,
      prefill: { name: buyer.name, email: buyer.email },
      theme: { color: '#6366f1' },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    });
    checkout.on('payment.failed', (response: unknown) => {
      const reason =
        (response as { error?: { description?: string } })?.error?.description ?? 'Payment failed.';
      reject(new Error(reason));
    });
    checkout.open();
  });

  const { data, error } = await supabase.functions.invoke<CheckoutResult>('razorpay-verify-payment', {
    body: razorpayResponse,
  });
  if (error) throw error;
  if (!data) throw new Error('Payment could not be verified.');
  return data;
}

export async function listPayments(userId: string, limit = 25): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
