// C:\websmith\app\page.tsx
// Landing Page - Websmith
// Features: Hero section, Features grid, Stats counters, Satisfied clients, Developers section, Testimonials, Footer
// Updated: Added header navigation menu with smooth scroll

"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  Star, 
  Code, 
  Rocket, 
  Shield, 
  Zap, 
  Users, 
  BarChart3,
  Briefcase,
  ExternalLink,
  Mail,
  Building2,
} from "lucide-react";
import LeadCapturePopup from "../components/lead-funnel/LeadCapturePopup";
import PublicSiteNav from "../components/layout/PublicSiteNav";
import { getPublishedProjects } from "./projects/services/projectService";
import { getPublishedClients } from "./clients/services/clientService";
import { getPublishedDevelopers } from "../core/services/userService";
import { createPublicTicket } from "../core/services/ticketService";

type AutoCarouselProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  itemMinWidth?: number;
  gap?: number;
  speedDesktop?: number;
  speedMobile?: number;
};

function AutoCarousel<T>({
  items,
  renderItem,
  ariaLabel,
  itemMinWidth = 280,
  gap = 20,
  speedDesktop = 0.032,
  speedMobile = 0.05,
}: AutoCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length < 2) return;

    let rafId = 0;
    let lastTs = 0;
    const speed = isMobile ? speedMobile : speedDesktop;

    const loop = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const delta = ts - lastTs;
      lastTs = ts;

      if (!isPaused) {
        track.scrollLeft += delta * speed;
        const half = track.scrollWidth / 2;
        if (track.scrollLeft >= half) {
          track.scrollLeft -= half;
        }
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPaused, isMobile, items.length, speedDesktop, speedMobile]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    isDraggingRef.current = true;
    dragStartXRef.current = event.clientX;
    dragStartScrollRef.current = track.scrollLeft;
    setIsPaused(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || !isDraggingRef.current) return;
    const delta = event.clientX - dragStartXRef.current;
    track.scrollLeft = dragStartScrollRef.current - delta;
  };

  const onPointerUpOrLeave = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPaused(false);
  };

  const loopItems = [...items, ...items];

  return (
    <div style={styles.carouselRoot}>
      <div
        ref={trackRef}
        style={styles.carouselViewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrLeave}
        onPointerLeave={onPointerUpOrLeave}
        onPointerCancel={onPointerUpOrLeave}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={onPointerUpOrLeave}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        aria-label={ariaLabel}
      >
        <div style={{ ...styles.carouselTrack, gap: `${gap}px` }}>
          {loopItems.map((item, index) => (
            <div key={index} style={{ ...styles.carouselSlide, minWidth: `${itemMinWidth}px` }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  
  // Refs for smooth scroll
  const featuresRef = useRef<HTMLElement>(null);
  const developersRef = useRef<HTMLElement>(null);
  const clientsRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const contactFormRef = useRef<HTMLElement>(null);
  
  // Contact form state
  const [contactState, setContactState] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "error">(null);
  
  // Stats counter animation
  const [stats, setStats] = useState({
    projects: 0,
    clients: 0,
    developers: 0,
    countries: 0
  });
  const [publishedProjects, setPublishedProjects] = useState<any[]>([]);
  const [publishedClients, setPublishedClients] = useState<any[]>([]);
  const [publishedDevelopers, setPublishedDevelopers] = useState<any[]>([]);

  useEffect(() => {
    // Animate stats
    const targets = { projects: 500, clients: 280, developers: 45, countries: 12 };
    const duration = 2000;
    const stepTime = 20;
    const steps = duration / stepTime;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setStats({
        projects: Math.min(targets.projects, Math.floor((currentStep / steps) * targets.projects)),
        clients: Math.min(targets.clients, Math.floor((currentStep / steps) * targets.clients)),
        developers: Math.min(targets.developers, Math.floor((currentStep / steps) * targets.developers)),
        countries: Math.min(targets.countries, Math.floor((currentStep / steps) * targets.countries)),
      });
      if (currentStep >= steps) clearInterval(interval);
    }, stepTime);
  }, []);

  useEffect(() => {
    Promise.allSettled([getPublishedProjects(), getPublishedClients(), getPublishedDevelopers()]).then((results) => {
      if (results[0].status === "fulfilled") setPublishedProjects(results[0].value);
      if (results[1].status === "fulfilled") setPublishedClients(results[1].value);
      if (results[2].status === "fulfilled") setPublishedDevelopers(results[2].value);
    });
  }, []);

  // Smooth scroll function
  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleGetStarted = () => {
    router.push('/services');
  };

  // Features data
  const features = [
    { icon: Code, title: "Expert Developers", description: "Top-tier developers with proven experience in modern tech stacks", href: "#developers" },
    { icon: Rocket, title: "Fast Delivery", description: "Agile methodology ensuring quick turnaround without quality compromise", href: "#projects" },
    { icon: Shield, title: "Secure Code", description: "Enterprise-grade security practices and regular code audits", href: "#developers" },
    { icon: Zap, title: "24/7 Support", description: "Round-the-clock technical support and maintenance", href: "#contact" },
    { icon: Users, title: "Dedicated Teams", description: "Build your dedicated development team tailored to your needs", href: "#clients" },
    { icon: BarChart3, title: "Scalable Solutions", description: "Grow your business with scalable, future-proof solutions", href: "#testimonials" }
  ];

  // Temporary dummy data for carousel QA; remove once testing sign-off is done.
  const dummyClients = [
    { id: "dc-1", name: "Avery Stone", company: "Nova Retail", description: "Scaled checkout performance for peak season launches." },
    { id: "dc-2", name: "Mina Das", company: "CareBridge", description: "Delivered secure patient workflow dashboards and reports." },
    { id: "dc-3", name: "James Cole", company: "FlowFleet", description: "Rolled out fleet monitoring with uptime-first architecture." },
    { id: "dc-4", name: "Rhea Patel", company: "BrightNest", description: "Improved conversion with design-led funnel rebuild." },
    { id: "dc-5", name: "Jonah Lee", company: "Cortex Labs", description: "Integrated analytics and deployment automation in one sprint." },
  ];

  const dummyDevelopers = [
    { id: "dd-1", name: "Aisha Rahman", role: "Frontend Architect", skills: ["React", "Next.js", "Design Systems"], experience: 7, avatar: "", bio: "Builds resilient, high-conversion frontends for growth teams." },
    { id: "dd-2", name: "Marcus Silva", role: "Backend Engineer", skills: ["Node.js", "MongoDB", "APIs"], experience: 6, avatar: "", bio: "Focuses on scalable APIs and operational reliability." },
    { id: "dd-3", name: "Nadia Kim", role: "Mobile Specialist", skills: ["React Native", "iOS", "Android"], experience: 5, avatar: "", bio: "Ships polished mobile experiences with strong performance." },
    { id: "dd-4", name: "Owen Hart", role: "DevOps Engineer", skills: ["CI/CD", "Docker", "Cloud"], experience: 8, avatar: "", bio: "Automates pipelines and keeps releases predictable." },
  ];

  const dummyProjects = [
    { _id: "dp-1", name: "Commerce Pulse", description: "Realtime commerce insights dashboard with custom KPI streams.", client: "Nova Retail", publicUrl: "https://example.com/commerce-pulse", previewImage: "" },
    { _id: "dp-2", name: "Clinic Bridge", description: "Patient onboarding and appointment lifecycle management portal.", client: "CareBridge", publicUrl: "https://example.com/clinic-bridge", previewImage: "" },
    { _id: "dp-3", name: "Fleet Vision", description: "Route tracking and incident alerting platform for logistics teams.", client: "FlowFleet", publicUrl: "https://example.com/fleet-vision", previewImage: "" },
    { _id: "dp-4", name: "Nest Growth", description: "A/B experimentation toolkit connected with sales funnels.", client: "BrightNest", publicUrl: "https://example.com/nest-growth", previewImage: "" },
  ];

  const dummyTestimonials = [
    { id: "dt-1", name: "S. Jordan", company: "Nova Retail", quote: "Delivery was smooth, proactive, and always transparent." },
    { id: "dt-2", name: "K. Morgan", company: "CareBridge", quote: "The team turned complex product goals into clear milestones." },
    { id: "dt-3", name: "R. Blake", company: "FlowFleet", quote: "Excellent collaboration and dependable release quality." },
    { id: "dt-4", name: "T. Diaz", company: "BrightNest", quote: "We saw measurable gains within the first release cycle." },
  ];

  const effectiveProjects = (publishedProjects.length > 0 ? publishedProjects : dummyProjects).slice(0, 8);
  const publicClients = (publishedClients.length > 0 ? publishedClients : dummyClients).map((client: any, index: number) => ({
    id: client._id || client.id || `client-${index}`,
    name: client.name,
    company: client.company || "Independent client",
    description:
      client.address ||
      client.customId ||
      client.description ||
      "Partnered with Websmith on product delivery, design quality, and long-term support.",
  }));

  const effectiveDevelopers =
    publishedDevelopers.length >= 3
      ? publishedDevelopers
      : [...publishedDevelopers, ...dummyDevelopers].slice(0, 6);

  const publicDevelopers = effectiveDevelopers.map((developer: any, index: number) => ({
    id: developer._id || developer.id || `dev-${index}`,
    name: developer.name,
    role: developer.headline || developer.role || "Software Developer",
    skills: developer.skills?.length ? developer.skills : ["Engineering", "Delivery"],
    experience: developer.experienceYears || developer.experience || 0,
    avatar: developer.avatar || "",
    bio: developer.bio || "Experienced engineer focused on shipping resilient digital products.",
  }));

  const reviewCards = (publicClients.length > 0 || publicDevelopers.length > 0)
    ? [
        ...publicClients.slice(0, 5).map((client, index) => ({
          id: `client-review-${index}`,
          name: client.name,
          company: client.company,
          quote: `${client.company} trusted Websmith for delivery clarity, product quality, and dependable communication.`,
        })),
        ...publicDevelopers.slice(0, 4).map((developer, index) => ({
          id: `dev-review-${index}`,
          name: developer.name,
          company: developer.role,
          quote: `${developer.name} brings strong ownership across ${developer.skills.slice(0, 2).join(" and ")}.`,
        })),
      ]
    : dummyTestimonials;

  const statsCarouselItems = [
    { id: "stat-clients", value: `${stats.clients}+`, label: "Happy Clients" },
    { id: "stat-developers", value: `${stats.developers}+`, label: "Expert Developers" },
    { id: "stat-countries", value: `${stats.countries}+`, label: "Countries Served" },
  ];

  return (
    <div style={styles.container}>
      <LeadCapturePopup />
      <PublicSiteNav />

      {/* Hero Section */}
      <section style={styles.hero} className="landing-hero">
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src="/videos/techVideo 2026-04-07 at 17.28.20.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent} className="landing-hero-content">
          <h1 style={styles.heroTitle} className="landing-hero-title">Your On-Demand <span style={styles.highlight}>Tech Partner</span></h1>
          <p style={styles.heroSubtitle} className="landing-hero-subtitle">Connect with top-tier developers, build amazing products, and scale your business with confidence.</p>
          <button onClick={handleGetStarted} style={styles.ctaButton} className="cta-hover">
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Features Grid - 6 cards */}
      <section id="features" ref={featuresRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Why Choose Websmith</h2>
        <p style={styles.sectionSubtitle}>Everything you need to build exceptional digital products</p>
        <div style={styles.featuresGrid} className="landing-features-grid">
          {features.map((feature, index) => (
            <button
              key={index} 
              type="button"
              onClick={() => {
                const target = document.querySelector(feature.href);
                if (target instanceof HTMLElement) {
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              style={{
                ...styles.featureCard,
                backgroundImage: `linear-gradient(rgba(249, 249, 251, 0.9), rgba(249, 249, 251, 0.9)), url(/images/assets/service_${index % 5 + 1}.png)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} 
              className="feature-card"
            >
              <div style={styles.featureIcon}>{<feature.icon size={28} />}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Stats Counters */}
      <section style={styles.statsSection}>
        <AutoCarousel
          items={statsCarouselItems}
          ariaLabel="Stats carousel"
          itemMinWidth={220}
          speedDesktop={0.03}
          speedMobile={0.045}
          renderItem={(item) => (
            <div style={styles.statCard}>
              <h3 style={styles.statNumber}>{item.value}</h3>
              <p style={styles.statLabel}>{item.label}</p>
            </div>
          )}
        />
      </section>

      <section id="projects" style={styles.section}>
        <h2 style={styles.sectionTitle}>Published Projects</h2>
        <p style={styles.sectionSubtitle}>Selected launches and delivery work with public-facing details only.</p>
        <AutoCarousel
          items={effectiveProjects}
          ariaLabel="Published projects carousel"
          itemMinWidth={280}
          speedDesktop={0.028}
          speedMobile={0.043}
          renderItem={(project: any) => (
            <div style={{ ...styles.featureCard, ...styles.sliderCard }} className="feature-card">
              {project.previewImage ? (
                <img src={project.previewImage} alt={project.name} style={styles.projectPreviewImage} />
              ) : null}
              <div style={styles.featureIcon}><Briefcase size={28} /></div>
              <h3 style={styles.featureTitle}>{project.name}</h3>
              <p style={styles.featureDesc}>{project.description}</p>
              <p style={{ ...styles.clientCompany, marginTop: "12px" }}>{project.client || "Published Project"}</p>
              {project.publicUrl ? (
                <a href={project.publicUrl} target="_blank" rel="noreferrer" style={styles.projectLink}>
                  <span>{project.publicUrl}</span>
                  <ExternalLink size={14} />
                </a>
              ) : (
                <p style={styles.projectLinkMuted}>Hosted project URL will appear here once added from the admin panel.</p>
              )}
            </div>
          )}
        />
      </section>

      {/* Global Diversity & Collaboration */}
      <section style={styles.diversitySection}>
          <div style={styles.diversityContent} className="landing-diversity-content">
          <div style={styles.diversityText}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px", color: "#1C1C1E" }}>Global Collaboration & Technical Excellence</h2>
            <p style={{ fontSize: "18px", color: "#6C6C70", lineHeight: 1.6, marginBottom: "24px" }}>
              Our team brings together diverse perspectives and world-class expertise to solve complex challenges. 
              We believe in the power of inclusive collaboration to build the next generation of digital products.
            </p>
            <div style={{ display: "flex", gap: "16px" }} className="landing-badges-row">
              <div style={styles.diversityBadge}>Enterprise Grade</div>
              <div style={styles.diversityBadge}>Diverse Talent</div>
            </div>
          </div>
          <div style={styles.diversityImageContainer}>
            <img 
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200" 
              alt="Global Technical Team" 
              style={styles.diversityImage}
            />
          </div>
        </div>
      </section>

      {/* Satisfied Clients - 10 Rectangle Cards */}
      <section id="clients" ref={clientsRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Our Satisfied Clients</h2>
        <p style={styles.sectionSubtitle}>Trusted by businesses worldwide</p>
        <AutoCarousel
          items={publicClients}
          ariaLabel="Clients carousel"
          itemMinWidth={260}
          speedDesktop={0.03}
          speedMobile={0.046}
          renderItem={(client, index) => (
            <div key={client.id || index} style={{ ...styles.clientCard, ...styles.sliderCard }} className="client-card">
              <div style={styles.clientAvatarContainer}>
                <Building2 size={22} color="#007AFF" />
              </div>
              <h4 style={styles.clientName}>{client.name}</h4>
              <p style={styles.clientCompany}>{client.company}</p>
              <p style={styles.clientProject}>{client.description}</p>
            </div>
          )}
        />
      </section>

      {/* Developers - expert profiles */}
      <section id="developers" ref={developersRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Meet Our Expert Developers</h2>
        <p style={styles.sectionSubtitle}>The technical minds behind your digital success</p>
        <AutoCarousel
          items={publicDevelopers}
          ariaLabel="Developers carousel"
          itemMinWidth={280}
          speedDesktop={0.03}
          speedMobile={0.046}
          renderItem={(dev) => (
            <div 
              key={dev.id} 
              style={{
                ...styles.developerCard,
                ...styles.sliderCard,
                background: "linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%)",
              }} 
              className="developer-card"
            >
              <div style={styles.circleMask}>
                {dev.avatar ? <img src={dev.avatar} alt={dev.name} style={styles.devAvatarImg} /> : <span style={styles.circleInitial}>{dev.name.charAt(0)}</span>}
              </div>
              <h4 style={styles.developerName}>{dev.name}</h4>
              <p style={styles.developerRole}>{dev.role}</p>
              <div style={styles.skillTags}>
                {dev.skills.slice(0, 3).map((skill, i) => (
                  <span key={i} style={styles.skillTag}>{skill}</span>
                ))}
              </div>
              <p style={styles.developerExperience}>{dev.experience}+ years experience</p>
              <p style={styles.developerBlurb}>{dev.bio}</p>
            </div>
          )}
        />
      </section>

      {/* Testimonials */}
      <section id="testimonials" style={styles.section}>
        <h2 style={styles.sectionTitle}>What Our Clients Say</h2>
        <p style={styles.sectionSubtitle}>Continuous feedback highlights from across projects, clients, and delivery teams.</p>
        <AutoCarousel
          items={reviewCards}
          ariaLabel="Testimonials carousel"
          itemMinWidth={280}
          speedDesktop={0.028}
          speedMobile={0.042}
          renderItem={(testimonial) => (
            <div key={testimonial.id} style={{ ...styles.testimonialCard, ...styles.sliderCard }} className="testimonial-card">
              <div style={styles.testimonialAvatar}>{testimonial.name.slice(0, 2).toUpperCase()}</div>
              <div style={styles.testimonialStars}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} fill="#FFB800" color="#FFB800" />
                ))}
              </div>
              <p style={styles.testimonialText}>"{testimonial.quote}"</p>
              <h4 style={styles.testimonialName}>{testimonial.name}</h4>
              <p style={styles.testimonialCompany}>{testimonial.company}</p>
            </div>
          )}
        />
      </section>

      {/* Contact Section */}
      <section id="contact" ref={contactFormRef} style={styles.contactSection}>
        <div style={styles.contactContainer}>
          <div style={styles.contactHeader}>
            <h2 style={styles.sectionTitle}>Get in Touch</h2>
            <p style={styles.sectionSubtitle}>Have a project in mind? Let's build something amazing together.</p>
          </div>
          
          <div style={styles.contactGrid}>
            <div style={styles.contactInfo}>
              <h3 style={styles.contactInfoTitle}>Contact Information</h3>
              <p style={styles.contactInfoDesc}>Fill out the form and our team will get back to you within 24 hours.</p>
              
              <div style={styles.infoItems}>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📍</div>
                  <div>
                    <h4 style={styles.infoLabel}>Headquarters</h4>
                    <p style={styles.infoValue}>123 Tech Avenue, Silicon Valley, CA</p>
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📧</div>
                  <div>
                    <h4 style={styles.infoLabel}>Email</h4>
                    <p style={styles.infoValue}>hello@websmith.com</p>
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoIcon}>📞</div>
                  <div>
                    <h4 style={styles.infoLabel}>Phone</h4>
                    <p style={styles.infoValue}>+1 (555) 000-0000</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={styles.contactFormContainer}>
              <div style={styles.contactGlassCard}>
                <form 
                  style={styles.contactForm}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmitting(true);
                    setSubmitStatus(null);
                    try {
                      await createPublicTicket({
                        name: contactState.name,
                        email: contactState.email,
                        company: "",
                        subject: contactState.subject,
                        message: contactState.message,
                      });
                      setSubmitStatus("success");
                      setContactState({ name: "", email: "", subject: "", message: "" });
                    } catch (error) {
                      console.error("Public inquiry error:", error);
                      setSubmitStatus("error");
                    } finally {
                      setIsSubmitting(false);
                      setTimeout(() => setSubmitStatus(null), 5000);
                    }
                  }}
                >
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe" 
                        style={styles.formInput}
                        required
                        value={contactState.name}
                        onChange={(e) => setContactState({ ...contactState, name: e.target.value })}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Email</label>
                      <input 
                        type="email" 
                        placeholder="john@example.com" 
                        style={styles.formInput}
                        required
                        value={contactState.email}
                        onChange={(e) => setContactState({ ...contactState, email: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Subject</label>
                    <input 
                      type="text" 
                      placeholder="Project Inquiry" 
                      style={styles.formInput}
                      required
                      value={contactState.subject}
                      onChange={(e) => setContactState({ ...contactState, subject: e.target.value })}
                    />
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Message</label>
                    <textarea 
                      placeholder="Tell us about your project..." 
                      style={styles.formTextarea}
                      required
                      value={contactState.message}
                      onChange={(e) => setContactState({ ...contactState, message: e.target.value })}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    style={styles.submitBtn} 
                    className="cta-hover"
                  >
                    {isSubmitting ? "Sending..." : (submitStatus === "success" ? "Message Sent!" : "Send Message")}
                  </button>
                  
                  {submitStatus === "success" && (
                    <p style={{ color: "#34C759", marginTop: "12px", fontSize: "14px", fontWeight: 500 }}>
                      Inquiry submitted successfully. It is now available in the admin query thread.
                    </p>
                  )}
                  {submitStatus === "error" && (
                    <p style={{ color: "#FF3B30", marginTop: "12px", fontSize: "14px", fontWeight: 500 }}>
                      We could not send your message right now. Please try again.
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" ref={footerRef} style={styles.footer}>
        <div style={styles.footerContent} className="landing-footer-content">
          <div style={styles.footerSection}>
            <h3 style={styles.footerLogo}>Websmith</h3>
            <p style={styles.footerDesc}>Your trusted partner for digital excellence.</p>
            <div style={styles.socialLinks}>
              <span className="social-icon" style={{ fontSize: "18px", cursor: "pointer" }}>🐦</span>
              <span className="social-icon" style={{ fontSize: "18px", cursor: "pointer" }}>💼</span>
              <span className="social-icon" style={{ fontSize: "18px", cursor: "pointer" }}>🐙</span>
              <span className="social-icon" style={{ fontSize: "18px", cursor: "pointer" }}>📘</span>
            </div>
          </div>
          <div style={styles.footerSection}>
            <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Company</h4>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>About Us</a>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Careers</a>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Blog</a>
          </div>
          <div style={styles.footerSection}>
            <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Resources</h4>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Documentation</a>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Support</a>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Contact</a>
          </div>
          <div style={styles.footerSection}>
            <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Legal</h4>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Privacy Policy</a>
            <a href="#" style={{ fontSize: "14px", color: "#6C6C70", textDecoration: "none" }}>Terms of Service</a>
          </div>
        </div>
        <div style={styles.copyright}>
          <p>© 2024 Websmith. All rights reserved. Developed with ❤️ by Websmith Team</p>
        </div>
      </footer>

      <style>{`
        /* Logo Hover */
        .logo-hover { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .logo-hover:hover { 
          transform: scale(1.02); 
        }
        
        /* Menu Item Hover - Apple Style */
        .menu-item-hover { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          position: relative;
        }
        .menu-item-hover::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          width: 0;
          height: 2px;
          background-color: #007AFF;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-50%);
        }
        .menu-item-hover:hover { 
          color: #007AFF !important; 
        }
        .menu-item-hover:hover::after { 
          width: 80%; 
        }
        
        /* Login Button Hover */
        .login-btn-hover { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .login-btn-hover:hover { 
          background-color: #F2F2F7 !important; 
          transform: translateY(-2px); 
        }
        .login-btn-hover:active { 
          transform: scale(0.98); 
        }
        
        /* CTA Button Hover */
        .cta-hover { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .cta-hover:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 8px 20px rgba(0,122,255,0.3); 
          background-color: #0055CC !important; 
        }
        .cta-hover:active { 
          transform: scale(0.98); 
        }
        
        /* Card Hover Effects */
        .feature-card { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .feature-card:hover { 
          transform: translateY(-5px); 
          box-shadow: 0 12px 24px rgba(0,0,0,0.1); 
        }
        
        .client-card { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .client-card:hover { 
          transform: translateY(-3px); 
          box-shadow: 0 8px 16px rgba(0,0,0,0.08); 
        }
        
        .developer-card { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .developer-card:hover { 
          transform: translateY(-5px); 
          box-shadow: 0 12px 28px rgba(0,0,0,0.12); 
        }
        
        .testimonial-card { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
        }
        .testimonial-card:hover { 
          transform: translateY(-3px); 
        }

        .landing-marquee-track {
          animation: landingMarquee 34s linear infinite;
          will-change: transform;
        }
        .landing-marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes landingMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        
        /* Social Icon Hover */
        .social-icon { 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
          display: inline-block; 
        }
        .social-icon:hover { 
          transform: translateY(-2px); 
          color: #007AFF; 
        }
        
        /* Mobile Menu Animations */
        .mobile-menu-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-menu-btn:hover {
          transform: scale(1.05);
          background-color: #F2F2F7;
        }
        
        .mobile-menu-item {
          transition: all 0.2s ease;
        }
        .mobile-menu-item:hover {
          background-color: #F2F2F7;
          transform: translateX(4px);
        }
        
        .mobile-login-btn {
          transition: all 0.2s ease;
        }
        .mobile-login-btn:hover {
          background-color: #F2F2F7;
          transform: translateX(4px);
        }

        .public-mobile-menu-overlay {
          opacity: 1;
          transition: opacity 0.2s ease;
        }

        .public-mobile-menu-panel {
          animation: publicNavSlideDown 0.22s ease;
        }

        @keyframes publicNavSlideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1024px) {
          .landing-hero-title {
            font-size: 46px !important;
          }
          .landing-diversity-content {
            gap: 32px !important;
          }
        }

        @media (max-width: 768px) {
          .landing-nav-shell {
            position: fixed !important;
            top: 0 !important;
            left: 0;
            right: 0;
            width: 100%;
          }
          .desktop-menu,
          .nav-buttons {
            display: none !important;
          }
          .mobile-menu-btn,
          .mobile-menu {
            display: flex !important;
          }
          .landing-nav-content {
            padding: 10px 16px !important;
          }
          .landing-hero {
            min-height: 62vh !important;
            padding: 56px 16px !important;
            margin-top: 57px !important;
          }
          .landing-hero-title {
            font-size: 36px !important;
            line-height: 1.1 !important;
          }
          .landing-hero-subtitle {
            font-size: 17px !important;
          }
          .landing-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 20px !important;
          }
          .landing-badges-row {
            flex-wrap: wrap;
          }
          .landing-footer-content {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 24px !important;
          }
        }

        @media (max-width: 520px) {
          .landing-hero-title {
            font-size: 30px !important;
          }
          .landing-hero-subtitle {
            font-size: 15px !important;
          }
          .landing-features-grid,
          .landing-client-grid,
          .landing-developer-grid,
          .landing-footer-content,
          .landing-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    backgroundColor: "var(--bg-primary)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  // Hero
  hero: {
    padding: "60px 0",
    textAlign: "center",
    position: "relative",
    color: "#FFFFFF",
    overflow: "hidden",
    minHeight: "50vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    zIndex: 1,
  },
  heroContent: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "0 24px",
    position: "relative",
    zIndex: 2,
  },
  heroTitle: {
    fontSize: "56px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "20px",
    color: "#FFFFFF",
    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
  },
  highlight: {
    color: "#007AFF",
    fontWeight: 700,
  },
  heroSubtitle: {
    fontSize: "20px",
    color: "#F2F2F7",
    fontWeight: 500,
    marginBottom: "32px",
    lineHeight: 1.4,
    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
  },
  ctaButton: {
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "inherit",
  },
  
  // Section
  section: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "80px 24px",
  },
  sectionTitle: {
    fontSize: "36px",
    fontWeight: 600,
    textAlign: "center",
    marginBottom: "16px",
    color: "#1C1C1E",
  },
  sectionSubtitle: {
    fontSize: "18px",
    color: "#6C6C70",
    textAlign: "center",
    marginBottom: "48px",
  },
  
  // Features Grid
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "24px",
  },
  featureCard: {
    padding: "28px",
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
  },
  featureIcon: {
    width: "56px",
    height: "56px",
    backgroundColor: "#E3F2FF",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#007AFF",
    marginBottom: "20px",
  },
  featureTitle: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "#1C1C1E",
  },
  featureDesc: {
    fontSize: "15px",
    color: "#6C6C70",
    lineHeight: 1.5,
  },
  projectLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#0A66FF",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    wordBreak: "break-all" as const,
  },
  projectLinkMuted: {
    margin: 0,
    color: "#8E8E93",
    fontSize: "12px",
  },
  projectPreviewImage: {
    width: "100%",
    height: "190px",
    objectFit: "cover",
    borderRadius: "18px",
    marginBottom: "18px",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  
  // Stats Section
  statsSection: {
    backgroundColor: "#1C1C1E",
    padding: "60px 0",
  },
  carouselRoot: {
    display: "block",
    maxWidth: "1380px",
    margin: "0 auto",
    padding: 0,
  },
  carouselViewport: {
    overflow: "hidden",
    minWidth: 0,
    cursor: "grab",
    touchAction: "pan-y",
  },
  carouselTrack: {
    display: "flex",
    width: "max-content",
    alignItems: "stretch",
    padding: 0,
  },
  carouselSlide: {
    flexShrink: 0,
  },
  sliderCard: {
    height: "100%",
  },
  statsGrid: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "32px",
    textAlign: "center",
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "16px",
    padding: "22px",
    minHeight: "132px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    textAlign: "center",
  },
  statNumber: {
    fontSize: "48px",
    fontWeight: 700,
    color: "#FFFFFF",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "14px",
    color: "#8E8E93",
  },
  
  // Client Grid
  clientGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "24px",
  },
  clientCard: {
    padding: "24px",
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    textAlign: "center",
  },
  clientAvatarContainer: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    margin: "0 auto 16px",
    border: "2px solid #E3F2FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F7FF",
  },
  clientAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  clientName: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "4px",
    color: "#1C1C1E",
  },
  clientCompany: {
    fontSize: "13px",
    color: "#007AFF",
    marginBottom: "8px",
  },
  clientProject: {
    fontSize: "13px",
    color: "#6C6C70",
    lineHeight: 1.6,
  },
  
  // Developer Grid
  developerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "24px",
  },
  developerCard: {
    padding: "24px",
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    textAlign: "center",
    cursor: "pointer",
  },
  circleMask: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    overflow: "hidden",
    margin: "0 auto 16px",
    backgroundColor: "#F2F2F7",
    border: "3px solid #E3F2FF",
  },
  devAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  circleInitial: {
    fontSize: "40px",
    fontWeight: 600,
    color: "#FFFFFF",
  },
  developerName: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "4px",
    color: "#1C1C1E",
  },
  developerRole: {
    fontSize: "13px",
    color: "#007AFF",
    marginBottom: "12px",
  },
  skillTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    justifyContent: "center",
    marginBottom: "12px",
  },
  skillTag: {
    padding: "4px 10px",
    backgroundColor: "#F2F2F7",
    borderRadius: "20px",
    fontSize: "11px",
    color: "#1C1C1E",
  },
  developerExperience: {
    fontSize: "12px",
    color: "#6C6C70",
    marginBottom: "8px",
  },
  developerBlurb: {
    fontSize: "13px",
    color: "#6C6C70",
    lineHeight: 1.6,
    margin: 0,
  },
  rating: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
  },
  ratingValue: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#FFB800",
    marginLeft: "4px",
  },
  
  // Testimonials
  testimonialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
  },
  marqueeViewport: {
    overflow: "hidden",
    maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
  },
  marqueeTrack: {
    display: "flex",
    gap: "20px",
    width: "max-content",
    paddingRight: "20px",
  },
  testimonialCard: {
    padding: "28px",
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    textAlign: "center",
    width: "320px",
    flexShrink: 0,
  },
  testimonialAvatar: {
    width: "60px",
    height: "60px",
    backgroundColor: "#007AFF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: "20px",
  },
  testimonialStars: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    marginBottom: "16px",
  },
  testimonialText: {
    fontSize: "15px",
    color: "#1C1C1E",
    lineHeight: 1.5,
    marginBottom: "16px",
    fontStyle: "italic",
  },
  testimonialName: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  testimonialCompany: {
    fontSize: "13px",
    color: "#6C6C70",
  },
  
  // Footer
  footer: {
    backgroundColor: "#F9F9FB",
    borderTop: "1px solid #E5E5EA",
    padding: "48px 0 24px",
  },
  footerContent: {
    maxWidth: "100%",
    margin: "0",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px",
    marginBottom: "40px",
  },
  footerSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  footerLogo: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  footerDesc: {
    fontSize: "14px",
    color: "#6C6C70",
  },
  socialLinks: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
  },
  copyright: {
    textAlign: "center",
    paddingTop: "24px",
    borderTop: "1px solid #E5E5EA",
    fontSize: "12px",
    color: "#8E8E93",
  },

  // Diversity Section Styles
  diversitySection: {
    backgroundColor: "#F5F5F7",
    padding: "100px 0",
  },
  diversityContent: {
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    gap: "60px",
    flexWrap: "wrap",
  },
  diversityText: {
    flex: 1,
    minWidth: "320px",
  },
  diversityImageContainer: {
    flex: 1,
    minWidth: "320px",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  diversityImage: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  diversityBadge: {
    padding: "8px 16px",
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#007AFF",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "inline-block",
  },

  // Contact Section Styles
  contactSection: {
    backgroundColor: "#FBFBFE",
    padding: "100px 0",
  },
  contactContainer: {
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "0 24px",
  },
  contactHeader: {
    textAlign: "center",
    marginBottom: "60px",
  },
  contactGrid: {
    display: "flex",
    gap: "60px",
    flexWrap: "wrap",
  },
  contactInfo: {
    flex: 1,
    minWidth: "300px",
  },
  contactInfoTitle: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1C1C1E",
    marginBottom: "16px",
  },
  contactInfoDesc: {
    fontSize: "16px",
    color: "#6C6C70",
    lineHeight: 1.6,
    marginBottom: "40px",
  },
  infoItems: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  infoItem: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  infoIcon: {
    width: "48px",
    height: "48px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  infoLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#8E8E93",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  infoValue: {
    fontSize: "16px",
    fontWeight: 500,
    color: "#1C1C1E",
  },
  contactFormContainer: {
    flex: 1.5,
    minWidth: "320px",
  },
  contactGlassCard: {
    backgroundColor: "#FFFFFF",
    padding: "40px",
    borderRadius: "24px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.05)",
    border: "1px solid #E5E5EA",
  },
  contactForm: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formRow: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
  },
  formGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "200px",
  },
  formLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  formInput: {
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #D1D1D6",
    fontSize: "16px",
    fontFamily: "inherit",
    outline: "none",
    transition: "all 0.2s ease",
    backgroundColor: "#F5F5F7",
  },
  formTextarea: {
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #D1D1D6",
    fontSize: "16px",
    fontFamily: "inherit",
    outline: "none",
    minHeight: "150px",
    resize: "vertical" as any,
    transition: "all 0.2s ease",
    backgroundColor: "#F5F5F7",
  },
  submitBtn: {
    padding: "16px 32px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "10px",
    transition: "all 0.3s ease",
    width: "100%",
  },
};

