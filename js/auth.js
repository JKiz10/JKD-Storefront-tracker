// auth.js — Simple passkey authentication for GitHub Pages
// Uses SHA-256 hash comparison. Not enterprise-grade, but blocks unauthorized access.

const AUTH_KEY = 'jkd_auth_token';
// SHA-256 of the passkey — change this by running:
// crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_KEY')).then(b => Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''))
// Default passkey: "JKDTeam"
const PASSKEY_HASH = '64fc32c9d57bd2230a64943db4940dced7c546d3840a89d0278613f8969f56b1';

const Auth = {
  async hashString(str) {
    const data = new TextEncoder().encode(str);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  async verify(passkey) {
    const hash = await this.hashString(passkey);
    return hash === PASSKEY_HASH;
  },

  isAuthenticated() {
    const token = sessionStorage.getItem(AUTH_KEY);
    return token === PASSKEY_HASH;
  },

  async login(passkey) {
    const valid = await this.verify(passkey);
    if (valid) {
      sessionStorage.setItem(AUTH_KEY, PASSKEY_HASH);
    }
    return valid;
  },

  logout() {
    sessionStorage.removeItem(AUTH_KEY);
  },
};

export default Auth;
