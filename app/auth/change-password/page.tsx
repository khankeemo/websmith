'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import API from '../../../core/services/apiService';
import { Lock, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  getPasswordChecklist,
  getPasswordValidationMessage,
  validateStrongPassword,
} from '../../../core/utils/validation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if user is logged in and needs password change
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    
    const user = JSON.parse(userStr);
    if (!user.isTemporaryPassword) {
      // Already set up — redirect to their actual dashboard
      const role = user.role || 'client';
      const route = role === 'admin' ? '/admin/dashboard' : role === 'developer' ? '/developer/dashboard' : '/client/dashboard';
      router.push(route);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateStrongPassword(newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await API.post('/auth/change-password', { newPassword });
      
      // Update local storage user data
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.isTemporaryPassword = false;
        user.setupCompleted = true;
        user.isApproved = true;
        localStorage.setItem('user', JSON.stringify(user));
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/client/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checklist = getPasswordChecklist(newPassword);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.iconCircle}>
            <ShieldCheck size={32} color="#007AFF" />
          </div>
          <h1 style={styles.title}>Secure Your Account</h1>
          <p style={styles.subtitle}>
            This is your first login. For your security, please update your temporary password before continuing.
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={styles.successBox}>
            <ShieldCheck size={24} />
            <p>Password updated successfully! Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <div style={styles.inputWrapper}>
                <Lock style={styles.fieldIcon} size={18} color="#8E8E93" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  required
                />
                <button type="button" onClick={() => setShowNewPassword((value) => !value)} style={styles.eyeBtn}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p style={styles.helperText}>
                {getPasswordValidationMessage()} Requirement status: {Object.values(checklist).filter(Boolean).length}/5
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <div style={styles.inputWrapper}>
                <Lock style={styles.fieldIcon} size={18} color="#8E8E93" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  required
                />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} style={styles.eyeBtn}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password & Continue'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    padding: '20px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
    animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    backgroundColor: '#E3F2FF',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1C1C1E',
    marginBottom: '12px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#636366',
    lineHeight: 1.5,
  },
  errorBox: {
    backgroundColor: '#FFF2F0',
    color: '#FF3B30',
    padding: '12px 16px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    marginBottom: '24px',
    border: '1px solid rgba(255,59,48,0.1)',
  },
  successBox: {
    backgroundColor: '#F2F9F4',
    color: '#34C759',
    padding: '24px',
    borderRadius: '16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    fontSize: '16px',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1C1C1E',
    marginLeft: '4px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: '16px',
  },
  input: {
    width: '100%',
    padding: '14px 48px 14px 48px',
    fontSize: '16px',
    backgroundColor: '#F2F2F7',
    border: '1.5px solid transparent',
    borderRadius: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  submitBtn: {
    marginTop: '12px',
    padding: '16px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: '16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#8E8E93',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  helperText: {
    margin: '8px 0 0 4px',
    fontSize: '12px',
    color: '#636366',
    lineHeight: 1.4,
  },
};
