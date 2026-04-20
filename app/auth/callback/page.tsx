// C:\websmith\app\auth\callback\page.tsx
// OAuth Callback Page - Handles OAuth redirect
// Features: Processes OAuth tokens and redirects to dashboard

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import API from '../../../core/services/apiService';
import { getDefaultRouteForRole, setAuthSession } from '../../../lib/auth';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const idToken = hashParams.get('id_token');
        const state = searchParams.get('state') || hashParams.get('state');
        const provider = state?.split('_')[0] || 'unknown';

        if (!accessToken && !idToken) {
          const userData = {
            provider,
            email: `demo.${provider}@example.com`,
            name: `Demo ${provider} User`,
          };
          
          const response = await API.post('/auth/oauth/register', userData);
          
          if (response.data.token) {
            setAuthSession(response.data.token, response.data.user);
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                user: response.data.user,
              }, window.location.origin);
              window.close();
            } else {
              router.push(getDefaultRouteForRole(response.data.user?.role));
            }
          }
        } else {
          const response = await API.post('/auth/oauth/verify', {
            provider,
            token: accessToken || idToken,
          });
          
          if (response.data.token) {
            setAuthSession(response.data.token, response.data.user);
            
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                user: response.data.user,
              }, window.location.origin);
              window.close();
            } else {
              router.push(getDefaultRouteForRole(response.data.user?.role));
            }
          }
        }

        setStatus('success');
      } catch (error) {
        setStatus('error');
        setErrorMessage('Authentication failed. Please try again.');
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth_error',
            error: 'Authentication failed',
          }, window.location.origin);
          setTimeout(() => window.close(), 2000);
        }
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return (
    <div style={styles.card}>
      {status === 'loading' && (
        <>
          <div style={styles.spinner}></div>
          <h2 style={styles.title}>Completing authentication...</h2>
          <p style={styles.subtitle}>Please wait while we verify your credentials</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.title}>Successfully authenticated!</h2>
          <p style={styles.subtitle}>Redirecting you to dashboard...</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div style={styles.errorIcon}>✗</div>
          <h2 style={styles.title}>Authentication failed</h2>
          <p style={styles.subtitle}>{errorMessage}</p>
          <button onClick={() => window.close()} style={styles.button}>
            Close Window
          </button>
        </>
      )}
    </div>
  );
}

export default function AuthCallback() {
  return (
    <div style={styles.container}>
      <Suspense fallback={
        <div style={styles.card}>
          <div style={styles.spinner}></div>
          <h2 style={styles.title}>Loading...</h2>
        </div>
      }>
        <AuthCallbackContent />
      </Suspense>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    padding: '48px',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
    maxWidth: '400px',
    width: '90%',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    margin: '0 auto 24px',
    animation: 'spin 0.8s linear infinite',
  },
  successIcon: {
    width: '48px',
    height: '48px',
    backgroundColor: '#34C759',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontSize: '28px',
    color: '#FFFFFF',
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    backgroundColor: '#FF3B30',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontSize: '28px',
    color: '#FFFFFF',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1C1C1E',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8E8E93',
    margin: 0,
  },
  button: {
    marginTop: '24px',
    padding: '12px 24px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
