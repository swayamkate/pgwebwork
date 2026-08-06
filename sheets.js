/* PG Manager — Google Sheets backup.

   Sends a copy of the signed-in account's data to a Google Apps Script web app,
   which writes one tab per account into a single spreadsheet you own. The
   script URL and token live in config.js. See apps-script/Code.gs for the
   server side and the README for the setup steps.

   Apps Script web apps do not answer CORS preflight requests, so every call
   here is a "simple" request: POST with text/plain, never application/json.
   Sending JSON as the content type would fail before it left the browser.
*/
(function (global) {
  var cfg = global.PG_CONFIG || {};
  var ENDPOINT = String(cfg.SHEETS_URL || "").trim();
  var TOKEN = String(cfg.SHEETS_TOKEN || "").trim();
  var DELAY = 2500;

  var account = null;
  var timer = null;
  var queued = null;
  var busy = false;
  var watchers = [];

  // state: off | idle | saving | saved | error
  var status = { state: ENDPOINT ? "idle" : "off", at: null, error: null };

  function stampKey() {
    return "pgBackupAt:" + String(account || "local");
  }

  function readStamp() {
    try {
      return localStorage.getItem(stampKey());
    } catch (err) {
      return null;
    }
  }

  function writeStamp(iso) {
    try {
      localStorage.setItem(stampKey(), iso);
    } catch (err) {}
  }

  function emit() {
    watchers.forEach(function (fn) {
      try { fn(status); } catch (err) {}
    });
  }

  function setStatus(state, error) {
    status.state = state;
    status.error = error || null;
    if (state === "saved") {
      status.at = new Date().toISOString();
      writeStamp(status.at);
    }
    emit();
  }

  function call(payload) {
    payload.token = TOKEN;
    payload.account = account;

    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).catch(function () {
      // fetch only rejects for network-level failures, so the message is the
      // browser's "Failed to fetch", which means nothing to a PG owner.
      throw new Error("Could not reach the backup script. Check your connection and the script URL in config.js.");
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      var out;
      try {
        out = JSON.parse(text);
      } catch (err) {
        // Usually a Google sign-in page, which means the deployment is not
        // set to "Anyone".
        throw new Error("The script did not reply with data. Check that the web app is deployed with access set to Anyone.");
      }
      if (!out || !out.ok) {
        throw new Error((out && out.error) || "The backup script refused the request.");
      }
      return out;
    });
  }

  function push(data) {
    if (!ENDPOINT || !account) { return Promise.resolve(false); }

    busy = true;
    setStatus("saving");

    return call({ action: "push", data: data })
      .then(function () {
        busy = false;
        setStatus("saved");
        flushQueued();
        return true;
      })
      .catch(function (err) {
        busy = false;
        setStatus("error", err && err.message ? err.message : String(err));
        return false;
      });
  }

  /* A change made while a backup was in flight still needs to go out. */
  function flushQueued() {
    if (!queued) { return; }
    var next = queued;
    queued = null;
    push(next);
  }

  var PGSheets = {
    // true once config.js has a script URL
    enabled: !!ENDPOINT,

    use: function (accountId) {
      account = String(accountId || "local");
      status.at = readStamp();
      status.error = null;
      status.state = ENDPOINT ? "idle" : "off";
      emit();
      return status;
    },

    status: function () { return status; },

    onStatus: function (fn) {
      watchers.push(fn);
      fn(status);
    },

    /* Called after every change. Waits for typing to settle, then sends. */
    schedule: function (data) {
      if (!ENDPOINT || !account) { return; }
      if (busy) { queued = data; return; }
      clearTimeout(timer);
      timer = setTimeout(function () { push(data); }, DELAY);
    },

    backupNow: function (data) {
      if (!ENDPOINT) { return Promise.resolve(false); }
      clearTimeout(timer);
      if (busy) { queued = data; return Promise.resolve(false); }
      return push(data);
    },

    /* Reads this account's tab back out of the spreadsheet. */
    restore: function () {
      if (!ENDPOINT || !account) {
        return Promise.reject(new Error("Backup is not set up."));
      }
      setStatus("saving");
      return call({ action: "pull" }).then(function (out) {
        setStatus("idle");
        if (!out.data) {
          throw new Error("This account has nothing backed up yet.");
        }
        return out.data;
      }).catch(function (err) {
        setStatus("error", err && err.message ? err.message : String(err));
        throw err;
      });
    }
  };

  global.PGSheets = PGSheets;
})(window);
