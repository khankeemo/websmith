// FILE: app/internal/api/sales/purchase/page.tsx
// PURPOSE: Internal license generation page - create licenses for customers
// ACCESS: Internal admin only
// URL: https://www.websmithdigital.com/internal/api/sales/purchase
// Supports direct links: ?productId=xxx&planId=yyy
// FIX: Added Suspense boundary for useSearchParams() to fix prerender error

'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const COUNTRIES = [
  { code: "+93", country: "AF", name: "Afghanistan", pattern: /^\d{9}$/ },
  { code: "+355", country: "AL", name: "Albania", pattern: /^\d{9}$/ },
  { code: "+213", country: "DZ", name: "Algeria", pattern: /^\d{9}$/ },
  { code: "+376", country: "AD", name: "Andorra", pattern: /^\d{6}$/ },
  { code: "+244", country: "AO", name: "Angola", pattern: /^\d{9}$/ },
  { code: "+54", country: "AR", name: "Argentina", pattern: /^\d{10}$/ },
  { code: "+374", country: "AM", name: "Armenia", pattern: /^\d{8}$/ },
  { code: "+61", country: "AU", name: "Australia", pattern: /^\d{9}$/ },
  { code: "+43", country: "AT", name: "Austria", pattern: /^\d{10}$/ },
  { code: "+994", country: "AZ", name: "Azerbaijan", pattern: /^\d{9}$/ },
  { code: "+973", country: "BH", name: "Bahrain", pattern: /^\d{8}$/ },
  { code: "+880", country: "BD", name: "Bangladesh", pattern: /^\d{10}$/ },
  { code: "+375", country: "BY", name: "Belarus", pattern: /^\d{9}$/ },
  { code: "+32", country: "BE", name: "Belgium", pattern: /^\d{9}$/ },
  { code: "+501", country: "BZ", name: "Belize", pattern: /^\d{7}$/ },
  { code: "+229", country: "BJ", name: "Benin", pattern: /^\d{8}$/ },
  { code: "+975", country: "BT", name: "Bhutan", pattern: /^\d{8}$/ },
  { code: "+591", country: "BO", name: "Bolivia", pattern: /^\d{8}$/ },
  { code: "+387", country: "BA", name: "Bosnia & Herzegovina", pattern: /^\d{8}$/ },
  { code: "+267", country: "BW", name: "Botswana", pattern: /^\d{8}$/ },
  { code: "+55", country: "BR", name: "Brazil", pattern: /^\d{10,11}$/ },
  { code: "+673", country: "BN", name: "Brunei", pattern: /^\d{7}$/ },
  { code: "+359", country: "BG", name: "Bulgaria", pattern: /^\d{9}$/ },
  { code: "+226", country: "BF", name: "Burkina Faso", pattern: /^\d{8}$/ },
  { code: "+257", country: "BI", name: "Burundi", pattern: /^\d{8}$/ },
  { code: "+855", country: "KH", name: "Cambodia", pattern: /^\d{9}$/ },
  { code: "+237", country: "CM", name: "Cameroon", pattern: /^\d{9}$/ },
  { code: "+1", country: "CA", name: "Canada", pattern: /^\d{10}$/ },
  { code: "+238", country: "CV", name: "Cape Verde", pattern: /^\d{7}$/ },
  { code: "+236", country: "CF", name: "Central African Republic", pattern: /^\d{8}$/ },
  { code: "+235", country: "TD", name: "Chad", pattern: /^\d{8}$/ },
  { code: "+56", country: "CL", name: "Chile", pattern: /^\d{9}$/ },
  { code: "+86", country: "CN", name: "China", pattern: /^\d{11}$/ },
  { code: "+57", country: "CO", name: "Colombia", pattern: /^\d{10}$/ },
  { code: "+269", country: "KM", name: "Comoros", pattern: /^\d{7}$/ },
  { code: "+242", country: "CG", name: "Congo", pattern: /^\d{9}$/ },
  { code: "+506", country: "CR", name: "Costa Rica", pattern: /^\d{8}$/ },
  { code: "+385", country: "HR", name: "Croatia", pattern: /^\d{9}$/ },
  { code: "+53", country: "CU", name: "Cuba", pattern: /^\d{8}$/ },
  { code: "+357", country: "CY", name: "Cyprus", pattern: /^\d{8}$/ },
  { code: "+420", country: "CZ", name: "Czech Republic", pattern: /^\d{9}$/ },
  { code: "+45", country: "DK", name: "Denmark", pattern: /^\d{8}$/ },
  { code: "+253", country: "DJ", name: "Djibouti", pattern: /^\d{8}$/ },
  { code: "+593", country: "EC", name: "Ecuador", pattern: /^\d{9}$/ },
  { code: "+20", country: "EG", name: "Egypt", pattern: /^\d{10}$/ },
  { code: "+503", country: "SV", name: "El Salvador", pattern: /^\d{8}$/ },
  { code: "+240", country: "GQ", name: "Equatorial Guinea", pattern: /^\d{9}$/ },
  { code: "+291", country: "ER", name: "Eritrea", pattern: /^\d{7}$/ },
  { code: "+372", country: "EE", name: "Estonia", pattern: /^\d{8}$/ },
  { code: "+251", country: "ET", name: "Ethiopia", pattern: /^\d{9}$/ },
  { code: "+679", country: "FJ", name: "Fiji", pattern: /^\d{7}$/ },
  { code: "+358", country: "FI", name: "Finland", pattern: /^\d{9}$/ },
  { code: "+33", country: "FR", name: "France", pattern: /^\d{9}$/ },
  { code: "+241", country: "GA", name: "Gabon", pattern: /^\d{8}$/ },
  { code: "+220", country: "GM", name: "Gambia", pattern: /^\d{7}$/ },
  { code: "+995", country: "GE", name: "Georgia", pattern: /^\d{9}$/ },
  { code: "+49", country: "DE", name: "Germany", pattern: /^\d{10,11}$/ },
  { code: "+233", country: "GH", name: "Ghana", pattern: /^\d{10}$/ },
  { code: "+30", country: "GR", name: "Greece", pattern: /^\d{10}$/ },
  { code: "+299", country: "GL", name: "Greenland", pattern: /^\d{6}$/ },
  { code: "+502", country: "GT", name: "Guatemala", pattern: /^\d{8}$/ },
  { code: "+224", country: "GN", name: "Guinea", pattern: /^\d{9}$/ },
  { code: "+245", country: "GW", name: "Guinea-Bissau", pattern: /^\d{7}$/ },
  { code: "+592", country: "GY", name: "Guyana", pattern: /^\d{7}$/ },
  { code: "+509", country: "HT", name: "Haiti", pattern: /^\d{8}$/ },
  { code: "+504", country: "HN", name: "Honduras", pattern: /^\d{8}$/ },
  { code: "+852", country: "HK", name: "Hong Kong", pattern: /^\d{8}$/ },
  { code: "+36", country: "HU", name: "Hungary", pattern: /^\d{9}$/ },
  { code: "+354", country: "IS", name: "Iceland", pattern: /^\d{7}$/ },
  { code: "+91", country: "IN", name: "India", pattern: /^\d{10}$/ },
  { code: "+62", country: "ID", name: "Indonesia", pattern: /^\d{10,12}$/ },
  { code: "+98", country: "IR", name: "Iran", pattern: /^\d{10}$/ },
  { code: "+964", country: "IQ", name: "Iraq", pattern: /^\d{10}$/ },
  { code: "+353", country: "IE", name: "Ireland", pattern: /^\d{9}$/ },
  { code: "+972", country: "IL", name: "Israel", pattern: /^\d{9}$/ },
  { code: "+39", country: "IT", name: "Italy", pattern: /^\d{10}$/ },
  { code: "+225", country: "CI", name: "Ivory Coast", pattern: /^\d{8}$/ },
  { code: "+81", country: "JP", name: "Japan", pattern: /^\d{10,11}$/ },
  { code: "+962", country: "JO", name: "Jordan", pattern: /^\d{9}$/ },
  { code: "+7", country: "KZ", name: "Kazakhstan", pattern: /^\d{10}$/ },
  { code: "+254", country: "KE", name: "Kenya", pattern: /^\d{10}$/ },
  { code: "+686", country: "KI", name: "Kiribati", pattern: /^\d{5}$/ },
  { code: "+965", country: "KW", name: "Kuwait", pattern: /^\d{8}$/ },
  { code: "+996", country: "KG", name: "Kyrgyzstan", pattern: /^\d{9}$/ },
  { code: "+856", country: "LA", name: "Laos", pattern: /^\d{8}$/ },
  { code: "+371", country: "LV", name: "Latvia", pattern: /^\d{8}$/ },
  { code: "+961", country: "LB", name: "Lebanon", pattern: /^\d{8}$/ },
  { code: "+266", country: "LS", name: "Lesotho", pattern: /^\d{8}$/ },
  { code: "+231", country: "LR", name: "Liberia", pattern: /^\d{8}$/ },
  { code: "+218", country: "LY", name: "Libya", pattern: /^\d{9}$/ },
  { code: "+423", country: "LI", name: "Liechtenstein", pattern: /^\d{7}$/ },
  { code: "+370", country: "LT", name: "Lithuania", pattern: /^\d{8}$/ },
  { code: "+352", country: "LU", name: "Luxembourg", pattern: /^\d{9}$/ },
  { code: "+853", country: "MO", name: "Macau", pattern: /^\d{8}$/ },
  { code: "+261", country: "MG", name: "Madagascar", pattern: /^\d{9}$/ },
  { code: "+265", country: "MW", name: "Malawi", pattern: /^\d{9}$/ },
  { code: "+60", country: "MY", name: "Malaysia", pattern: /^\d{9,10}$/ },
  { code: "+960", country: "MV", name: "Maldives", pattern: /^\d{7}$/ },
  { code: "+223", country: "ML", name: "Mali", pattern: /^\d{8}$/ },
  { code: "+356", country: "MT", name: "Malta", pattern: /^\d{8}$/ },
  { code: "+692", country: "MH", name: "Marshall Islands", pattern: /^\d{7}$/ },
  { code: "+222", country: "MR", name: "Mauritania", pattern: /^\d{8}$/ },
  { code: "+230", country: "MU", name: "Mauritius", pattern: /^\d{8}$/ },
  { code: "+52", country: "MX", name: "Mexico", pattern: /^\d{10}$/ },
  { code: "+691", country: "FM", name: "Micronesia", pattern: /^\d{7}$/ },
  { code: "+373", country: "MD", name: "Moldova", pattern: /^\d{8}$/ },
  { code: "+377", country: "MC", name: "Monaco", pattern: /^\d{8}$/ },
  { code: "+976", country: "MN", name: "Mongolia", pattern: /^\d{8}$/ },
  { code: "+382", country: "ME", name: "Montenegro", pattern: /^\d{8}$/ },
  { code: "+212", country: "MA", name: "Morocco", pattern: /^\d{9}$/ },
  { code: "+258", country: "MZ", name: "Mozambique", pattern: /^\d{9}$/ },
  { code: "+95", country: "MM", name: "Myanmar", pattern: /^\d{8,10}$/ },
  { code: "+264", country: "NA", name: "Namibia", pattern: /^\d{9}$/ },
  { code: "+674", country: "NR", name: "Nauru", pattern: /^\d{7}$/ },
  { code: "+977", country: "NP", name: "Nepal", pattern: /^\d{10}$/ },
  { code: "+31", country: "NL", name: "Netherlands", pattern: /^\d{9}$/ },
  { code: "+64", country: "NZ", name: "New Zealand", pattern: /^\d{9}$/ },
  { code: "+505", country: "NI", name: "Nicaragua", pattern: /^\d{8}$/ },
  { code: "+227", country: "NE", name: "Niger", pattern: /^\d{8}$/ },
  { code: "+234", country: "NG", name: "Nigeria", pattern: /^\d{10,11}$/ },
  { code: "+389", country: "MK", name: "North Macedonia", pattern: /^\d{8}$/ },
  { code: "+47", country: "NO", name: "Norway", pattern: /^\d{8}$/ },
  { code: "+968", country: "OM", name: "Oman", pattern: /^\d{8}$/ },
  { code: "+92", country: "PK", name: "Pakistan", pattern: /^\d{10}$/ },
  { code: "+680", country: "PW", name: "Palau", pattern: /^\d{7}$/ },
  { code: "+970", country: "PS", name: "Palestine", pattern: /^\d{9}$/ },
  { code: "+507", country: "PA", name: "Panama", pattern: /^\d{8}$/ },
  { code: "+675", country: "PG", name: "Papua New Guinea", pattern: /^\d{8}$/ },
  { code: "+595", country: "PY", name: "Paraguay", pattern: /^\d{9}$/ },
  { code: "+51", country: "PE", name: "Peru", pattern: /^\d{9}$/ },
  { code: "+63", country: "PH", name: "Philippines", pattern: /^\d{10}$/ },
  { code: "+48", country: "PL", name: "Poland", pattern: /^\d{9}$/ },
  { code: "+351", country: "PT", name: "Portugal", pattern: /^\d{9}$/ },
  { code: "+974", country: "QA", name: "Qatar", pattern: /^\d{8}$/ },
  { code: "+40", country: "RO", name: "Romania", pattern: /^\d{10}$/ },
  { code: "+7", country: "RU", name: "Russia", pattern: /^\d{10}$/ },
  { code: "+250", country: "RW", name: "Rwanda", pattern: /^\d{9}$/ },
  { code: "+685", country: "WS", name: "Samoa", pattern: /^\d{7}$/ },
  { code: "+378", country: "SM", name: "San Marino", pattern: /^\d{10}$/ },
  { code: "+239", country: "ST", name: "Sao Tome & Principe", pattern: /^\d{7}$/ },
  { code: "+966", country: "SA", name: "Saudi Arabia", pattern: /^\d{9}$/ },
  { code: "+221", country: "SN", name: "Senegal", pattern: /^\d{9}$/ },
  { code: "+381", country: "RS", name: "Serbia", pattern: /^\d{9}$/ },
  { code: "+248", country: "SC", name: "Seychelles", pattern: /^\d{7}$/ },
  { code: "+232", country: "SL", name: "Sierra Leone", pattern: /^\d{8}$/ },
  { code: "+65", country: "SG", name: "Singapore", pattern: /^\d{8}$/ },
  { code: "+421", country: "SK", name: "Slovakia", pattern: /^\d{9}$/ },
  { code: "+386", country: "SI", name: "Slovenia", pattern: /^\d{9}$/ },
  { code: "+677", country: "SB", name: "Solomon Islands", pattern: /^\d{7}$/ },
  { code: "+252", country: "SO", name: "Somalia", pattern: /^\d{8}$/ },
  { code: "+27", country: "ZA", name: "South Africa", pattern: /^\d{9}$/ },
  { code: "+82", country: "KR", name: "South Korea", pattern: /^\d{10,11}$/ },
  { code: "+211", country: "SS", name: "South Sudan", pattern: /^\d{9}$/ },
  { code: "+34", country: "ES", name: "Spain", pattern: /^\d{9}$/ },
  { code: "+94", country: "LK", name: "Sri Lanka", pattern: /^\d{10}$/ },
  { code: "+249", country: "SD", name: "Sudan", pattern: /^\d{10}$/ },
  { code: "+597", country: "SR", name: "Suriname", pattern: /^\d{7}$/ },
  { code: "+268", country: "SZ", name: "Eswatini", pattern: /^\d{8}$/ },
  { code: "+46", country: "SE", name: "Sweden", pattern: /^\d{9,10}$/ },
  { code: "+41", country: "CH", name: "Switzerland", pattern: /^\d{9}$/ },
  { code: "+963", country: "SY", name: "Syria", pattern: /^\d{9}$/ },
  { code: "+886", country: "TW", name: "Taiwan", pattern: /^\d{9}$/ },
  { code: "+992", country: "TJ", name: "Tajikistan", pattern: /^\d{9}$/ },
  { code: "+255", country: "TZ", name: "Tanzania", pattern: /^\d{10}$/ },
  { code: "+66", country: "TH", name: "Thailand", pattern: /^\d{9,10}$/ },
  { code: "+670", country: "TL", name: "Timor-Leste", pattern: /^\d{8}$/ },
  { code: "+228", country: "TG", name: "Togo", pattern: /^\d{8}$/ },
  { code: "+676", country: "TO", name: "Tonga", pattern: /^\d{7}$/ },
  { code: "+216", country: "TN", name: "Tunisia", pattern: /^\d{8}$/ },
  { code: "+90", country: "TR", name: "Turkey", pattern: /^\d{10}$/ },
  { code: "+993", country: "TM", name: "Turkmenistan", pattern: /^\d{8}$/ },
  { code: "+688", country: "TV", name: "Tuvalu", pattern: /^\d{5}$/ },
  { code: "+256", country: "UG", name: "Uganda", pattern: /^\d{10}$/ },
  { code: "+380", country: "UA", name: "Ukraine", pattern: /^\d{10}$/ },
  { code: "+971", country: "AE", name: "United Arab Emirates", pattern: /^\d{9}$/ },
  { code: "+44", country: "GB", name: "United Kingdom", pattern: /^\d{10,11}$/ },
  { code: "+1", country: "US", name: "United States", pattern: /^\d{10}$/ },
  { code: "+598", country: "UY", name: "Uruguay", pattern: /^\d{8}$/ },
  { code: "+998", country: "UZ", name: "Uzbekistan", pattern: /^\d{9}$/ },
  { code: "+678", country: "VU", name: "Vanuatu", pattern: /^\d{7}$/ },
  { code: "+379", country: "VA", name: "Vatican City", pattern: /^\d{9}$/ },
  { code: "+58", country: "VE", name: "Venezuela", pattern: /^\d{10}$/ },
  { code: "+84", country: "VN", name: "Vietnam", pattern: /^\d{9,10}$/ },
  { code: "+967", country: "YE", name: "Yemen", pattern: /^\d{9}$/ },
  { code: "+260", country: "ZM", name: "Zambia", pattern: /^\d{9}$/ },
  { code: "+263", country: "ZW", name: "Zimbabwe", pattern: /^\d{9}$/ },
];

