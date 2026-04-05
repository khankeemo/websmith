// C:\websmith\app\page.tsx
// Landing Page - Websmith
// Features: Hero section, Features grid, Stats counters, Satisfied clients, Developers section, Testimonials, Footer
// Updated: Added header navigation menu with smooth scroll

"use client";

import { useState, useEffect, useRef } from "react";
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
  Menu,
  X
} from "lucide-react";
import LeadCapturePopup from "../components/lead-funnel/LeadCapturePopup";

export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Refs for smooth scroll
  const featuresRef = useRef<HTMLElement>(null);
  const developersRef = useRef<HTMLElement>(null);
  const clientsRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  
  // Stats counter animation
  const [stats, setStats] = useState({
    projects: 0,
    clients: 0,
    developers: 0,
    countries: 0
  });

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

  // Smooth scroll function
  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const handleGetStarted = () => {
    router.push('/services');
  };

  // Menu items
  const menuItems = [
    { name: "Home", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { name: "Features", action: () => scrollToSection(featuresRef) },
    { name: "Developers", action: () => scrollToSection(developersRef) },
    { name: "Clients", action: () => scrollToSection(clientsRef) },
    { name: "Contact", action: () => scrollToSection(footerRef) },
  ];

  // Features data
  const features = [
    { icon: Code, title: "Expert Developers", description: "Top-tier developers with proven experience in modern tech stacks" },
    { icon: Rocket, title: "Fast Delivery", description: "Agile methodology ensuring quick turnaround without quality compromise" },
    { icon: Shield, title: "Secure Code", description: "Enterprise-grade security practices and regular code audits" },
    { icon: Zap, title: "24/7 Support", description: "Round-the-clock technical support and maintenance" },
    { icon: Users, title: "Dedicated Teams", description: "Build your dedicated development team tailored to your needs" },
    { icon: BarChart3, title: "Scalable Solutions", description: "Grow your business with scalable, future-proof solutions" }
  ];

  // Satisfied clients data
  const satisfiedClients = [
    { name: "Sarah Johnson", company: "TechCorp", project: "E-commerce Platform" },
    { name: "Michael Chen", company: "FinanceHub", project: "Mobile Banking App" },
    { name: "Emily Rodriguez", company: "HealthPlus", project: "Telemedicine Portal" },
    { name: "David Kim", company: "RetailPro", project: "Inventory Management" },
    { name: "Lisa Wang", company: "EduSmart", project: "Learning Management System" },
    { name: "James Wilson", company: "RealtyGroup", project: "Property Listing Platform" },
    { name: "Maria Garcia", company: "LogiTrack", project: "Fleet Management System" },
    { name: "Robert Taylor", company: "MediaHub", project: "Content Streaming Platform" },
    { name: "Jennifer Lee", company: "FoodDash", project: "Delivery Optimization App" },
    { name: "Thomas Brown", company: "TravelEasy", project: "Booking Management System" }
  ];

  // Developers data
  const developers = [
    { id: 1, name: "Alex Morgan", role: "Full Stack Developer", skills: ["React", "Node.js", "MongoDB"], experience: "8 years", rating: 4.9 },
    { id: 2, name: "Sophia Chen", role: "UI/UX Expert", skills: ["Figma", "Adobe XD", "Tailwind"], experience: "6 years", rating: 4.8 },
    { id: 3, name: "Marcus Williams", role: "Backend Specialist", skills: ["Python", "Django", "PostgreSQL"], experience: "10 years", rating: 5.0 },
    { id: 4, name: "Olivia Martinez", role: "Mobile Developer", skills: ["React Native", "Flutter", "iOS"], experience: "5 years", rating: 4.7 },
    { id: 5, name: "Ethan Kumar", role: "DevOps Engineer", skills: ["Docker", "K8s", "AWS"], experience: "7 years", rating: 4.9 },
    { id: 6, name: "Isabella Rossi", role: "Frontend Developer", skills: ["Vue.js", "Next.js", "TypeScript"], experience: "4 years", rating: 4.6 },
    { id: 7, name: "Liam O'Connor", role: "AI/ML Engineer", skills: ["TensorFlow", "PyTorch", "Python"], experience: "6 years", rating: 4.9 },
    { id: 8, name: "Ava Nakamura", role: "Security Expert", skills: ["Cybersecurity", "Pen Testing", "AWS"], experience: "9 years", rating: 5.0 },
    { id: 9, name: "Noah Schmidt", role: "Game Developer", skills: ["Unity", "C#", "3D Modeling"], experience: "5 years", rating: 4.7 },
    { id: 10, name: "Mia Thompson", role: "Cloud Architect", skills: ["Azure", "GCP", "Terraform"], experience: "11 years", rating: 5.0 }
  ];

  // Testimonials
  const testimonials = [
    { name: "John Davis", company: "TechCorp", text: "Websmith transformed our business with their exceptional development team. Highly recommended!", rating: 5, avatar: "JD" },
    { name: "Sarah Miller", company: "FinanceHub", text: "Professional, responsive, and technically brilliant. Best decision we made this year.", rating: 5, avatar: "SM" },
    { name: "David Wilson", company: "HealthPlus", text: "The team delivered beyond our expectations. Outstanding quality and support.", rating: 5, avatar: "DW" }
  ];

  return (
    <div style={styles.container}>
      <LeadCapturePopup />
      {/* Navigation - WITH MENU ITEMS */}
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          {/* Logo */}
          <div style={styles.logo} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="logo-hover">
            <div style={styles.logoCircle}>W</div>
            <span style={styles.logoText}>Websmith</span>
          </div>
          
          {/* Desktop Menu */}
          <div style={styles.desktopMenu}>
            {menuItems.map((item, index) => (
              <button 
                key={index} 
                onClick={item.action} 
                style={styles.menuItem}
                className="menu-item-hover"
              >
                {item.name}
              </button>
            ))}
          </div>
          
          {/* Desktop Buttons */}
          <div style={styles.navButtons}>
            <button onClick={() => router.push('/login')} style={styles.loginBtn} className="login-btn-hover">Log in</button>
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            style={styles.mobileMenuBtn}
            className="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div style={styles.mobileMenu}>
            {menuItems.map((item, index) => (
              <button 
                key={index} 
                onClick={item.action} 
                style={styles.mobileMenuItem}
                className="mobile-menu-item"
              >
                {item.name}
              </button>
            ))}
            <div style={styles.mobileMenuDivider} />
            <button 
              onClick={() => router.push('/login')} 
              style={styles.mobileLoginBtn}
              className="mobile-login-btn"
            >
              Log in
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Your On-Demand <span style={styles.highlight}>Tech Partner</span></h1>
          <p style={styles.heroSubtitle}>Connect with top-tier developers, build amazing products, and scale your business with confidence.</p>
          <button onClick={handleGetStarted} style={styles.ctaButton} className="cta-hover">
            Get Started <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Features Grid - 6 cards */}
      <section ref={featuresRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Why Choose Websmith</h2>
        <p style={styles.sectionSubtitle}>Everything you need to build exceptional digital products</p>
        <div style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} style={styles.featureCard} className="feature-card">
              <div style={styles.featureIcon}>{<feature.icon size={28} />}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Counters */}
      <section style={styles.statsSection}>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{stats.projects}+</h3>
            <p style={styles.statLabel}>Projects Completed</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{stats.clients}+</h3>
            <p style={styles.statLabel}>Happy Clients</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{stats.developers}+</h3>
            <p style={styles.statLabel}>Expert Developers</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statNumber}>{stats.countries}+</h3>
            <p style={styles.statLabel}>Countries Served</p>
          </div>
        </div>
      </section>

      {/* Satisfied Clients - 10 Rectangle Cards */}
      <section ref={clientsRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Our Satisfied Clients</h2>
        <p style={styles.sectionSubtitle}>Trusted by businesses worldwide</p>
        <div style={styles.clientGrid}>
          {satisfiedClients.map((client, index) => (
            <div key={index} style={styles.clientCard} className="client-card">
              <div style={styles.clientIcon}>
                <Briefcase size={24} />
              </div>
              <h4 style={styles.clientName}>{client.name}</h4>
              <p style={styles.clientCompany}>{client.company}</p>
              <p style={styles.clientProject}>{client.project}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Developers - 10 Circle Mask Cards */}
      <section ref={developersRef} style={styles.section}>
        <h2 style={styles.sectionTitle}>Meet Our Expert Developers</h2>
        <p style={styles.sectionSubtitle}>Work with the best talent in the industry</p>
        <div style={styles.developerGrid}>
          {developers.map((dev) => (
            <div 
              key={dev.id} 
              style={styles.developerCard} 
              className="developer-card"
              onClick={() => router.push(`/developer/${dev.id}`)}
            >
              <div style={styles.circleMask}>
                <span style={styles.circleInitial}>{dev.name.charAt(0)}</span>
              </div>
              <h4 style={styles.developerName}>{dev.name}</h4>
              <p style={styles.developerRole}>{dev.role}</p>
              <div style={styles.skillTags}>
                {dev.skills.slice(0, 3).map((skill, i) => (
                  <span key={i} style={styles.skillTag}>{skill}</span>
                ))}
              </div>
              <p style={styles.developerExperience}>📅 {dev.experience} experience</p>
              <div style={styles.rating}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill={i < Math.floor(dev.rating) ? "#FFB800" : "none"} color="#FFB800" />
                ))}
                <span style={styles.ratingValue}>{dev.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>What Our Clients Say</h2>
        <p style={styles.sectionSubtitle}>Real stories from real customers</p>
        <div style={styles.testimonialGrid}>
          {testimonials.map((testimonial, index) => (
            <div key={index} style={styles.testimonialCard} className="testimonial-card">
              <div style={styles.testimonialAvatar}>{testimonial.avatar}</div>
              <div style={styles.testimonialStars}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} fill="#FFB800" color="#FFB800" />
                ))}
              </div>
              <p style={styles.testimonialText}>"{testimonial.text}"</p>
              <h4 style={styles.testimonialName}>{testimonial.name}</h4>
              <p style={styles.testimonialCompany}>{testimonial.company}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer ref={footerRef} style={styles.footer}>
        <div style={styles.footerContent}>
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
        
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#FFFFFF",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  
  // Navigation
  nav: {
    position: "sticky",
    top: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid #E5E5EA",
    zIndex: 100,
  },
  navContent: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
  },
  logoCircle: {
    width: "36px",
    height: "36px",
    backgroundColor: "#1C1C1E",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: "18px",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  
  // Desktop Menu
  desktopMenu: {
    display: "flex",
    gap: "32px",
    alignItems: "center",
  },
  menuItem: {
    background: "none",
    border: "none",
    fontSize: "15px",
    fontWeight: 500,
    color: "#1C1C1E",
    cursor: "pointer",
    padding: "8px 0",
    fontFamily: "inherit",
    backgroundColor: "transparent",
  },
  
  // Buttons
  navButtons: {
    display: "flex",
    gap: "12px",
  },
  loginBtn: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid #D1D1D6",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  // Mobile Menu Button
  mobileMenuBtn: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
  },
  
  // Mobile Menu
  mobileMenu: {
    display: "none",
    flexDirection: "column",
    padding: "16px 24px",
    borderTop: "1px solid #E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  mobileMenuItem: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "8px",
    fontFamily: "inherit",
  },
  mobileMenuDivider: {
    height: "1px",
    backgroundColor: "#E5E5EA",
    margin: "12px 0",
  },
  mobileLoginBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid #D1D1D6",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    fontFamily: "inherit",
  },
  // Hero
  hero: {
    padding: "80px 24px",
    textAlign: "center",
    background: "linear-gradient(135deg, #F5F5F7 0%, #FFFFFF 100%)",
  },
  heroContent: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  heroTitle: {
    fontSize: "56px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "20px",
    color: "#1C1C1E",
  },
  highlight: {
    background: "linear-gradient(135deg, #007AFF 0%, #34C759 100%)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  heroSubtitle: {
    fontSize: "20px",
    color: "#6C6C70",
    marginBottom: "32px",
    lineHeight: 1.4,
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
    maxWidth: "1200px",
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
  
  // Stats Section
  statsSection: {
    backgroundColor: "#1C1C1E",
    padding: "60px 24px",
  },
  statsGrid: {
    maxWidth: "1000px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "32px",
    textAlign: "center",
  },
  statCard: {},
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
    gap: "20px",
  },
  clientCard: {
    padding: "20px",
    backgroundColor: "#F9F9FB",
    borderRadius: "16px",
    border: "1px solid #E5E5EA",
    textAlign: "center",
  },
  clientIcon: {
    width: "48px",
    height: "48px",
    backgroundColor: "#E3F2FF",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    color: "#007AFF",
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
    fontSize: "12px",
    color: "#6C6C70",
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
    backgroundColor: "#007AFF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
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
  testimonialCard: {
    padding: "28px",
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    textAlign: "center",
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
    padding: "48px 24px 24px",
  },
  footerContent: {
    maxWidth: "1200px",
    margin: "0 auto",
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
};

// Add responsive styles
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 768px) {
      .desktop-menu {
        display: none !important;
      }
      .nav-buttons {
        display: none !important;
      }
      .mobile-menu-btn {
        display: flex !important;
      }
      .mobile-menu {
        display: flex !important;
      }
      .hero-title {
        font-size: 40px !important;
      }
      .stats-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .footer-content {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }
    @media (min-width: 769px) {
      .mobile-menu-btn {
        display: none !important;
      }
      .mobile-menu {
        display: none !important;
      }
      .desktop-menu {
        display: flex !important;
      }
      .nav-buttons {
        display: flex !important;
      }
    }
  `;
  document.head.appendChild(style);
}
