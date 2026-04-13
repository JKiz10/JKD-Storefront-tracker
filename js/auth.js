// auth.js — Simple passkey authentication for GitHub Pages
// Uses SHA-256 hash comparison. Falls back to simple hash when crypto.subtle unavailable (HTTP).

const AUTH_KEY = 'jkd_auth_token';
// Default passkey: "JKDTeam"
const PASSKEY_HASH = '64fc32c9d57bd2230a64943db4940dced7c546d3840a89d0278613f8969f56b1';

// Fallback hash for non-HTTPS contexts where crypto.subtle is unavailable
function simpleFallbackHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'fallback_' + Math.abs(hash).toString(36);
}

const Auth = {
  async hashString(str) {
    // crypto.subtle only available in secure contexts (HTTPS, localhost)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(str);
      const buffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback for HTTP — less secure but functional
    return simpleFallbackHash(str);
  },

  async verify(passkey) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hash = await this.hashString(passkey);
      return hash === PASSKEY_HASH;
    }
    // On HTTP, do direct comparison (passkey is visible in source anyway on static sites)
    return passkey === 'JKDTeam';
  },

  isAuthenticated() {
    const token = sessionStorage.getItem(AUTH_KEY);
    return token === 'authenticated';
  },

  async login(passkey) {
    const valid = await this.verify(passkey);
    if (valid) {
      sessionStorage.setItem(AUTH_KEY, 'authenticated');
    }
    return valid;
  },

  logout() {
    sessionStorage.removeItem(AUTH_KEY);
  },
};

export default Auth;