// Types
interface Plan {
  id: number;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  max_devices: number;
  features: string[];
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
}

// Component that uses useSearchParams - wrapped in Suspense
function PurchaseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [licenseName, setLicenseName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [customerPhone, setCustomerPhone] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [expiryDays, setExpiryDays] = useState(365);
  const [maxDevices, setMaxDevices] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get URL params
  const urlProductId = searchParams.get('productId');
  const urlPlanId = searchParams.get('planId');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (urlProductId) {
      setSelectedProductId(urlProductId);
    }
  }, [urlProductId]);

  useEffect(() => {
    if (urlPlanId) {
      setSelectedPlanId(urlPlanId);
    }
  }, [urlPlanId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchPlans(selectedProductId);
    } else {
      setPlans([]);
    }
  }, [selectedProductId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/internal/backend/admin/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.products.filter((p: Product) => p.is_active));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async (productId: string) => {
    try {
      const response = await fetch(`/internal/backend/admin/products/${productId}/plans`);
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans.filter((p: Plan) => p.is_active));
      } else {
        setPlans([]);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans([]);
    }
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedPlanId('');
    setError(null);
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const selectedPlan = plans.find(p => p.id.toString() === planId);
    if (selectedPlan) {
      setExpiryDays(selectedPlan.duration_days);
      setMaxDevices(selectedPlan.max_devices);
    }
    setError(null);
  };

  const validateForm = () => {
    if (!selectedProductId) {
      setError('Please select a product');
      return false;
    }
    if (!selectedPlanId) {
      setError('Please select a plan');
      return false;
    }
    if (!customerName.trim()) {
      setError('Customer name is required');
      return false;
    }
    if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setError('Valid customer email is required');
      return false;
    }
    if (expiryDays < 1 || expiryDays > 3650) {
      setError('Expiry days must be between 1 and 3650');
      return false;
    }
    if (maxDevices < 1 || maxDevices > 100) {
      setError('Max devices must be between 1 and 100');
      return false;
    }
    return true;
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratedLicense(null);
    
    const selectedPlan = plans.find(p => p.id.toString() === selectedPlanId);
    
    try {
      const response = await fetch('/internal/backend/admin/create-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          username: licenseName.trim() || '',
          phone: customerPhone.trim() ? `${countryCode}${customerPhone.replace(/\s/g, '')}` : '',
          product_id: selectedProductId,
          expiry_days: expiryDays,
          plan: selectedPlan?.name || 'Standard',
          max_devices: maxDevices,
          notes: notes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneratedLicense(data.license_key);
        setSuccess(`License created successfully for ${customerName}`);
        // Reset form except product/plan
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setLicenseName('');
        setNotes('');
        if (!urlProductId && !urlPlanId) {
          setSelectedProductId('');
          setSelectedPlanId('');
        }
      } else {
        setError(data.error || 'Failed to create license');
      }
    } catch (err) {
      console.error('Error creating license:', err);
      setError('Failed to create license. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyLicenseToClipboard = () => {
    if (generatedLicense) {
      navigator.clipboard.writeText(generatedLicense);
      setSuccess('License key copied to clipboard!');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const getSelectedPlanDetails = () => {
    const plan = plans.find(p => p.id.toString() === selectedPlanId);
    if (!plan) return null;
    return plan;
  };

  const selectedPlan = getSelectedPlanDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => router.push('/internal/api')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Generate License
            </h1>
          </div>
          <p className="text-gray-400">
            Create new licenses for customers. Licenses are sent via email and can be activated immediately.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Generated License Display */}
        {generatedLicense && (
          <div className="mb-6 p-5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-blue-400 mb-1">License Key Generated</p>
                <code className="text-xl font-mono text-white bg-gray-900 px-3 py-2 rounded-lg">
                  {generatedLicense}
                </code>
              </div>
              <button
                onClick={copyLicenseToClipboard}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Form */}
          <div className="md:col-span-2">
            <form onSubmit={handleGenerateLicense} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 space-y-5">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.description || 'No description'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Plan *
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={!selectedProductId}
                  required
                >
                  <option value="">Select a plan...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price} - {plan.duration_days} days - {plan.max_devices} devices
                    </option>
                  ))}
                </select>
                {selectedProductId && plans.length === 0 && (
                  <p className="text-sm text-yellow-500 mt-1">
                    No active plans for this product. Add plans in product settings.
                  </p>
                )}
              </div>

              {/* Customer Info */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Email *
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="customer@example.com"
                  required
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mobile Number <span className="text-gray-500">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Used for SMS notifications. If provided, SMS will be sent automatically for enabled events.
                </p>
                <div className="flex gap-2">
                  <div ref={countryDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm hover:border-gray-500 transition-colors whitespace-nowrap min-w-[100px]"
                    >
                      <span className="text-gray-400">{COUNTRIES.find(c => c.code === countryCode)?.country}</span>
                      <span>{countryCode}</span>
                      <svg className={`w-3 h-3 text-gray-500 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                        <div className="sticky top-0 bg-gray-800 p-2 border-b border-gray-700">
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country..."
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                        {COUNTRIES.filter(c =>
                          !countrySearch ||
                          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                          c.code.includes(countrySearch) ||
                          c.country.toLowerCase().includes(countrySearch.toLowerCase())
                        ).map((c) => (
                          <button
                            key={c.country}
                            type="button"
                            onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); setCountrySearch(''); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${c.code === countryCode ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300'}`}
                          >
                            <span className="text-gray-500 w-8">{c.country}</span>
                            <span className="flex-1">{c.name}</span>
                            <span className="text-gray-500">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                    className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter mobile number"
                  />
                </div>
                {customerPhone.trim() && !COUNTRIES.find(c => c.code === countryCode)?.pattern.test(customerPhone.replace(/\s/g, '')) && (
                  <p className="text-xs text-yellow-500 mt-1">
                    Phone number may not match expected format for selected country
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Username (License Key)
                </label>
                <input
                  type="text"
                  value={licenseName}
                  onChange={(e) => setLicenseName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="keemo"
                />
                <p className="text-xs text-gray-500 mt-1">Username for license. Auto-generated if empty.</p>
              </div>

              {/* License Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Expiry (days) *
                  </label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min="1"
                    max="3650"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: 365 days (1 year)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Max Devices *
                  </label>
                  <input
                    type="number"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    min="1"
                    max="100"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of devices allowed</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Additional notes about this license..."
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating License...' : 'Generate License'}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Plan Details */}
          <div className="md:col-span-1">
            {selectedPlan ? (
              <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-5 sticky top-4">
                <h3 className="text-lg font-semibold text-white mb-3">Selected Plan</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Plan Name</p>
                    <p className="text-white font-medium">{selectedPlan.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Price</p>
                    <p className="text-2xl font-bold text-white">
                      ${selectedPlan.price}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="text-white">
                      {selectedPlan.duration_days >= 365 
                        ? `${Math.floor(selectedPlan.duration_days / 365)} year(s)` 
                        : `${selectedPlan.duration_days} days`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Max Devices</p>
                    <p className="text-white">{selectedPlan.max_devices} device(s)</p>
                  </div>
                  {selectedPlan.description && (
                    <div>
                      <p className="text-sm text-gray-400">Description</p>
                      <p className="text-white text-sm">{selectedPlan.description}</p>
                    </div>
                  )}
                  {selectedPlan.features && selectedPlan.features.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Features</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlan.features.slice(0, 3).map((feature, idx) => (
                          <span key={idx} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">
                            {feature}
                          </span>
                        ))}
                        {selectedPlan.features.length > 3 && (
                          <span className="text-xs text-gray-400">+{selectedPlan.features.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5 text-center">
                <div className="text-4xl mb-3">💰</div>
                <p className="text-gray-400 text-sm">
                  Select a product and plan to see details here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function PurchasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-700 rounded w-64 mb-8"></div>
            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <PurchaseContent />
    </Suspense>
  );
}