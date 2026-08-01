'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronDown, ExternalLink, Package, CreditCard, KeyRound, Eye } from 'lucide-react';

interface OrderItem {
  id: number;
  order_id: number;
  product_id: string;
  product_name: string;
  plan_id: string;
  plan_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  license_key_generated: boolean;
  license_key: string | null;
}

interface Payment {
  id: number;
  order_id: number;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Order {
  id: number;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  payment_gateway: string | null;
  notes: string | null;
  billing_address: any;
  paid_at: string | null;
  payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payments: Payment[];
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/internal/backend/store/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setHasMore((page * pageSize) < (data.total || 0));
      }
    } catch (e) {
      console.error('Failed to fetch orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

  // Fetch items and payments for each order
  useEffect(() => {
    const enrichOrders = async () => {
      const dbOrders = [...orders];
      for (const order of dbOrders) {
        try {
          const [itemsRes, paymentsRes] = await Promise.all([
            fetch(`/internal/backend/store/orders/${order.id}/items`),
            fetch(`/internal/backend/store/orders/${order.id}/payments`),
          ]);
          const itemsData = await itemsRes.json();
          const paymentsData = await paymentsRes.json();
          if (itemsData.success) order.items = itemsData.items || [];
          if (paymentsData.success) order.payments = paymentsData.payments || [];
        } catch (e) {
          console.error(`Failed to enrich order ${order.id}`, e);
        }
      }
      setOrders(dbOrders);
    };
    if (orders.length > 0) enrichOrders();
  }, [orders]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.order_number.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q);
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(52,199,89,0.12)', color: '#34C759' };
      case 'paid': return { bg: 'rgba(52,199,89,0.12)', color: '#34C759' };
      case 'pending': return { bg: 'rgba(255,204,0,0.12)', color: '#FFCC00' };
      case 'failed': return { bg: 'rgba(255,59,48,0.12)', color: '#FF3B30' };
      case 'refunded': return { bg: 'rgba(0,122,255,0.12)', color: '#007AFF' };
      default: return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93' };
    }
  };

  const gatewayColor = (gateway: string | null) => {
    if (!gateway) return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93' };
    switch (gateway.toLowerCase()) {
      case 'stripe': return { bg: 'rgba(100,71,255,0.12)', color: '#6447FF' };
      case 'razorpay': return { bg: 'rgba(0,174,204,0.12)', color: '#00AECC' };
      case 'paypal': return { bg: 'rgba(0,113,191,0.12)', color: '#0071BF' };
      case 'paddle': return { bg: 'rgba(39,174,96,0.12)', color: '#27AE60' };
      case 'dummy': return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93' };
      default: return { bg: 'rgba(142,142,147,0.12)', color: '#8E8E93' };
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Sales Orders</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          All orders from the Software Store
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', opacity: 0.4 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <select
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', minWidth: '160px' }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <Package style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.3 }} />
          <p>No orders found</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '12px' }}>
            {filtered.map(order => {
              const sc = statusColor(order.status);
              const gc = gatewayColor(order.payment_gateway);
              return (
                <div key={order.id} style={{
                  padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)', display: 'grid', gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{order.order_number}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: sc.bg, color: sc.color
                        }}>
                          {order.status}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: gc.bg, color: gc.color
                        }}>
                          {order.payment_gateway?.toUpperCase() || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <KeyRound style={{ width: '12px', height: '12px' }} />
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CreditCard style={{ width: '12px', height: '12px' }} />
                          {order.total} {order.currency}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Package style={{ width: '12px', height: '12px' }} />
                          {order.items.filter(i => i.license_key_generated).length} license{order.items.filter(i => i.license_key_generated).length !== 1 ? 's' : ''} generated
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '200px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {order.paid_at && (
                        <div style={{ fontSize: '12px', color: '#34C759', marginTop: '4px' }}>
                          Paid: {new Date(order.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <KeyRound style={{ width: '12px', height: '12px' }} /> {order.customer_email}
                    </span>
                    {order.customer_name && <span>👤 {order.customer_name}</span>}
                    {order.coupon_code && <span style={{ color: '#007AFF' }}>🎫 {order.coupon_code}</span>}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Order Items</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                      {order.items.map(item => (
                        <div key={item.id} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.product_name}</div>
                            {item.license_key_generated && (
                              <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759' }}>
                                LICENSE GENERATED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <div>{item.plan_name} · Qty: {item.quantity}</div>
                            <div>{item.unit_price} {order.currency} × {item.quantity} = {item.total_price} {order.currency}</div>
                            {item.license_key && (
                              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontSize: '11px' }}>
                                <span style={{ backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.license_key}</span>
                                <Eye style={{ width: '12px', height: '12px', opacity: 0.6 }} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.payments.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Payments</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                        {order.payments.map(payment => (
                          <div key={payment.id} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 600 }}>{payment.amount} {payment.currency}</span>
                              <span style={{
                                padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
                                backgroundColor: payment.status === 'succeeded' || payment.status === 'completed' ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                                color: payment.status === 'succeeded' || payment.status === 'completed' ? '#34C759' : '#FF3B30'
                              }}>
                                {payment.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <div>Gateway: {payment.gateway}</div>
                              {payment.payment_intent_id && <div>Intent: {payment.payment_intent_id}</div>}
                              {payment.paid_at && <div>Paid: {new Date(payment.paid_at).toLocaleString()}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => window.open(`/internal/api/orders/${order.id}`, '_blank')}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink style={{ width: '14px', height: '14px' }} /> View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore || page > 1 ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px', alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Page {page} of {Math.ceil(total / pageSize)} ({total} total)
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore || loading}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', cursor: hasMore ? 'pointer' : 'not-allowed', opacity: hasMore ? 1 : 0.5 }}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}