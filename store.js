/* PG Manager — per-account data store.

   There is no sample data anywhere in this app. Every account starts with an
   empty property and fills it in through the UI.

   Data is saved in this browser under "pgData:<account id>", so two different
   logins never see each other's rooms or tenants. Moving this into Supabase
   tables is the next step; the method names below are deliberately shaped like
   the calls that will replace them.
*/
(function (global) {
  var PREFIX = "pgData:";
  var key = null;
  var state = blank();

  function blank() {
    return {
      property: "",
      rooms: [],
      activity: [],
      expenses: [],
      rates: [],
      owner: { name: "", phone: "", address: "" },
      settings: defaultSettings(),
      cycle: cycleId()
    };
  }

  /* How this PG is laid out. These are the owner's choices, so the defaults
     match the commonest setup: a building with floors, and beds lettered
     A, B, C starting again inside every room. */
  function defaultSettings() {
    return { floors: true, bedStyle: "alpha", bedNumbering: "restart" };
  }

  function cycleId() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1);
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /* Newest first. Dates are ISO yyyy-mm-dd, so a plain string compare works. */
  function sortExpenses(list) {
    list.sort(function (a, b) {
      if (a.date === b.date) { return 0; }
      return a.date < b.date ? 1 : -1;
    });
  }

  /* Dearest first, so the rate card reads like a price list. */
  function sortRates(list) {
    list.sort(function (a, b) { return b.amount - a.amount; });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clean(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 60);
  }

  /* Rebuild whatever was in storage into a shape the app can trust. */
  function normalise(raw) {
    var out = blank();
    if (!raw || typeof raw !== "object") { return out; }

    out.property = typeof raw.property === "string" ? raw.property : "";
    out.cycle = typeof raw.cycle === "string" ? raw.cycle : cycleId();

    /* Backups written before settings existed simply have none, which is
       normal rather than corrupt, so the defaults above stand. */
    if (raw.settings && typeof raw.settings === "object") {
      out.settings.floors = raw.settings.floors !== false;
      if (raw.settings.bedStyle === "number") { out.settings.bedStyle = "number"; }
      if (raw.settings.bedNumbering === "continue") { out.settings.bedNumbering = "continue"; }
    }

    if (raw.owner && typeof raw.owner === "object") {
      out.owner = {
        name: clean(raw.owner.name, 60),
        phone: clean(raw.owner.phone, 24),
        address: clean(raw.owner.address, 120)
      };
    }

    if (isArray(raw.rates)) {
      out.rates = raw.rates.filter(function (r) {
        return r && typeof r === "object";
      }).map(function (r) {
        return {
          id: r.id || uid(),
          label: clean(r.label, 40),
          amount: Math.max(0, Number(r.amount) || 0),
          note: clean(r.note, 60)
        };
      }).filter(function (r) {
        return r.label && r.amount > 0;
      }).slice(0, 30);
      sortRates(out.rates);
    }

    if (isArray(raw.rooms)) {
      out.rooms = raw.rooms.filter(function (r) {
        return r && typeof r === "object" && isArray(r.beds);
      }).map(function (r) {
        return {
          id: r.id || uid(),
          no: clean(r.no, 12),
          floor: Number(r.floor) || 0,
          rent: Math.max(0, Number(r.rent) || 0),
          beds: r.beds.map(function (b) {
            if (!b || typeof b !== "object") { return null; }
            return {
              name: clean(b.name, 60),
              phone: clean(b.phone, 24),
              joined: clean(b.joined, 24),
              leaving: clean(b.leaving, 24),
              note: clean(b.note, 200),
              onNotice: !!b.onNotice,
              paid: !!b.paid
            };
          })
        };
      });
    }

    if (isArray(raw.activity)) {
      out.activity = raw.activity.filter(function (a) {
        return a && typeof a === "object";
      }).slice(0, 20);
    }

    /* Backups written before expenses existed simply have no list, which is
       normal rather than corrupt, so it falls through to the blank array. */
    if (isArray(raw.expenses)) {
      out.expenses = raw.expenses.filter(function (x) {
        return x && typeof x === "object";
      }).map(function (x) {
        return {
          id: x.id || uid(),
          date: clean(x.date, 24) || today(),
          category: clean(x.category, 30) || "Other",
          note: clean(x.note, 80),
          amount: Math.max(0, Number(x.amount) || 0)
        };
      }).slice(0, 500);
      sortExpenses(out.expenses);
    }

    return out;
  }

  /* A new month means nobody has paid yet. */
  function rollCycle() {
    var now = cycleId();
    if (state.cycle === now) { return false; }
    state.cycle = now;
    state.rooms.forEach(function (room) {
      room.beds.forEach(function (bed) {
        if (bed) { bed.paid = false; }
      });
    });
    return true;
  }

  function load() {
    if (!key) { state = blank(); return state; }
    try {
      state = normalise(JSON.parse(localStorage.getItem(key) || "null"));
    } catch (err) {
      state = blank();
    }
    if (rollCycle()) { save(); }
    return state;
  }

  function save() {
    if (!key) { return false; }
    try {
      localStorage.setItem(key, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  function log(type, text, meta) {
    state.activity.unshift({
      type: type,
      text: text,
      meta: meta,
      at: new Date().toISOString()
    });
    if (state.activity.length > 20) { state.activity.length = 20; }
  }

  function room(id) {
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].id === id) { return state.rooms[i]; }
    }
    return null;
  }

  /* A, B, C … Z, then AA, AB — so a long corridor never runs out of letters. */
  function alphaLabel(n) {
    var out = "";
    n = Math.max(0, Number(n) || 0);
    do {
      out = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(n % 26) + out;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return out;
  }

  /* How many beds sit before this room, for owners who number straight
     through the property instead of starting again in every room. */
  function bedOffset(roomId) {
    var total = 0;
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].id === roomId) { return total; }
      total += state.rooms[i].beds.length;
    }
    return 0;
  }

  /* Pass the room id whenever you have it. Without one this falls back to
     labelling the bed on its own, which is right for a picker row. */
  function bedLabel(index, roomId) {
    var s = state.settings || {};
    var n = Math.max(0, Number(index) || 0);
    if (roomId && s.bedNumbering === "continue") { n += bedOffset(roomId); }
    return s.bedStyle === "number" ? String(n + 1) : alphaLabel(n);
  }

  var PGStore = {
    /* Point the store at one account and load that account's data. */
    use: function (accountId) {
      key = PREFIX + String(accountId || "local");
      return load();
    },

    state: function () { return state; },

    isEmpty: function () { return state.rooms.length === 0; },

    bedLabel: bedLabel,

    setProperty: function (name) {
      state.property = clean(name, 60);
      save();
      return { ok: true };
    },

    addRoom: function (data) {
      var no = clean(data.no, 12);
      var count = Number(data.beds);

      if (!no) { return { ok: false, error: "Give the room a number or name." }; }
      if (!(count >= 1 && count <= 8)) { return { ok: false, error: "A room needs between 1 and 8 beds." }; }

      for (var i = 0; i < state.rooms.length; i++) {
        if (state.rooms[i].no.toLowerCase() === no.toLowerCase()) {
          return { ok: false, error: "Room " + no + " already exists." };
        }
      }

      var beds = [];
      for (var b = 0; b < count; b++) { beds.push(null); }

      state.rooms.push({
        id: uid(),
        no: no,
        floor: Math.max(0, Number(data.floor) || 0),
        rent: Math.max(0, Number(data.rent) || 0),
        beds: beds
      });

      state.rooms.sort(function (a, b2) {
        return a.floor - b2.floor || a.no.localeCompare(b2.no, undefined, { numeric: true });
      });

      log("in", "Room " + no + " added",
        count + " beds · ₹" + (Number(data.rent) || 0).toLocaleString("en-IN") + " per bed");
      save();
      return { ok: true };
    },

    removeRoom: function (id) {
      var target = room(id);
      if (!target) { return { ok: false, error: "That room is gone already." }; }
      state.rooms = state.rooms.filter(function (r) { return r.id !== id; });
      log("out", "Room " + target.no + " removed", "");
      save();
      return { ok: true };
    },

    addTenant: function (roomId, bedIndex, data) {
      var target = room(roomId);
      var i = Number(bedIndex);

      if (!target) { return { ok: false, error: "Pick a room first." }; }
      if (!(i >= 0 && i < target.beds.length)) { return { ok: false, error: "Pick a bed first." }; }
      if (target.beds[i]) { return { ok: false, error: "That bed is already taken." }; }

      var name = clean(data.name, 60);
      if (!name) { return { ok: false, error: "Enter the tenant's name." }; }

      target.beds[i] = {
        name: name,
        phone: clean(data.phone, 24),
        joined: clean(data.joined, 24) || new Date().toISOString().slice(0, 10),
        leaving: clean(data.leaving, 24),
        note: clean(data.note, 200),
        onNotice: false,
        paid: false
      };

      log("in", name + " checked in", "Room " + target.no + " · Bed " + bedLabel(i, target.id));
      save();
      return { ok: true };
    },

    /* Edit someone already in a bed. The bed itself never moves here, so rent
       and payment state are left exactly as they were. */
    updateTenant: function (roomId, bedIndex, data) {
      var target = room(roomId);
      var i = Number(bedIndex);
      var bed = target && target.beds[i];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }

      var name = clean(data.name, 60);
      if (!name) { return { ok: false, error: "Enter the tenant's name." }; }

      var before = bed.name;
      bed.name = name;
      bed.phone = clean(data.phone, 24);
      bed.joined = clean(data.joined, 24);
      bed.leaving = clean(data.leaving, 24);
      bed.note = clean(data.note, 200);

      log("in",
        before === name ? name + "'s details updated" : before + " is now " + name,
        "Room " + target.no + " \u00b7 Bed " + bedLabel(i, target.id));
      save();
      return { ok: true };
    },

    removeTenant: function (roomId, bedIndex) {
      var target = room(roomId);
      if (!target) { return { ok: false, error: "Room not found." }; }
      var bed = target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is already empty." }; }

      target.beds[bedIndex] = null;
      log("out", bed.name + " checked out", "Room " + target.no + " · Bed " + bedLabel(Number(bedIndex), target.id));
      save();
      return { ok: true };
    },

    toggleNotice: function (roomId, bedIndex) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }

      bed.onNotice = !bed.onNotice;
      log("out", bed.name + (bed.onNotice ? " is on notice" : " cancelled notice"),
        "Room " + target.no + " · Bed " + bedLabel(Number(bedIndex), target.id));
      save();
      return { ok: true };
    },

    setPaid: function (roomId, bedIndex, paid) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }

      bed.paid = !!paid;
      if (bed.paid) {
        log("pay", "Rent received from " + bed.name,
          "Room " + target.no + " · ₹" + Number(target.rent || 0).toLocaleString("en-IN"));
      }
      save();
      return { ok: true };
    },

    /* Vacant beds across the property, for the "add tenant" picker. */
    vacantBeds: function () {
      var out = [];
      state.rooms.forEach(function (r) {
        r.beds.forEach(function (bed, i) {
          if (!bed) {
            out.push({ roomId: r.id, roomNo: r.no, bedIndex: i, bed: bedLabel(i, r.id), rent: r.rent });
          }
        });
      });
      return out;
    },

    /* Expenses are history, so a new month never clears them. */
    addExpense: function (data) {
      var amount = Math.max(0, Number(data.amount) || 0);
      var category = clean(data.category, 30) || "Other";

      if (!(amount > 0)) { return { ok: false, error: "Enter an amount above zero." }; }

      var entry = {
        id: uid(),
        date: clean(data.date, 24) || today(),
        category: category,
        note: clean(data.note, 80),
        amount: amount
      };

      state.expenses.push(entry);
      sortExpenses(state.expenses);

      log("out", category + " expense of \u20b9" + amount.toLocaleString("en-IN"), entry.note || "");
      save();
      return { ok: true };
    },

    removeExpense: function (id) {
      var gone = null;
      state.expenses = state.expenses.filter(function (x) {
        if (x.id === id) { gone = x; return false; }
        return true;
      });
      if (!gone) { return { ok: false, error: "That expense is gone already." }; }

      log("in", "Expense removed",
        gone.category + " \u00b7 \u20b9" + gone.amount.toLocaleString("en-IN"));
      save();
      return { ok: true };
    },

    /* ---------- owner, settings and the rate card ---------- */

    settings: function () { return state.settings; },

    /* Only the keys present in the patch change, so a single control can be
       flipped without the caller having to know the rest. */
    setSettings: function (patch) {
      var s = state.settings;
      if (!patch || typeof patch !== "object") { return { ok: false, error: "Nothing to change." }; }
      if (patch.floors != null) { s.floors = !!patch.floors; }
      if (patch.bedStyle === "alpha" || patch.bedStyle === "number") { s.bedStyle = patch.bedStyle; }
      if (patch.bedNumbering === "restart" || patch.bedNumbering === "continue") {
        s.bedNumbering = patch.bedNumbering;
      }
      save();
      return { ok: true };
    },

    setOwner: function (data) {
      var name = clean(data.name, 60);
      if (!name) { return { ok: false, error: "Enter your name." }; }

      state.owner = {
        name: name,
        phone: clean(data.phone, 24),
        address: clean(data.address, 120)
      };
      log("in", "Owner details updated", name);
      save();
      return { ok: true };
    },

    addRate: function (data) {
      var label = clean(data.label, 40);
      var amount = Math.max(0, Number(data.amount) || 0);

      if (!label) { return { ok: false, error: "Name the rate, like \u201c2 sharing\u201d." }; }
      if (!(amount > 0)) { return { ok: false, error: "Enter an amount above zero." }; }
      if (state.rates.length >= 30) { return { ok: false, error: "That is as many rates as one card holds." }; }

      state.rates.push({
        id: uid(),
        label: label,
        amount: amount,
        note: clean(data.note, 60)
      });
      sortRates(state.rates);

      log("in", "Rate added: " + label, "\u20b9" + amount.toLocaleString("en-IN") + " per bed");
      save();
      return { ok: true };
    },

    removeRate: function (id) {
      var gone = null;
      state.rates = state.rates.filter(function (r) {
        if (r.id === id) { gone = r; return false; }
        return true;
      });
      if (!gone) { return { ok: false, error: "That rate is gone already." }; }

      log("out", "Rate removed: " + gone.label, "");
      save();
      return { ok: true };
    },

    /* Overwrite everything with a restored backup. */
    replaceAll: function (raw) {
      state = normalise(raw);
      save();
      return { ok: true };
    },

    clearAll: function () {
      state = blank();
      save();
      return { ok: true };
    }
  };

  global.PGStore = PGStore;
})(window);
