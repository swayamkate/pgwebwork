/* PG Manager — Supabase configuration

   Fill these in from your Supabase dashboard:
     Project Settings → API → Project URL  and  Project API keys → anon public

   While these are empty the site stays in demo mode: the admin / pass login and
   browser-only accounts keep working, so the preview never breaks.

   The anon key is meant to be public and shipped in the browser — access is
   controlled by Row Level Security. NEVER put the service_role key in this file.
*/
window.PG_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
