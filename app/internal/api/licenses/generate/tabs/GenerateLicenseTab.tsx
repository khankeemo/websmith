// FILE: app/internal/api/licenses/generate/tabs/GenerateLicenseTab.tsx
// PURPOSE: Tab 1 - Generate License with Trial Plan Support
// SCOPE: Generate new licenses, trial conversion, renewal
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KeyRound,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Activity,
  Layers,
  Copy,
  Sparkles,
  Mail,
  X,
} from "lucide-react";
import { isValidEmail, mobileDigitsError } from "@/lib/validation";
import { FieldIndicator } from "@/components/internal-api/validation/FieldIndicator";
import UniversalEmailDialog from "@/components/internal-api/UniversalEmailDialog";

const LICENSE_PREFILL_KEY = "license_prefill";

interface LicensePrefill {
  enquiryId?: number;
  productName?: string;
  productVersion?: string;
  plan?: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  country?: string;
  notes?: string;
}

// ============================================================
// TYPES
// ============================================================

interface CountryData {
  code: string;
  country: string;
  name: string;
  dial: string;
  flag: string;
  minDigits?: number | null;
  maxDigits?: number | null;
}

interface Product {
  id: string;
  name: string;
  version: string;
  price: number;
  is_active: boolean;
  company_name?: string;
  product_type?: string;
  description?: string;
}

interface Plan {
  id: number;
  product_id: string;
  name: string;
  description: string | null;
  max_devices: number;
  duration_days: number;
  price: number;
  is_active: boolean;
  features: string[];
  display_order: number;
}

interface CustomerCheck {
  exists: boolean;
  license_key?: string;
  customer_name?: string;
  customer_email?: string;
  plan?: string;
  product_id?: string;
  status?: string;
}

interface TrialInfo {
  exists: boolean;
  hardware_id?: string;
  status?: string;
  expiry_date?: string;
  started_at?: string;
  days_left?: number;
}

interface FormData {
  licenseType: "new" | "trial_conversion" | "renewal";
  productId: string;
  plan: string;
  customerName: string;
  customerEmail: string;
  countryCode: string;
  customerPhone: string;
  customerUsername: string;
  status: string;
  maxDevices: number;
  durationDays: number;
  notes: string;
  hardwareId: string;
}

// ============================================================
// GENERATE LICENSE TAB
// ============================================================

export function GenerateLicenseTab() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading...</span>
      </div>
    }>
      <GenerateLicenseTabInner />
    </Suspense>
  );
}

function GenerateLicenseTabInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const API_BASE = "/internal/backend";

  // ============================================================
  // STATE
  // ============================================================

  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [checkingTrial, setCheckingTrial] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    licenseType: "new",
    productId: "",
    plan: "",
    customerName: "",
    customerEmail: "",
    countryCode: "+91",
    customerPhone: "",
    customerUsername: "",
    status: "active",
    maxDevices: 1,
    durationDays: 365,
    notes: "",
    hardwareId: "",
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [generatedLicenseData, setGeneratedLicenseData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerCheckResult, setCustomerCheckResult] = useState<CustomerCheck | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; license_key?: string; status?: string }>({
    show: false,
  });
  const [licensePreview, setLicensePreview] = useState<string>("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [generatedCustomerEmail, setGeneratedCustomerEmail] = useState("");
  const [generatedProductId, setGeneratedProductId] = useState("");

  // ============================================================
  // SALES ENQUIRY PREFILL STATE
  // ============================================================
  const [prefill, setPrefill] = useState<LicensePrefill | null>(null);
  const productPrefilled = useRef(false);
  const planPrefilled = useRef(false);

  // ============================================================
  // TRIAL PLAN STATE (NEW)
  // ============================================================
  const [isTrialPlan, setIsTrialPlan] = useState<boolean>(false);
  const [trialDaysLimit, setTrialDaysLimit] = useState<number>(30);

  // ============================================================
  // FETCH PRODUCTS
  // ============================================================

  // ============================================================
  // COUNTRY DATA (API-based from the internal countries endpoint)
  // ============================================================

  const [countries, setCountries] = useState<CountryData[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetch(`${API_BASE}/country-codes`);
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        const list: CountryData[] = (data.data || [])
          .map((c: any) => ({
            code: c.dial,
            country: c.code,
            name: c.name,
            dial: c.dial,
            flag: c.flag || "",
            minDigits: typeof c.min_digits === "number" ? c.min_digits : c.minDigits ?? null,
            maxDigits: typeof c.max_digits === "number" ? c.max_digits : c.maxDigits ?? null,
          }))
          .sort((a: CountryData, b: CountryData) => a.name.localeCompare(b.name));
        if (list.length > 0) setCountries(list);
      } catch {
        // countries list unavailable - the form stays disabled until loaded
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [countries, countrySearch]);

  const selectedCountryName = useMemo(
    () => countries.find((c) => c.code === formData.countryCode)?.name || formData.countryCode,
    [countries, formData.countryCode]
  );

  const handleSelectCountry = useCallback((c: CountryData) => {
    setFormData((prev: FormData) => ({ ...prev, countryCode: c.code }));
    setCountryDropdownOpen(false);
    setCountrySearch("");
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/products`);
        const data = await response.json();
        if (data.success) {
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // ============================================================
  // SALES ENQUIRY PREFILL - READ PAYLOAD
  // ============================================================

  useEffect(() => {
    if (searchParams.get("prefill") !== "1") return;
    try {
      const raw = sessionStorage.getItem(LICENSE_PREFILL_KEY);
      if (raw) {
        setPrefill(JSON.parse(raw));
        sessionStorage.removeItem(LICENSE_PREFILL_KEY);
      }
    } catch {
      // malformed prefill payload - ignore
    }
  }, [searchParams]);

  const dismissPrefill = useCallback(() => {
    setPrefill(null);
    productPrefilled.current = false;
    planPrefilled.current = false;
    try {
      sessionStorage.removeItem(LICENSE_PREFILL_KEY);
    } catch {}
  }, []);

  // Apply customer fields from the enquiry payload
  useEffect(() => {
    if (!prefill) return;
    setFormData(prev => ({
      ...prev,
      customerName: prefill.customerName || prev.customerName,
      customerEmail: prefill.customerEmail || prev.customerEmail,
      customerPhone: prefill.phone ? prefill.phone.replace(/[^0-9]/g, '') : prev.customerPhone,
      notes: prefill.notes || prev.notes,
    }));
  }, [prefill]);

  // Match the enquiry product once products have loaded
  useEffect(() => {
    if (!prefill?.productName || !products.length || productPrefilled.current) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(prefill.productName);
    const candidates = products.filter(p => {
      const n = norm(p.name);
      return n === target || n.includes(target) || target.includes(n);
    });
    let match = candidates[0];
    if (prefill.productVersion && candidates.length > 0) {
      const versionMatch = candidates.find(p => p.version === prefill.productVersion)
        || candidates.find(p => norm(p.version) === norm(prefill.productVersion!));
      if (versionMatch) match = versionMatch;
    }
    if (match) {
      productPrefilled.current = true;
      setFormData(prev => ({ ...prev, productId: match.id }));
    }
  }, [prefill, products]);

  // Match the enquiry plan once plans have loaded
  useEffect(() => {
    if (!prefill?.plan || !plans.length || planPrefilled.current) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(prefill.plan);
    const match = plans.find(p => {
      const n = norm(p.name);
      return n === target || n.includes(target) || target.includes(n);
    });
    if (match) {
      planPrefilled.current = true;
      selectPlan(match);
    } else if (plans.length > 0) {
      planPrefilled.current = true;
    }
  }, [prefill, plans]);

  // ============================================================
  // FETCH PLANS ON PRODUCT CHANGE (UPDATED to handle trial plans)
  // ============================================================

  useEffect(() => {
    if (!formData.productId) {
      setPlans([]);
      setSelectedPlan(null);
      setSelectedProduct(null);
      setIsTrialPlan(false);
      setTrialDaysLimit(30);
      return;
    }

    const fetchPlans = async () => {
      setLoadingPlans(true);
      setPlans([]);
      setSelectedPlan(null);
      setIsTrialPlan(false);
      setTrialDaysLimit(30);

      try {
        const response = await fetch(`${API_BASE}/admin/products/${formData.productId}/plans`);
        const data = await response.json();
        if (data.success) {
          // Plans now include is_trial_plan and trial_days_limit
          setPlans(data.plans || []);
          if (data.plans && data.plans.length > 0) {
            const firstPlan = data.plans[0];
            selectPlan(firstPlan);
          }
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();

    const product = products.find(p => p.id === formData.productId);
    setSelectedProduct(product || null);
    setCustomerCheckResult(null);
    setDuplicateWarning({ show: false });
    setTrialInfo(null);

  }, [formData.productId, products]);

  // ============================================================
  // SELECT PLAN (UPDATED to handle trial plans)
  // ============================================================

  const selectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    
    // Check if plan is a trial plan
    const isTrial = (plan as any).is_trial_plan || false;
    const trialDays = (plan as any).trial_days_limit || 30;
    
    setIsTrialPlan(isTrial);
    setTrialDaysLimit(trialDays);
    
    setFormData(prev => ({
      ...prev,
      plan: plan.name,
      maxDevices: plan.max_devices,
      durationDays: isTrial ? trialDays : plan.duration_days,
    }));
  };

  // ============================================================
  // GENERATE LICENSE PREVIEW
  // ============================================================

  useEffect(() => {
    if (selectedProduct && formData.customerUsername) {
      const preview = `prod_${selectedProduct.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${formData.customerUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(100 + Math.random() * 900)}`;
      setLicensePreview(preview);
    } else {
      setLicensePreview("");
    }
  }, [selectedProduct, formData.customerUsername]);

  // ============================================================
  // CHECK EXISTING CUSTOMER
  // ============================================================

  const checkCustomer = async () => {
    if (!formData.customerEmail) return;

    setCheckingCustomer(true);
    setCustomerCheckResult(null);
    setDuplicateWarning({ show: false });

    try {
      const response = await fetch(`${API_BASE}/admin/search/email?email=${encodeURIComponent(formData.customerEmail)}`);
      const data = await response.json();

      if (data.success) {
        setCustomerCheckResult({
          exists: true,
          license_key: data.license_key,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          plan: data.plan,
          product_id: data.product_id,
          status: data.status,
        });

        if (data.product_id === formData.productId && data.plan === formData.plan) {
          setDuplicateWarning({
            show: true,
            license_key: data.license_key,
            status: data.status,
          });
        }
      } else {
        setCustomerCheckResult({ exists: false });
      }
    } catch (err) {
      console.error("Failed to check customer:", err);
    } finally {
      setCheckingCustomer(false);
    }
  };

  // ============================================================
  // CHECK TRIAL
  // ============================================================

  const checkTrial = async () => {
    if (!formData.hardwareId) return;

    setCheckingTrial(true);
    setTrialInfo(null);

    try {
      const response = await fetch(`${API_BASE}/trials/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hardware_id: formData.hardwareId }),
      });

      const data = await response.json();

      if (data.has_trial) {
        setTrialInfo({
          exists: true,
          hardware_id: formData.hardwareId,
          status: data.status,
          expiry_date: data.expiry_date,
          started_at: data.started_at,
          days_left: data.days_left,
        });
      } else {
        setTrialInfo({ exists: false });
      }
    } catch (err) {
      console.error("Failed to check trial:", err);
    } finally {
      setCheckingTrial(false);
    }
  };

  // ============================================================
  // HANDLE GENERATE (UPDATED to handle trial plan validation)
  // ============================================================

  const handleGenerate = async () => {
    if (!formData.productId) {
      setError("Please select a product");
      return;
    }
    if (!formData.plan) {
      setError("Please select a plan");
      return;
    }
    if (!formData.customerName || formData.customerName.trim() === "") {
      setError("Customer name is required");
      return;
    }
    if (!isValidEmail(formData.customerEmail)) {
      setError("Valid customer email is required");
      return;
    }
    if (formData.customerPhone.trim()) {
      const selectedCountry = countries.find((c) => c.code === formData.countryCode);
      const phoneError = selectedCountry
        ? mobileDigitsError(selectedCountry, formData.customerPhone)
        : "";
      if (phoneError) {
        setError(phoneError);
        return;
      }
    }
    if (formData.licenseType === "trial_conversion" && !formData.hardwareId) {
      setError("Hardware ID is required for trial conversion");
      return;
    }

    // Validate trial plan if selected
    if (isTrialPlan) {
      if (trialDaysLimit < 1 || trialDaysLimit > 30) {
        setError("Trial days limit must be between 1 and 30");
        return;
      }
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    const selectedCountry = countries.find(c => c.code === formData.countryCode);
    const fullPhone = formData.customerPhone.trim()
      ? `${formData.countryCode}${formData.customerPhone.replace(/\s/g, '')}`
      : '';

    try {
      let endpoint = `${API_BASE}/admin/create-license`;
      let payload: any = {
        name: formData.customerName.trim(),
        email: formData.customerEmail.trim(),
        username: formData.customerUsername.trim() || formData.customerName.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
        product_id: formData.productId,
        plan: formData.plan,
        expiry_days: isTrialPlan ? trialDaysLimit : formData.durationDays,
        max_devices: formData.maxDevices,
        notes: isTrialPlan 
          ? `[TRIAL] ${formData.notes.trim() || 'Trial license'} - ${trialDaysLimit} days`
          : formData.notes.trim(),
        status: formData.status,
        is_trial: isTrialPlan,
        trial_days_limit: isTrialPlan ? trialDaysLimit : undefined,
        phone: fullPhone,
        country: selectedCountry?.country || '',
      };

      if (formData.licenseType === "trial_conversion") {
        endpoint = `${API_BASE}/trials/convert`;
        payload = {
          hardware_id: formData.hardwareId,
          customer_name: formData.customerName.trim(),
          customer_email: formData.customerEmail.trim(),
          selected_plan: formData.plan,
          product_id: formData.productId,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedLicense(data.license_key);
        setGeneratedLicenseData(data);
        setGeneratedCustomerEmail(formData.customerEmail.trim());
        setGeneratedProductId(formData.productId);
        setSuccess(data.message || "License created successfully");

        setFormData(prev => ({
          ...prev,
          customerName: "",
          customerEmail: "",
          countryCode: "+91",
          customerPhone: "",
          customerUsername: "",
          notes: "",
          hardwareId: "",
        }));
        setCustomerCheckResult(null);
        setDuplicateWarning({ show: false });
        setTrialInfo(null);
        setLicensePreview("");
        setIsTrialPlan(false);
        setTrialDaysLimit(30);
      } else {
        setError(data.error || "Failed to generate license");
        if (data.duplicate) {
          setDuplicateWarning({
            show: true,
            license_key: data.existing_license?.license_key,
            status: data.existing_license?.status,
          });
        }
      }
    } catch (err) {
      console.error("Generate license error:", err);
      setError("Failed to generate license. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ============================================================
  // HANDLE COPY
  // ============================================================

  const handleCopy = () => {
    if (generatedLicense) {
      navigator.clipboard.writeText(generatedLicense);
      setSuccess("License key copied to clipboard!");
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-[var(--api-blue-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading products...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            <p className="text-[var(--api-green-400)] text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Generated License */}
      {generatedLicense && (
        <div className="rounded-2xl border border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)] p-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">License Generated Successfully</h3>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
            <code className="flex-1 font-mono text-sm text-[var(--text-primary)]">{generatedLicense}</code>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            >
              <Copy size={16} className="text-[var(--text-muted)] hover:text-[var(--api-blue-400)]" />
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => setEmailDialogOpen(true)}
              className="flex items-center gap-1.5 text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors"
            >
              <Mail size={14} /> Send Email
            </button>
            <button
              onClick={() => router.push(`/internal/api/licenses/${generatedLicense}`)}
              className="text-sm text-[var(--api-blue-400)] hover:text-[var(--api-blue-300)] transition-colors"
            >
              View License Details →
            </button>
            <button
              onClick={() => {
                setGeneratedLicense(null);
                setGeneratedLicenseData(null);
                setSuccess(null);
              }}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-[var(--api-red-500-20)] bg-[var(--api-red-500-5)] p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--api-red-400)]" />
            <p className="text-[var(--api-red-400)] text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sales Enquiry Prefill Banner */}
      {prefill && (
        <div className="rounded-2xl border border-[var(--api-blue-500-20)] bg-[var(--api-blue-500-5)] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-[var(--api-blue-400)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--api-blue-400)]">
                Form prefilled from Sales Enquiry {prefill.enquiryId ? `#${prefill.enquiryId}` : ""}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {[prefill.productName, prefill.productVersion && `v${prefill.productVersion}`, prefill.plan].filter(Boolean).join(" · ")}
                {" — review the details below before generating."}
              </p>
            </div>
            <button
              onClick={dismissPrefill}
              title="Clear prefill and start fresh"
              className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]/40 transition-colors shrink-0"
            >
              <X size={14} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============================================================
             LEFT COLUMN - FORM
        ============================================================ */}

        <div className="space-y-4">
          {/* SECTION 1: LICENSE TYPE */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              License Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormData({ ...formData, licenseType: "new", hardwareId: "" })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.licenseType === "new"
                    ? "bg-blue-500/20 text-[var(--api-blue-400)] border border-blue-500/30"
                    : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-color)]"
                }`}
              >
                New License
              </button>
              <button
                onClick={() => setFormData({ ...formData, licenseType: "trial_conversion" })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.licenseType === "trial_conversion"
                    ? "bg-blue-500/20 text-[var(--api-blue-400)] border border-blue-500/30"
                    : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-color)]"
                }`}
              >
                Trial Conversion
              </button>
              <button
                onClick={() => setFormData({ ...formData, licenseType: "renewal" })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.licenseType === "renewal"
                    ? "bg-blue-500/20 text-[var(--api-blue-400)] border border-blue-500/30"
                    : "bg-[var(--bg-tertiary)]/20 text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-color)]"
                }`}
              >
                Renewal
              </button>
            </div>
          </div>

          {/* SECTION 2: PRODUCT SELECTION */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Product *
            </label>
            <select
              value={formData.productId}
              onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all"
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version}) - ${p.price}
                </option>
              ))}
            </select>

            {selectedProduct && (
              <div className="mt-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[var(--text-muted)]">Name</span>
                    <p className="font-medium text-[var(--text-primary)]">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Version</span>
                    <p className="font-medium text-[var(--text-primary)]">{selectedProduct.version}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Price</span>
                    <p className="font-medium text-[var(--text-primary)]">${selectedProduct.price}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedProduct.is_active
                        ? "bg-[var(--api-green-500-10)] text-[var(--api-green-400)]"
                        : "bg-[var(--api-red-500-10)] text-[var(--api-red-400)]"
                    }`}>
                      {selectedProduct.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: PLAN SELECTION (UPDATED with Trial Indicator) */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Plan *
            </label>
            <select
              value={formData.plan}
              onChange={(e) => {
                const plan = plans.find(p => p.name === e.target.value);
                if (plan) selectPlan(plan);
              }}
              disabled={!formData.productId || loadingPlans}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
            >
              <option value="">
                {loadingPlans ? "Loading plans..." : "Select a plan"}
              </option>
              {plans.map((plan) => {
                const isTrial = (plan as any).is_trial_plan || false;
                const trialDays = (plan as any).trial_days_limit || 0;
                return (
                  <option key={plan.id} value={plan.name}>
                    {plan.name} - ${plan.price} ({plan.duration_days} days)
                    {isTrial && ` 🔬 Trial (${trialDays} days)`}
                  </option>
                );
              })}
            </select>
            {plans.length === 0 && formData.productId && !loadingPlans && (
              <p className="text-xs text-[var(--api-amber-400)] mt-1">
                No plans available for this product. Create a plan first.
              </p>
            )}
          </div>

          {/* Plan Details Panel (UPDATED with Trial Info) */}
          {selectedPlan && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
              <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <Layers size={14} className="text-[var(--api-blue-400)]" />
                Plan Details
                {isTrialPlan && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 flex items-center gap-1">
                    <Sparkles size={12} />
                    Trial Plan
                  </span>
                )}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">Name</span>
                  <p className="font-medium text-[var(--text-primary)]">{selectedPlan.name}</p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Duration</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {isTrialPlan ? `${trialDaysLimit} days (Trial)` : `${selectedPlan.duration_days} days`}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Price</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {isTrialPlan ? "FREE" : `$${selectedPlan.price}`}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Max Devices</span>
                  <p className="font-medium text-[var(--text-primary)]">{selectedPlan.max_devices}</p>
                </div>
                {isTrialPlan && (
                  <div className="col-span-2">
                    <span className="text-[var(--text-muted)]">Trial Days</span>
                    <p className="font-medium text-[var(--text-primary)] text-green-400">
                      {trialDaysLimit} days (1-30 days limit)
                    </p>
                  </div>
                )}
                {selectedPlan.description && (
                  <div className="col-span-2">
                    <span className="text-[var(--text-muted)]">Description</span>
                    <p className="text-[var(--text-secondary)]">{selectedPlan.description}</p>
                  </div>
                )}
                {selectedPlan.features && selectedPlan.features.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-[var(--text-muted)]">Features</span>
                    <ul className="list-disc list-inside text-[var(--text-secondary)]">
                      {selectedPlan.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-sm">{f}</li>
                      ))}
                      {selectedPlan.features.length > 3 && (
                        <li className="text-sm text-[var(--text-muted)]">+{selectedPlan.features.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-[var(--text-muted)]">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                    selectedPlan.is_active
                      ? "bg-[var(--api-green-500-10)] text-[var(--api-green-400)]"
                      : "bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)]"
                  }`}>
                    {selectedPlan.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: CUSTOMER INFORMATION */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Customer Information
            </label>
            <div className="space-y-3">
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => {
                  setFormData({ ...formData, customerName: e.target.value });
                  setCustomerCheckResult(null);
                  setDuplicateWarning({ show: false });
                }}
                onBlur={checkCustomer}
                placeholder="Customer Name *"
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
              />
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => {
                    setFormData({ ...formData, customerEmail: e.target.value });
                    setCustomerCheckResult(null);
                    setDuplicateWarning({ show: false });
                  }}
                  onBlur={checkCustomer}
                  placeholder="Customer Email *"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <FieldIndicator
                  state={
                    formData.customerEmail.trim() === ""
                      ? "empty"
                      : isValidEmail(formData.customerEmail)
                        ? "valid"
                        : "invalid"
                  }
                />
              </div>
              <div className="flex gap-2">
                <div className="relative w-52" ref={countryRef}>
                  <div
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 transition-all text-sm cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">{selectedCountryName} ({formData.countryCode})</span>
                    <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {countryDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                      <div className="p-2">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search countries..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredCountries.map((c) => (
                          <button
                            key={`${c.code}-${c.country}`}
                            onClick={() => handleSelectCountry(c)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-tertiary)]/30 transition-colors ${
                              formData.countryCode === c.code
                                ? "bg-blue-500/10 text-[var(--api-blue-400)]"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {c.name} ({c.code})
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">
                            No countries found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="Mobile Number (optional)"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <FieldIndicator
                    state={
                      formData.customerPhone.trim() === ""
                        ? "empty"
                        : mobileDigitsError(
                            countries.find((c) => c.code === formData.countryCode),
                            formData.customerPhone
                          ) === ""
                          ? "valid"
                          : "invalid"
                    }
                  />
                </div>
              </div>
              <input
                type="text"
                value={formData.customerUsername}
                onChange={(e) => setFormData({ ...formData, customerUsername: e.target.value })}
                placeholder="Customer Username (for license key)"
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
              />
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              />
            </div>
          </div>

          {/* Customer Check Result */}
          {customerCheckResult && customerCheckResult.exists && (
            <div className="rounded-xl border border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)] p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[var(--api-amber-400)] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--api-amber-400)]">Existing Customer Found</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {customerCheckResult.customer_name} ({customerCheckResult.customer_email})
                  </p>
                  {duplicateWarning.show && (
                    <p className="text-xs text-[var(--api-red-400)] mt-1">
                      ⚠️ This customer already has a license for this product and plan.
                      License Key: <span className="font-mono">{duplicateWarning.license_key}</span>
                      Status: {duplicateWarning.status}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: LICENSE SETTINGS (UPDATED with Trial auto-set) */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
            <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <KeyRound size={14} className="text-[var(--api-blue-400)]" />
              License Settings
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Max Devices</label>
                <input
                  type="number"
                  value={formData.maxDevices}
                  onChange={(e) => setFormData({ ...formData, maxDevices: parseInt(e.target.value) || 1 })}
                  min={1}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  Duration Days
                  {isTrialPlan && (
                    <span className="ml-2 text-green-400 text-xs">
                      (Trial: {trialDaysLimit} days max)
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={isTrialPlan ? trialDaysLimit : formData.durationDays}
                  onChange={(e) => {
                    if (isTrialPlan) {
                      const val = parseInt(e.target.value) || 30;
                      setTrialDaysLimit(Math.min(Math.max(val, 1), 30));
                      setFormData(prev => ({ ...prev, durationDays: val }));
                    } else {
                      setFormData(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 365 }));
                    }
                  }}
                  min={isTrialPlan ? 1 : 1}
                  max={isTrialPlan ? 30 : 7300}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 text-sm"
                />
                {isTrialPlan && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    ⚠️ Trial plans are limited to 1-30 days and are FREE.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 6: TRIAL CONVERSION */}
          {formData.licenseType === "trial_conversion" && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4">
              <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <Activity size={14} className="text-[var(--api-purple-400)]" />
                Trial Conversion
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.hardwareId}
                  onChange={(e) => setFormData({ ...formData, hardwareId: e.target.value })}
                  placeholder="Hardware ID *"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button
                  onClick={checkTrial}
                  disabled={!formData.hardwareId || checkingTrial}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-all disabled:opacity-50"
                >
                  {checkingTrial ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Checking Trial...
                    </span>
                  ) : (
                    "Check Trial Status"
                  )}
                </button>

                {trialInfo && trialInfo.exists && (
                  <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm">
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-[var(--text-muted)]">Status</span>
                      <span className={`font-medium ${
                        trialInfo.status === "active" ? "text-[var(--api-green-400)]" : "text-[var(--api-amber-400)]"
                      }`}>
                        {trialInfo.status}
                      </span>
                      <span className="text-[var(--text-muted)]">Days Left</span>
                      <span className="font-medium text-[var(--text-primary)]">{trialInfo.days_left} days</span>
                      <span className="text-[var(--text-muted)]">Started</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {trialInfo.started_at ? new Date(trialInfo.started_at).toLocaleDateString() : "N/A"}
                      </span>
                      <span className="text-[var(--text-muted)]">Expires</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {trialInfo.expiry_date ? new Date(trialInfo.expiry_date).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    {trialInfo.status === "converted" && (
                      <p className="text-xs text-[var(--api-red-400)] mt-2">
                        ⚠️ This trial has already been converted to a license.
                      </p>
                    )}
                  </div>
                )}

                {trialInfo && !trialInfo.exists && (
                  <p className="text-xs text-[var(--api-amber-400)]">No trial found for this hardware ID.</p>
                )}
              </div>
            </div>
          )}

          {/* LICENSE PREVIEW */}
          {licensePreview && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={14} className="text-[var(--api-blue-400)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">License Preview</span>
                {isTrialPlan && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                    TRIAL
                  </span>
                )}
              </div>
              <code className="font-mono text-sm text-[var(--api-blue-400)]">{licensePreview}</code>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Format: product_username_XXX
              </p>
            </div>
          )}

          {/* GENERATE BUTTON */}
          <button
            onClick={handleGenerate}
            disabled={generating || !formData.productId || !formData.plan || !formData.customerName || !formData.customerEmail}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {formData.licenseType === "trial_conversion" ? "Converting..." : "Generating..."}
              </>
            ) : (
              <>
                <Plus size={16} />
                {formData.licenseType === "trial_conversion" ? "Convert Trial to License" : 
                  isTrialPlan ? "Generate Trial License" : "Generate License"}
              </>
            )}
          </button>
        </div>

        {/* ============================================================
             RIGHT COLUMN - SUMMARY (UPDATED with Trial Info)
        ============================================================ */}

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-5 w-5 text-[var(--api-blue-400)]" />
              <h3 className="font-semibold text-[var(--text-primary)]">License Summary</h3>
              {isTrialPlan && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 flex items-center gap-1">
                  <Sparkles size={12} />
                  TRIAL
                </span>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">License Type</span>
                <span className="text-[var(--text-primary)] font-medium capitalize">
                  {formData.licenseType.replace("_", " ")}
                  {isTrialPlan && " (Trial)"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Product</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {selectedProduct?.name || "Not selected"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Plan</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {selectedPlan?.name || "Not selected"}
                  {isTrialPlan && " 🔬 Trial"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Customer</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {formData.customerName || "Not set"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Email</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {formData.customerEmail || "Not set"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Username</span>
                <span className="text-[var(--text-primary)] font-medium font-mono">
                  {formData.customerUsername || "Not set"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Duration</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {isTrialPlan ? `${trialDaysLimit} days (Trial)` : `${formData.durationDays} days`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Max Devices</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {formData.maxDevices}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  formData.status === "active"
                    ? "bg-[var(--api-green-500-10)] text-[var(--api-green-400)]"
                    : "bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)]"
                }`}>
                  {formData.status}
                </span>
              </div>
              {isTrialPlan && (
                <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Trial Days</span>
                  <span className="text-[var(--text-primary)] font-medium text-green-400">
                    {trialDaysLimit} days (1-30 max)
                  </span>
                </div>
              )}
              {formData.licenseType === "trial_conversion" && trialInfo && trialInfo.exists && (
                <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Trial Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    trialInfo.status === "active"
                      ? "bg-[var(--api-green-500-10)] text-[var(--api-green-400)]"
                      : "bg-[var(--api-amber-500-10)] text-[var(--api-amber-400)]"
                  }`}>
                    {trialInfo.status}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-[var(--text-secondary)]">License Preview</span>
                <code className="text-xs font-mono text-[var(--api-blue-400)]">
                  {licensePreview || "—"}
                </code>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  selectedProduct?.is_active ? "bg-green-400 animate-pulse" : "bg-amber-400"
                }`} />
                <span>{selectedProduct?.is_active ? "Product Active" : "Product Inactive"}</span>
              </div>
              <span>{Object.values(formData).filter(v => v).length} fields filled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Email Dialog — license email + SDK attachment */}
      <UniversalEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        defaultEmail={generatedCustomerEmail}
        defaultLicenseKey={generatedLicense || undefined}
        defaultProductId={generatedProductId}
        defaultProductName={selectedProduct?.name || undefined}
        defaultAction="send"
      />
    </div>
  );
}