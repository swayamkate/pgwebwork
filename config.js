/* PG Manager — configuration

   Supabase (sign-in and sign-up):
     Project Settings → API → Project URL  and  Project API keys → anon public

   While these are empty the site stays in demo mode: the admin / pass login and
   browser-only accounts keep working, so the preview never breaks.

   The anon key is meant to be public and shipped in the browser — access is
   controlled by Row Level Security. NEVER put the service_role key in this file.

   Google Sheets backup:
     SHEETS_URL is the /exec address of the Apps Script web app in
     apps-script/Code.gs. SHEETS_TOKEN must match the TOKEN inside that script.

   Everything in this file is public. The token only keeps random crawlers out;
   it is not a password, because anyone reading the page source can see it.
*/
window.PG_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SHEETS_URL: "",
  SHEETS_TOKEN: ""
};
