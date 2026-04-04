// C:\websmith\app\register\page.tsx
// Register Page - Professional OAuth Registration (REAL OAuth - No Demo Mode)
// Features: Google & Yahoo OAuth with popup windows, professional card-in-card design
// Status: Ready for production with real OAuth credentials

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  ArrowLeft, 
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import API from "../../core/services/apiService";
import { OAuthService } from "../../core/services/oauthService";

export default function RegisterPage() {
  const router = useRouter();

  // Step management
  const [step, setStep] = useState<'provider' | 'form'>('provider');
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '', color: '#E5E5EA' });

  // OAuth Handlers - REAL OAuth (No Demo Mode)
  const handleOAuthLogin = async (provider: 'google' | 'yahoo') => {
    setIsOAuthLoading(provider);
    setError("");
    
    try {
      let userData;
      
      if (provider === 'google') {
        userData = await OAuthService.loginWithGoogle();
      } else {
        userData = await OAuthService.loginWithYahoo();
      }
      
      // Register or login with OAuth data
      const response = await API.post('/auth/oauth/register', {
        provider,
        email: userData.email,
        name: userData.name,
        providerId: userData.id,
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error(`${provider} OAuth error:`, err);
      setError(err.message || `${provider} authentication failed. Please try again.`);
    } finally {
      setIsOAuthLoading(null);
    }
  };

  // Password strength helper
  const getPasswordStrengthData = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    const finalScore = Math.min(score, 4);
    const messages = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#34C759'];
    
    return {
      score: finalScore,
      message: messages[finalScore],
      color: colors[finalScore]
    };
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    const strength = getPasswordStrengthData(pwd);
    setPasswordStrength({
      score: strength.score,
      message: strength.message,
      color: strength.color
    });
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: '' }));
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!agreeTerms) {
      errors.terms = 'You must agree to the terms and conditions';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await API.post("/auth/register", {
        name,
        email,
        password,
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        if (rememberMe) {
          localStorage.setItem("rememberMe", "true");
        }
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === 'form') {
      handleRegister();
    }
  };

  // Provider cards data
  const providers = [
    { 
      id: 'google', 
      name: 'Google', 
      icon: 'G', 
      color: '#DB4437', 
      bg: '#FEF2F0',
      gradient: 'linear-gradient(135deg, #DB4437 0%, #EA4335 100%)',
    },
    { 
      id: 'yahoo', 
      name: 'Yahoo', 
      icon: 'Y', 
      color: '#6001D2', 
      bg: '#F4F0FF',
      gradient: 'linear-gradient(135deg, #6001D2 0%, #7B1FA2 100%)',
    },
    { 
      id: 'other', 
      name: 'Other Email', 
      icon: '✉️', 
      color: '#007AFF', 
      bg: '#E3F2FF',
      gradient: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.background}></div>

      <div style={styles.card}>
        {/* Back to Login */}
        <button onClick={() => router.push("/login")} style={styles.backButton} className="back-button-hover">
          <ArrowLeft size={18} />
          <span>Back to Login</span>
        </button>

        {/* Logo Section */}
        <div style={styles.logoContainer}>
          <div style={styles.circleMask} className="circle-mask-hover">
            <span style={styles.circleText}>WSD</span>
          </div>
          <h1 style={styles.logoText} className="logo-text-hover">
            {step === 'provider' ? 'Join Websmith' : 'Create Account'}
          </h1>
        </div>

        {/* Provider Selection Step - Professional Card-in-Card Design */}
        {step === 'provider' && (
          <>
            <div style={styles.header}>
              <h2 style={styles.title}>Welcome to Websmith</h2>
              <p style={styles.subtitle}>Choose how you'd like to continue</p>
            </div>

            {/* Outer Card */}
            <div style={styles.outerCard}>
              <p style={styles.outerCardTitle}>Continue with</p>
              
              {/* Inner Cards Grid */}
              <div style={styles.innerCardsGrid}>
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      if (provider.id === 'other') {
                        setStep('form');
                      } else {
                        handleOAuthLogin(provider.id as 'google' | 'yahoo');
                      }
                    }}
                    disabled={isOAuthLoading !== null}
                    style={styles.innerCard}
                    className="inner-card"
                  >
                    <div style={{ ...styles.innerCardIcon, backgroundColor: provider.bg }}>
                      {isOAuthLoading === provider.id ? (
                        <div style={styles.smallSpinner}></div>
                      ) : (
                        <span style={{ ...styles.innerCardIconText, color: provider.color }}>
                          {provider.icon}
                        </span>
                      )}
                    </div>
                    <div style={styles.innerCardContent}>
                      <span style={styles.innerCardName}>{provider.name}</span>
                      <span style={styles.innerCardDesc}>
                        {provider.id === 'other' ? 'Use email & password' : `Sign in with ${provider.name}`}
                      </span>
                    </div>
                    <div style={styles.innerCardArrow}>→</div>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div style={styles.divider}>
                <span style={styles.dividerLine}></span>
                <span style={styles.dividerText}>Secure & Encrypted</span>
                <span style={styles.dividerLine}></span>
              </div>

              <p style={styles.securityNote}>
                <CheckCircle size={12} />
                Your data is protected with industry-standard encryption
              </p>
            </div>

            {error && (
              <div style={styles.errorContainer}>
                <AlertCircle size={16} />
                <span style={styles.errorText}>{error}</span>
              </div>
            )}
          </>
        )}

        {/* Registration Form Step */}
        {step === 'form' && (
          <>
            <div style={styles.header}>
              <button onClick={() => setStep('provider')} style={styles.backToProvider} className="back-provider-hover">
                <ArrowLeft size={16} />
                <span>Choose different provider</span>
              </button>
              <p style={styles.subtitle}>Create your account to get started</p>
            </div>

            {/* Full Name */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full name</label>
              <div style={styles.inputWrapper}>
                <User size={18} style={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: '' }));
                  }}
                  onKeyPress={handleKeyPress}
                  style={styles.input}
                  disabled={isLoading}
                  className="input-focus"
                />
              </div>
              {validationErrors.name && <p style={styles.validationError}>{validationErrors.name}</p>}
            </div>

            {/* Email */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email address</label>
              <div style={styles.inputWrapper}>
                <Mail size={18} style={styles.inputIcon} />
                <input
                  type="email"
                  placeholder="hello@websmith.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: '' }));
                  }}
                  onKeyPress={handleKeyPress}
                  style={styles.input}
                  disabled={isLoading}
                  className="input-focus"
                />
              </div>
              {validationErrors.email && <p style={styles.validationError}>{validationErrors.email}</p>}
            </div>

            {/* Password */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  style={styles.input}
                  disabled={isLoading}
                  className="input-focus"
                />
                <button onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton} type="button" className="eye-button-hover">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div style={styles.passwordStrength}>
                  <div style={styles.strengthBar}>
                    <div style={{ 
                      width: `${(passwordStrength.score + 1) * 20}%`, 
                      height: '4px', 
                      backgroundColor: passwordStrength.color, 
                      borderRadius: '4px', 
                      transition: 'width 0.3s ease' 
                    }} />
                  </div>
                  <p style={styles.strengthText}>
                    Password strength: <span style={{ color: passwordStrength.color }}>{passwordStrength.message}</span>
                  </p>
                </div>
              )}
              {validationErrors.password && <p style={styles.validationError}>{validationErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (validationErrors.confirmPassword) setValidationErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  onKeyPress={handleKeyPress}
                  style={styles.input}
                  disabled={isLoading}
                  className="input-focus"
                />
                <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton} type="button" className="eye-button-hover">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {validationErrors.confirmPassword && <p style={styles.validationError}>{validationErrors.confirmPassword}</p>}
            </div>

            {/* Checkboxes */}
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={styles.checkbox} />
                <span>Remember me</span>
              </label>
            </div>

            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={agreeTerms} onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  if (validationErrors.terms) setValidationErrors(prev => ({ ...prev, terms: '' }));
                }} style={styles.checkbox} />
                <span>I agree to the <a href="#" style={styles.link}>Terms of Service</a> and <a href="#" style={styles.link}>Privacy Policy</a></span>
              </label>
              {validationErrors.terms && <p style={styles.validationError}>{validationErrors.terms}</p>}
            </div>

            {error && (
              <div style={styles.errorContainer}>
                <AlertCircle size={16} />
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            <button onClick={handleRegister} disabled={isLoading} style={{ ...styles.registerButton, ...(isLoading ? styles.registerButtonDisabled : {}) }} className="register-button">
              {isLoading ? <div style={styles.spinner}></div> : "Create Account"}
            </button>

            <div style={styles.signinContainer}>
              <span style={styles.signinText}>Already have an account?</span>
              <button onClick={() => router.push("/login")} style={styles.signinButton} className="signin-link-button">Sign in</button>
            </div>
          </>
        )}
      </div>

      <div style={styles.footer}>
        <p style={styles.copyright}>© {new Date().getFullYear()} Websmith. All rights reserved.</p>
      </div>

      <style>{`
        .circle-mask-hover { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .circle-mask-hover:hover { transform: scale(1.1) translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
        .logo-text-hover { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; display: inline-block; }
        .logo-text-hover:hover { transform: scale(1.05) translateY(-2px); }
        .input-focus:focus { border-color: #007AFF !important; box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1) !important; }
        .eye-button-hover { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .eye-button-hover:hover { transform: scale(1.1); color: #007AFF; }
        .back-button-hover { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: inline-flex; align-items: center; gap: 8px; }
        .back-button-hover:hover { transform: translateX(-4px); color: #007AFF; }
        .back-provider-hover { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .back-provider-hover:hover { transform: translateX(-4px); color: #007AFF; }
        .inner-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .inner-card:hover { transform: translateX(8px); border-color: #007AFF; background-color: #F8F8FA; }
        .register-button { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .register-button:hover:not(:disabled) { background-color: #34C759 !important; transform: translateX(4px) translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 3px solid #1C1C1E; }
        .signin-link-button { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .signin-link-button:hover { transform: translateX(4px); color: #34C759 !important; border-left: 3px solid #34C759; padding-left: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinSmall { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    position: "relative",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at 20% 50%, rgba(0,122,255,0.08) 0%, rgba(242,242,247,0) 50%)",
    pointerEvents: "none",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "28px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)",
    border: "1px solid rgba(224,224,230,0.5)",
    position: "relative",
    zIndex: 1,
  },
  backButton: {
    position: "absolute",
    top: "28px",
    left: "28px",
    background: "none",
    border: "none",
    fontSize: "14px",
    color: "#8E8E93",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "inherit",
  },
  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "32px",
  },
  circleMask: {
    width: "64px",
    height: "64px",
    backgroundColor: "#1C1C1E",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
  },
  circleText: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#FFFFFF",
    letterSpacing: "0.5px",
  },
  logoText: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
    letterSpacing: "-0.3px",
    margin: 0,
  },
  header: {
    textAlign: "center",
    marginBottom: "28px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 600,
    color: "#1C1C1E",
    letterSpacing: "-0.5px",
    margin: 0,
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#8E8E93",
    margin: 0,
  },
  backToProvider: {
    background: "none",
    border: "none",
    fontSize: "13px",
    color: "#007AFF",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "16px",
    fontFamily: "inherit",
  },
  outerCard: {
    backgroundColor: "#F9F9FB",
    borderRadius: "20px",
    padding: "24px",
    border: "1px solid #E5E5EA",
  },
  outerCardTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "16px",
  },
  innerCardsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  innerCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E5EA",
    borderRadius: "14px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
  },
  innerCardIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  innerCardIconText: {
    fontSize: "22px",
    fontWeight: 600,
  },
  innerCardContent: {
    flex: 1,
    textAlign: "left",
  },
  innerCardName: {
    display: "block",
    fontSize: "16px",
    fontWeight: 600,
    color: "#1C1C1E",
    marginBottom: "4px",
  },
  innerCardDesc: {
    display: "block",
    fontSize: "12px",
    color: "#8E8E93",
  },
  innerCardArrow: {
    fontSize: "20px",
    color: "#C6C6C8",
    transition: "transform 0.2s ease",
  },
  smallSpinner: {
    width: "20px",
    height: "20px",
    border: "2px solid #E5E5EA",
    borderTopColor: "#007AFF",
    borderRadius: "50%",
    animation: "spinSmall 0.6s linear infinite",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
    marginBottom: "16px",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#E5E5EA",
  },
  dividerText: {
    fontSize: "11px",
    color: "#8E8E93",
    letterSpacing: "0.5px",
  },
  securityNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#34C759",
    margin: 0,
  },
  inputGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1C1C1E",
    marginBottom: "8px",
    letterSpacing: "-0.2px",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "16px",
    color: "#8E8E93",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "14px 16px 14px 44px",
    fontSize: "16px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    backgroundColor: "#FFFFFF",
    color: "#1C1C1E",
    transition: "all 0.2s ease",
    outline: "none",
    fontFamily: "inherit",
  },
  eyeButton: {
    position: "absolute",
    right: "16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#8E8E93",
    padding: 0,
    display: "flex",
    alignItems: "center",
  },
  passwordStrength: {
    marginTop: "8px",
  },
  strengthBar: {
    height: "4px",
    backgroundColor: "#E5E5EA",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "6px",
  },
  strengthText: {
    fontSize: "11px",
    color: "#8E8E93",
    margin: 0,
  },
  checkboxGroup: {
    marginBottom: "16px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#8E8E93",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  link: {
    color: "#007AFF",
    textDecoration: "none",
  },
  validationError: {
    fontSize: "12px",
    color: "#FF3B30",
    marginTop: "6px",
    marginBottom: 0,
  },
  errorContainer: {
    backgroundColor: "#FFE5E5",
    border: "1px solid #FF3B30",
    borderRadius: "12px",
    padding: "12px 16px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: "13px",
    fontWeight: 500,
    margin: 0,
  },
  registerButton: {
    width: "100%",
    padding: "14px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "#8E8E93",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    marginBottom: "20px",
    fontFamily: "inherit",
  },
  registerButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#FFFFFF",
    borderRadius: "50%",
    margin: "0 auto",
    animation: "spin 0.8s linear infinite",
  },
  signinContainer: {
    textAlign: "center",
  },
  signinText: {
    fontSize: "14px",
    color: "#8E8E93",
    marginRight: "6px",
  },
  signinButton: {
    background: "none",
    border: "none",
    fontSize: "14px",
    color: "#007AFF",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },
  footer: {
    position: "absolute",
    bottom: "24px",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: 1,
  },
  copyright: {
    fontSize: "12px",
    color: "#8E8E93",
    margin: 0,
  },
};