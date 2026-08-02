'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Phone, Search, ChevronDown, ExternalLink, MessageSquare as MessageSquareIcon, Plus, KeyRound } from 'lucide-react';
import UniversalEmailDialog from '@/components/internal-api/UniversalEmailDialog';

const LICENSE_PREFILL_KEY = 'license_prefill';

interface Enquiry {
  id: number;
  product_name: string;
  selected_plan: string | null;
  product_version: string | null;
  full_name: string;
  email: string;
  mobile: string;
  company: string | null;
  country: string | null;
  requirements: string | null;
  status: string;
  created_at: string;
}

export default function SalesEnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchEnquiries = async (status?: string) => {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : '';
      const res = await fetch(`/internal/backend/store/enquiries${query}`);
      const data = await res.json();
      if (data.success) setEnquiries(data.enquiries || []);
    } catch (e) {
      console.error('Failed to fetch enquiries', e);
    } finally {
      setLoading(false);
    }
  };

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleGenerateLicense = (enquiry: Enquiry) => {
    sessionStorage.setItem(LICENSE_PREFILL_KEY, JSON.stringify({
      enquiryId: enquiry.id,
      productName: enquiry.product_name,
      productVersion: enquiry.product_version,
      plan: enquiry.selected_plan,
      customerName: enquiry.full_name,
      customerEmail: enquiry.email,
      phone: enquiry.mobile,
      country: enquiry.country,
      notes: `Prefill from sales enquiry #${enquiry.id}${enquiry.requirements ? `: ${enquiry.requirements}` : ''}`,
    }));
    router.push('/internal/api/licenses/generate?prefill=1');
  };

  useEffect(() => { fetchEnquiries(statusFilter); }, [statusFilter]);

  const filtered = enquiries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.product_name.toLowerCase().includes(q) ||
      e.mobile.includes(q);
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Sales Enquiries</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Purchase enquiries from the Software Store
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <button
          onClick={() => setEmailDialogOpen(true)}
          style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#007AFF', color: 'white', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> New Enquiry
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', opacity: 0.4 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search enquiries..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading enquiries...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <MessageSquare style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.3 }} />
          <p>No enquiries found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filtered.map(enquiry => (
            <div key={enquiry.id} style={{
              padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)', display: 'grid', gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700 }}>{enquiry.full_name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: enquiry.status === 'new' ? 'rgba(0,122,255,0.12)' : enquiry.status === 'contacted' ? 'rgba(255,204,0,0.12)' : 'rgba(52,199,89,0.12)',
                      color: enquiry.status === 'new' ? '#007AFF' : enquiry.status === 'contacted' ? '#FFCC00' : '#34C759'
                    }}>
                      {enquiry.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <MessageSquare style={{ width: '12px', height: '12px' }} />
                    <strong>{enquiry.product_name}</strong>
                    {enquiry.selected_plan && <span>· {enquiry.selected_plan}</span>}
                    {enquiry.product_version && <span>· v{enquiry.product_version}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(enquiry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => handleGenerateLicense(enquiry)}
                    style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,122,255,0.12)', color: '#007AFF', border: '1px solid rgba(0,122,255,0.3)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                    title="Pre-fill the License Generator with this enquiry's details"
                  >
                    <KeyRound size={13} /> Generate License
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail style={{ width: '12px', height: '12px' }} /> {enquiry.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone style={{ width: '12px', height: '12px' }} /> {enquiry.mobile}
                </span>
                {enquiry.company && <span>🏢 {enquiry.company}</span>}
                {enquiry.country && <span>🌍 {enquiry.country}</span>}
              </div>

              {enquiry.requirements && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', lineHeight: 1.6 }}>
                  {enquiry.requirements}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Universal Email Dialog for new enquiries */}
      <UniversalEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        defaultEmail=""
        defaultLicenseKey=""
        defaultProductName=""
        defaultProductId=""
        defaultAction="support"
      />
    </div>
  );
}
