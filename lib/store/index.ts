export type PaymentGateway = {
  id: string;
  name: string;
  displayName: string;
  supportedCurrencies: string[];
  isActive: boolean;
};

export const SUPPORTED_GATEWAYS: PaymentGateway[] = [
  { id: 'stripe', name: 'stripe', displayName: 'Stripe', supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR'], isActive: false },
  { id: 'razorpay', name: 'razorpay', displayName: 'Razorpay', supportedCurrencies: ['INR'], isActive: false },
  { id: 'paddle', name: 'paddle', displayName: 'Paddle', supportedCurrencies: ['USD', 'EUR', 'GBP'], isActive: false },
  { id: 'lemonsqueezy', name: 'lemonsqueezy', displayName: 'Lemon Squeezy', supportedCurrencies: ['USD'], isActive: false },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export function formatPrice(amount: number, currency = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

export function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${ts}-${rand}`;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'past_due' | 'trialing';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
