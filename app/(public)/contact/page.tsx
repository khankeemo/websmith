"use client";

import type { CSSProperties } from "react";
import { PublicPage } from "../_components/PublicPage";
import { SimplePublicBody } from "../_components/SimplePublicContent";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import API from "../../../core/services/apiService";
import { SOCIAL_PLATFORM_META } from "../../../lib/social-platforms";

const defaultContactInfo = {
  headquarters: "T-35, Rajarhat Main Road, Diamond Enclave,kolkata-700157",
  email: "sales@websmithdigital.com",
  sales_email: "",
  no_reply_email: "",
  hr_email: "",
  phone: "+1 815-426-9572",
  mobile_number: "",
  landline_number: "",
};

function PurchaseEnquiryForm() {
  const searchParams = useSearchParams();
  const productParam = searchParams.get("product") || "";
  const planParam = searchParams.get("plan") || "";
  const versionParam = searchParams.get("version") || "";
  const cartItemsParam = searchParams.get("cart_items") || "";
  const cartItems: { product: string; plan: string; version: string; quantity: number }[] = (() => {
    try { return JSON.parse(cartItemsParam); } catch { return []; }
  })();
  const hasCartItems = cartItems.length > 0;
  const isPurchaseEnquiry = !!(productParam || planParam || versionParam || hasCartItems);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    mobile: "",
    company: "",
    country: "",
    requirements: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const enquiryBody: any = {
        product_name: productParam || (hasCartItems ? cartItems.map(i => i.product).join(', ') : ''),
        selected_plan: planParam || '',
        product_version: versionParam || '',
        ...formData,
      };
      if (hasCartItems) {
        enquiryBody.requirements = (formData.requirements ? formData.requirements + '\n\n' : '') +
          'Cart Items:\n' + productList;
        enquiryBody.cart_items = cartItems;
      }
      const res = await fetch("/internal/backend/store/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enquiryBody),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit enquiry");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPurchaseEnquiry) return null;

  if (submitted) {
    const submittedProduct = hasCartItems ? cartItems.map(i => i.product).join(', ') : productParam;
    return (
      <section style={{ ...styles.formSection, marginBottom: "56px" }}>
        <div style={{ ...styles.successBox }}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={{ ...styles.subHeading, textAlign: "center" }}>Enquiry Submitted!</h2>
          <p style={{ ...styles.narrative, textAlign: "center" }}>
            Thank you for your interest in <strong>{submittedProduct}</strong>. Our sales team will contact you shortly at <strong>{formData.email}</strong>.
          </p>
        </div>
      </section>
    );
  }

  const productList = hasCartItems
    ? cartItems.map(i => `${i.product}${i.plan ? ` (${i.plan})` : ''} x${i.quantity}`).join('\n')
    : productParam;

  return (
    <section style={{ ...styles.purchaseSection, marginBottom: "56px" }}>
      <div style={styles.purchaseHeader}>
        <span style={styles.purchaseBadge}>Purchase Enquiry</span>
        <h2 style={styles.subHeading}>
          {hasCartItems ? `Checkout (${cartItems.length} item${cartItems.length !== 1 ? 's' : ''})` : `Buy ${productParam}`}
        </h2>
        {hasCartItems ? (
          <div style={{ ...styles.purchaseMeta, fontSize: '13px', lineHeight: '1.6' }}>
            {cartItems.map((item, i) => (
              <div key={i}>
                • {item.product}{item.plan ? ` — ${item.plan}` : ''} (x{item.quantity})
              </div>
            ))}
          </div>
        ) : (planParam || versionParam) ? (
          <p style={styles.purchaseMeta}>
            {planParam && <><strong>Plan:</strong> {planParam}</>}
            {planParam && versionParam && <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>}
            {versionParam && <><strong>Version:</strong> {versionParam}</>}
          </p>
        ) : null}
        <p style={styles.narrative}>Fill in your details and our team will reach out to complete your purchase.</p>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.purchaseForm}>
        <div style={styles.formGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full Name <span style={{ color: "#FF3B30" }}>*</span></label>
            <input name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="John Doe" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address <span style={{ color: "#FF3B30" }}>*</span></label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="john@example.com" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mobile Number <span style={{ color: "#FF3B30" }}>*</span></label>
            <input name="mobile" type="tel" value={formData.mobile} onChange={handleChange} required placeholder="+1 234 567 890" style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Company</label>
            <input name="company" value={formData.company} onChange={handleChange} placeholder="Acme Inc." style={styles.input} />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Country</label>
            <input name="country" value={formData.country} onChange={handleChange} placeholder="United States" style={styles.input} />
          </div>
          <div style={{ ...styles.fieldGroup, gridColumn: "1 / -1" }}>
            <label style={styles.label}>Requirements / Message</label>
            <textarea name="requirements" value={formData.requirements} onChange={handleChange} rows={4} placeholder="Tell us about your specific requirements..." style={{ ...styles.input, resize: "vertical", minHeight: "100px" }} />
          </div>
        </div>
        <button type="submit" disabled={submitting} style={{ ...styles.submitBtn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Submitting..." : "Submit Enquiry"}
        </button>
      </form>
    </section>
  );
}

export default function ContactPage() {
  const [contactInfo, setContactInfo] = useState(defaultContactInfo);
  const socials = SOCIAL_PLATFORM_META.map((platform) => ({
    ...platform,
    href: contactInfo[platform.key] || "",
  })).filter((social) => Boolean(social.href));

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get('/settings/public/contact_info');
        if (res.data && res.data.success && res.data.data) {
          const data = res.data.data;
          setContactInfo({
            ...defaultContactInfo,
            ...data,
            headquarters: data.headquarters || defaultContactInfo.headquarters,
            phone: data.phone || defaultContactInfo.phone,
          });
        }
      } catch (error) {
        console.error('Failed to fetch contact settings', error);
      }
    };
    fetchSettings();
  }, []);

  return (
    <PublicPage
      eyebrow="Get in Touch"
      title="Connect with WebSmith Digital"
      description="Ready to build something great? Our team is here to assist you with professional digital solutions and expert consultation."
    >
      <SimplePublicBody>
        <Suspense fallback={null}>
          <PurchaseEnquiryForm />
        </Suspense>

        {/* Intro */}
        <section style={styles.section}>
          <p style={styles.narrative}>
            At <strong>WebSmith Digital</strong>, we are always ready to connect with businesses, startups, professionals, and organizations 
            looking for reliable digital solutions. Whether you need a professional website, custom software, ERP system, automation tools, 
            digital marketing services, or expert consultation — our team is here to assist you.
          </p>
          <p style={styles.narrative}>
            We believe strong communication creates successful partnerships. Reach out to us for inquiries, project discussions, 
            service support, or collaboration opportunities.
          </p>
        </section>

        {/* Contact info grid */}
        <section style={styles.gridSection}>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>General Inquiries</span>
            <h3 style={styles.cardTitle}>Support</h3>
            <a href={`mailto:${contactInfo.email}`} style={styles.cardLink}>{contactInfo.email}</a>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Sales & Business</span>
            <h3 style={styles.cardTitle}>Consultation</h3>
            <a href={`mailto:${contactInfo.sales_email || contactInfo.email}`} style={styles.cardLink}>{contactInfo.sales_email || contactInfo.email}</a>
          </div>
          {contactInfo.no_reply_email ? (
            <div style={styles.infoCard}>
              <span style={styles.cardLabel}>Automated Notifications</span>
              <h3 style={styles.cardTitle}>No-Reply</h3>
              <a href={`mailto:${contactInfo.no_reply_email}`} style={styles.cardLink}>{contactInfo.no_reply_email}</a>
            </div>
          ) : null}
          {contactInfo.hr_email ? (
            <div style={styles.infoCard}>
              <span style={styles.cardLabel}>Careers & HR</span>
              <h3 style={styles.cardTitle}>Careers</h3>
              <a href={`mailto:${contactInfo.hr_email}`} style={styles.cardLink}>{contactInfo.hr_email}</a>
            </div>
          ) : null}
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Call Us</span>
            <h3 style={styles.cardTitle}>Phone Number</h3>
            <span style={styles.cardText}>
              <a href={`tel:${contactInfo.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {contactInfo.phone}
              </a>
            </span>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.cardLabel}>Headquarters</span>
            <h3 style={styles.cardTitle}>Address</h3>
            <span style={styles.cardText} className="whitespace-pre-wrap">{contactInfo.headquarters}</span>
          </div>
          {contactInfo.mobile_number ? (
            <div style={styles.infoCard}>
              <span style={styles.cardLabel}>Mobile</span>
              <h3 style={styles.cardTitle}>Mobile Number</h3>
              <span style={styles.cardText}>
                <a href={`tel:${contactInfo.mobile_number}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {contactInfo.mobile_number}
                </a>
              </span>
            </div>
          ) : null}
          {contactInfo.landline_number ? (
            <div style={styles.infoCard}>
              <span style={styles.cardLabel}>Landline</span>
              <h3 style={styles.cardTitle}>Fixed/Landline Number</h3>
              <span style={styles.cardText}>
                <a href={`tel:${contactInfo.landline_number}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {contactInfo.landline_number}
                </a>
              </span>
            </div>
          ) : null}
        </section>

        {/* Embedded contact form */}
        <section style={styles.formSection}>
          <div style={styles.formHeader}>
            <h2 style={styles.subHeading}>Send a Message</h2>
            <p style={styles.narrative}>
              Share a few details about your project or support request and our team will get back to you.
            </p>
          </div>
        </section>

        {/* Social channels */}
        {socials.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.subHeading}>Social Media</h2>
            <p style={styles.narrative}>Stay connected with WebSmith Digital through our social platforms:</p>
            <div style={styles.socialGrid}>
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.socialItem}
                    className="contact-social-link"
                  >
                    <span style={{ ...styles.socialIcon, backgroundColor: social.color }}>
                      <Icon size={16} color="#FFFFFF" />
                    </span>
                    <span style={styles.socialLabel}>{social.label}</span>
                    <span style={styles.socialValue}>{social.href}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Why contact us */}
        <section style={styles.section}>
          <h2 style={styles.subHeading}>Why Contact WebSmith Digital</h2>
          <div style={styles.listGrid}>
            {[
              "Professional and timely communication",
              "Expert guidance for your business needs",
              "Reliable consultation and support",
              "Customized solutions for every business size",
              "Long-term partnership focused approach"
            ].map((item) => (
              <div key={item} style={styles.listItem}>
                <div style={styles.listDot} />
                <span style={styles.listText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={styles.closure}>
          <p style={styles.narrativeLarge}>
            Let's Build Something Great Together
          </p>
          <p style={styles.narrativeCenter}>
            Whether you are starting a new business, upgrading your systems, or growing your digital presence, 
            WebSmith Digital is ready to help you move forward with confidence. 
            <strong> We look forward to hearing from you.</strong>
          </p>
        </section>
      </SimplePublicBody>

      <style>{`
        .public-page-hero-inner h1 {
          font-size: clamp(30px, 5vw, 42px) !important;
          letter-spacing: -0.03em !important;
        }
        .contact-social-link {
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .contact-social-link:hover {
          border-color: rgba(0, 122, 255, 0.35) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 122, 255, 0.1);
        }
      `}</style>
    </PublicPage>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    display: "grid",
    gap: "24px",
    marginBottom: "56px",
  },
  gridSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "56px",
  },
  subHeading: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  formSection: {
    display: "grid",
    gap: "20px",
    marginBottom: "56px",
  },
  formHeader: {
    display: "grid",
    gap: "10px",
  },
  embeddedFormShell: {
    width: "100%",
    height: "min(745px, 92vh)",
    minHeight: "620px",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  embeddedForm: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "8px",
    display: "block",
  },
  narrative: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "1200px",
  },
  infoCard: {
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  cardLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  cardTitle: {
    margin: "4px 0 8px 0",
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  cardLink: {
    fontSize: "15px",
    fontWeight: 500,
    color: "#007AFF",
    textDecoration: "none",
  },
  cardText: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  socialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
  },
  socialItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
  },
  socialIcon: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  socialLabel: {
    fontWeight: 700,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
  },
  socialValue: {
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    wordBreak: "break-all",
  },
  listGrid: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  listDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
  },
  listText: {
    fontSize: "15px",
    color: "var(--text-secondary)",
  },
  closure: {
    marginTop: "40px",
    padding: "48px 24px",
    borderRadius: "32px",
    backgroundColor: "var(--bg-secondary)",
    textAlign: "center",
    border: "1px solid var(--border-color)",
  },
  narrativeLarge: {
    margin: "0 0 16px 0",
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  narrativeCenter: {
    margin: "0 auto",
    fontSize: "16px",
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    maxWidth: "1200px",
  },
  purchaseSection: {
    padding: "32px",
    borderRadius: "24px",
    border: "2px solid #007AFF",
    backgroundColor: "var(--bg-secondary)",
  },
  purchaseHeader: {
    display: "grid",
    gap: "12px",
    marginBottom: "24px",
  },
  purchaseBadge: {
    display: "inline-block",
    width: "fit-content",
    padding: "4px 12px",
    borderRadius: "20px",
    backgroundColor: "#007AFF",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  purchaseMeta: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  purchaseForm: {
    display: "grid",
    gap: "20px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  fieldGroup: {
    display: "grid",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "fit-content",
    padding: "12px 32px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  successBox: {
    padding: "40px",
    borderRadius: "20px",
    border: "1px solid #34C759",
    backgroundColor: "rgba(52,199,89,0.06)",
    display: "grid",
    gap: "12px",
    justifyContent: "center",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#34C759",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 auto",
  },
  errorBox: {
    padding: "12px 16px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,59,48,0.1)",
    border: "1px solid rgba(255,59,48,0.3)",
    color: "#FF3B30",
    fontSize: "14px",
  },
};
