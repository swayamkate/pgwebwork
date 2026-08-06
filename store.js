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
    return { property: "", rooms: [], activity: [], cycle: cycleId() };
  }

  function cycleId() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1);
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
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

  function bedLabel(index) {
    return "ABCDEFGH".charAt(index) || String(index + 1);
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
        onNotice: false,
        paid: false
      };

      log("in", name + " checked in", "Room " + target.no + " · Bed " + bedLabel(i));
      save();
      return { ok: true };
    },

    removeTenant: function (roomId, bedIndex) {
      var target = room(roomId);
      if (!target) { return { ok: false, error: "Room not found." }; }
      var bed = target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is already empty." }; }

      target.beds[bedIndex] = null;
      log("out", bed.name + " checked out", "Room " + target.no + " · Bed " + bedLabel(Number(bedIndex)));
      save();
      return { ok: true };
    },

    toggleNotice: function (roomId, bedIndex) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }

      bed.onNotice = !bed.onNotice;
      log("out", bed.name + (bed.onNotice ? " is on notice" : " cancelled notice"),
        "Room " + target.no + " · Bed " + bedLabel(Number(bedIndex)));
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
            out.push({ roomId: r.id, roomNo: r.no, bedIndex: i, bed: bedLabel(i), rent: r.rent });
          }
        });
      });
      return out;
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
