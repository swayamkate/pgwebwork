/* PG Manager — authentication layer

   Uses Supabase Auth when config.js holds real project values, and otherwise
   falls back to the browser-only demo mode (admin / pass plus accounts saved in
   localStorage). Every method returns a Promise so callers work the same way in
   both modes.
*/
(function (global) {
  var cfg = global.PG_CONFIG || {};
  var PROJECT_URL = String(cfg.SUPABASE_URL || "").trim();
  var ANON_KEY = String(cfg.SUPABASE_ANON_KEY || "").trim();

  // The Supabase UMD bundle exposes a global "supabase" with createClient.
  var lib = global.supabase;
  var client = null;

  if (PROJECT_URL && ANON_KEY && lib && typeof lib.createClient === "function") {
    try {
      client = lib.createClient(PROJECT_URL, ANON_KEY);
    } catch (err) {
      client = null;
    }
  }

  var DEMO_ID = "admin";
  var DEMO_PW = "pass";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function readUsers() {
    try {
      var raw = JSON.parse(localStorage.getItem("pgUsers") || "[]");
      return Object.prototype.toString.call(raw) === "[object Array]" ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function writeUsers(list) {
    try {
      localStorage.setItem("pgUsers", JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  function startDemoSession(name) {
    try {
      sessionStorage.setItem("pgAuth", "ok");
      sessionStorage.setItem("pgUser", name);
    } catch (err) {}
  }

  function endDemoSession() {
    try {
      sessionStorage.removeItem("pgAuth");
      sessionStorage.removeItem("pgUser");
    } catch (err) {}
  }

  function demoSession() {
    try {
      if (sessionStorage.getItem("pgAuth") === "ok") {
        return { signedIn: true, name: sessionStorage.getItem("pgUser") || "Owner" };
      }
    } catch (err) {}
    return { signedIn: false, name: null };
  }

  function nameFromUser(user) {
    if (!user) { return "Owner"; }
    var meta = user.user_metadata || {};
    if (meta.full_name) { return meta.full_name; }
    if (user.email) { return user.email.split("@")[0]; }
    return "Owner";
  }

  var PGAuth = {
    // "supabase" once config.js is filled in, otherwise "demo"
    mode: client ? "supabase" : "demo",

    isEmail: function (value) {
      return EMAIL_RE.test(String(value || "").trim());
    },

    /* Create an account. Resolves { ok, needsConfirm } or { ok:false, error } */
    signUp: function (name, email, password) {
      var mail = String(email || "").trim().toLowerCase();

      if (client) {
        return client.auth
          .signUp({
            email: mail,
            password: password,
            options: { data: { full_name: name } }
          })
          .then(function (res) {
            if (res.error) { return { ok: false, error: res.error.message }; }
            // No session means the project requires email confirmation first.
            return { ok: true, needsConfirm: !(res.data && res.data.session) };
          })
          .catch(function (err) {
            return { ok: false, error: err && err.message ? err.message : "Could not reach Supabase." };
          });
      }

      return new Promise(function (resolve) {
        if (mail === DEMO_ID) {
          return resolve({ ok: false, error: "That login is reserved. Pick another." });
        }
        var users = readUsers();
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === mail) {
            return resolve({ ok: false, error: "That email is already registered." });
          }
        }
        users.push({ id: mail, pw: password, name: name, created: new Date().toISOString() });
        if (!writeUsers(users)) {
          return resolve({ ok: false, error: "Could not save the account in this browser." });
        }
        resolve({ ok: true, needsConfirm: false });
      });
    },

    /* Sign in. Resolves { ok, name } or { ok:false, error } */
    signIn: function (identifier, password) {
      var id = String(identifier || "").trim();

      // Demo owner login stays available in both modes as a fallback.
      if (id.toLowerCase() === DEMO_ID && password === DEMO_PW) {
        startDemoSession("Owner");
        return Promise.resolve({ ok: true, name: "Owner" });
      }

      if (client) {
        return client.auth
          .signInWithPassword({ email: id.toLowerCase(), password: password })
          .then(function (res) {
            if (res.error) { return { ok: false, error: res.error.message }; }
            return { ok: true, name: nameFromUser(res.data ? res.data.user : null) };
          })
          .catch(function (err) {
            return { ok: false, error: err && err.message ? err.message : "Could not reach Supabase." };
          });
      }

      var users = readUsers();
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === id.toLowerCase() && users[i].pw === password) {
          var who = users[i].name || users[i].id;
          startDemoSession(who);
          return Promise.resolve({ ok: true, name: who });
        }
      }
      return Promise.resolve({ ok: false, error: "Wrong email or password. Try again." });
    },

    /* Resolves { signedIn, name } */
    session: function () {
      if (client) {
        return client.auth
          .getSession()
          .then(function (res) {
            var s = res && res.data ? res.data.session : null;
            if (s) { return { signedIn: true, name: nameFromUser(s.user) }; }
            return demoSession();
          })
          .catch(function () {
            return demoSession();
          });
      }
      return Promise.resolve(demoSession());
    },

    signOut: function () {
      endDemoSession();
      if (client) {
        return client.auth.signOut().catch(function () {});
      }
      return Promise.resolve();
    }
  };

  global.PGAuth = PGAuth;
})(window);
