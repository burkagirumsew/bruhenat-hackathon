/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Supabase Global Configuration & Client Initialization
 */

(function () {
  'use strict';

  // Configured with the live Supabase project
  window.SUPABASE_CONFIG = {
    url: 'https://ieyzrrovmofjrzofldlq.supabase.co',
    anonKey: 'sb_publishable_NPoft3hHE0lj5ER37lL_RA_ZIyLQr7w'
  };

  // Helper to initialize and retrieve Supabase client instance
  window.getSupabaseClient = function () {
    if (window._supabaseInstance) {
      return window._supabaseInstance;
    }

    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      try {
        window._supabaseInstance = window.supabase.createClient(
          window.SUPABASE_CONFIG.url,
          window.SUPABASE_CONFIG.anonKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storageKey: 'bruh_enat_supabase_auth_token'
            }
          }
        );
        return window._supabaseInstance;
      } catch (err) {
        console.warn('Supabase client initialization warning:', err.message);
      }
    }
    return null;
  };

  // Initialize immediately if Supabase CDN is already loaded
  if (typeof window.supabase !== 'undefined') {
    window.getSupabaseClient();
  }
})();
