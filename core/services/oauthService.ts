// C:\websmith\core\services\oauthService.ts
// OAuth Service - Google & Yahoo Authentication
// Features: Popup window handling, token exchange, user registration

export class OAuthService {
  private static popup: Window | null = null;
  private static popupInterval: NodeJS.Timeout | null = null;

  // Google OAuth Login
  static async loginWithGoogle(): Promise<any> {
    return this.openOAuthPopup('google');
  }

  // Yahoo OAuth Login
  static async loginWithYahoo(): Promise<any> {
    return this.openOAuthPopup('yahoo');
  }

  private static openOAuthPopup(provider: 'google' | 'yahoo'): Promise<any> {
    return new Promise((resolve, reject) => {
      // OAuth URLs
      const oauthUrls = {
        google: 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'demo',
          redirect_uri: `${window.location.origin}/auth/callback`,
          response_type: 'token',
          scope: 'email profile',
          state: 'google_' + Date.now(),
        }),
        yahoo: 'https://api.login.yahoo.com/oauth2/request_auth?' + new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || 'demo',
          redirect_uri: `${window.location.origin}/auth/callback`,
          response_type: 'token',
          scope: 'openid email profile',
          state: 'yahoo_' + Date.now(),
        }),
      };

      // Calculate popup position (center of screen)
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open popup window
      this.popup = window.open(
        oauthUrls[provider],
        `${provider}_auth`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!this.popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth_success') {
          this.cleanup();
          resolve(event.data.user);
        } else if (event.data.type === 'oauth_error') {
          this.cleanup();
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup is closed by user
      this.popupInterval = setInterval(() => {
        if (this.popup?.closed) {
          this.cleanup();
          reject(new Error('Authentication cancelled'));
        }
      }, 500);

      // Store cleanup function
      (window as any).__oauth_cleanup = () => {
        this.cleanup();
        window.removeEventListener('message', messageHandler);
      };
    });
  }

  private static cleanup() {
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
      this.popupInterval = null;
    }
    this.popup = null;
  }

  // Demo mode - simulated OAuth for testing
  static async demoOAuth(provider: 'google' | 'yahoo'): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: `demo_${provider}_${Date.now()}`,
          name: `Demo ${provider === 'google' ? 'Google' : 'Yahoo'} User`,
          email: `demo.${provider}@example.com`,
          provider: provider,
        });
      }, 1500);
    });
  }
}