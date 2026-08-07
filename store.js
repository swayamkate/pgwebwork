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

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* The day of the month rent is collected on. Anything that is not a real
     day of a month is stored as 0, meaning "not set", so an empty field never
     quietly becomes the 1st. */
  function day(value) {
    var n = Math.floor(Number(value));
    return (n >= 1 && n <= 31) ? n : 0;
  }

  /* Dates arrive as yyyy-mm-dd. Handing that straight to `new Date` reads it
     as UTC, which can slide back a day — and so back a month — in a timezone
     behind UTC. So the year and month are lifted out of the text whenever the
     text allows it, and only odd input falls through to Date. */
  function ym(value) {
    var text = String(value == null ? "" : value);
    var m = /^(\d{4})-(\d{2})/.exec(text);
    if (m) { return { y: Number(m[1]), m: Number(m[2]) - 1 }; }
    var d = new Date(text);
    if (isNaN(d.getTime())) { return null; }
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  /* Rent is charged by calendar month, and the ledger is keyed by one. These
     keys are zero padded ("2026-08") so a plain string compare puts them in
     order, which the cycle id above is not. */
  function monthKey(value) {
    if (value) {
      var p = ym(value);
      if (p) { return p.y + "-" + pad2(p.m + 1); }
    }
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }

  function thisMonth() {
    return monthKey(null);
  }

  /* The cycle id was never padded, so it needs translating before it can sit
     alongside a ledger key. */
  function cycleMonth(cycle) {
    var bits = String(cycle || "").split("-");
    var y = Number(bits[0]);
    var m = Number(bits[1]);
    if (y > 1970 && m >= 1 && m <= 12) { return y + "-" + pad2(m); }
    return thisMonth();
  }

  function monthLabel(month) {
    var p = ym(month);
    if (!p) { return String(month || ""); }
    return new Date(p.y, p.m, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }

  /* Every month from one date to another, oldest first, both ends included.
     The guard stops a nonsense pair of dates spinning forever. */
  function monthsBetween(from, to) {
    var a = ym(from);
    var b = ym(to);
    if (!a || !b) { return []; }

    var out = [];
    var y = a.y;
    var m = a.m;
    var guard = 0;

    while ((y < b.y || (y === b.y && m <= b.m)) && guard++ < 600) {
      out.push(y + "-" + pad2(m + 1));
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return out;
  }

  /* A month key that is real, not merely the right shape. "2026-13" passes a
     loose pattern and then sorts and compares as though it were a month,
     which quietly corrupts every total it touches. */
  function isMonth(value) {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }

  function hasMonth(bed, month) {
    return !!bed && isArray(bed.paidMonths) && bed.paidMonths.indexOf(month) !== -1;
  }

  function addMonth(bed, month) {
    if (!isArray(bed.paidMonths)) { bed.paidMonths = []; }
    if (bed.paidMonths.indexOf(month) !== -1) { return false; }
    bed.paidMonths.push(month);
    bed.paidMonths.sort();
    return true;
  }

  function dropMonth(bed, month) {
    if (!isArray(bed.paidMonths)) { bed.paidMonths = []; return false; }
    var before = bed.paidMonths.length;
    bed.paidMonths = bed.paidMonths.filter(function (m) { return m !== month; });
    return bed.paidMonths.length !== before;
  }

  /* The window a tenant can owe rent for: from the day they joined up to
     today, stopping early if they have already moved out. */
  function billedTo(bed) {
    var to = today();
    if (bed.leaving && bed.leaving < to) { to = bed.leaving; }
    return to;
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

    /* Which month an older backup's single "paid" flag was talking about. */
    var seed = cycleMonth(out.cycle);

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

            var months = isArray(b.paidMonths)
              ? b.paidMonths.filter(isMonth).slice(0, 240).sort()
              : [];

            /* Backups written before the ledger existed carry a single "paid"
               flag, which meant "settled for the month showing at the time".
               Seeding that month keeps those tenants looking settled instead
               of suddenly owing again. */
            if (!months.length && b.paid) { months = [seed]; }

            return {
              name: clean(b.name, 60),
              phone: clean(b.phone, 24),
              joined: clean(b.joined, 24),
              leaving: clean(b.leaving, 24),
              note: clean(b.note, 200),
              collect: day(b.collect),
              onNotice: !!b.onNotice,
              paidMonths: months,
              paid: months.indexOf(thisMonth()) !== -1
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

  /* A new month starts unpaid, but the ledger is the memory: a month that
     was settled in advance stays settled when it comes around. */
  function rollCycle() {
    var now = cycleId();
    if (state.cycle === now) { return false; }
    state.cycle = now;

    var month = thisMonth();
    state.rooms.forEach(function (room) {
      room.beds.forEach(function (bed) {
        if (bed) { bed.paid = hasMonth(bed, month); }
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
        collect: day(data.collect),
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
      bed.collect = day(data.collect);

      log("in",
        before === name ? name + "'s details updated" : before + " is now " + name,
        "Room " + target.no + " \\u00b7 Bed " + bedLabel(i, target.id));
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

      /* The tile shows one month; the ledger remembers all of them. Keep the
         two in step so nothing has to know which is the real record. */
      var month = thisMonth();
      bed.paid = !!paid;
      if (bed.paid) { addMonth(bed, month); } else { dropMonth(bed, month); }

      if (bed.paid) {
        log("pay", "Rent received from " + bed.name,
          "Room " + target.no + " · ₹" + Number(target.rent || 0).toLocaleString("en-IN"));
      }
      save();
      return { ok: true };
    },

    /* ---------- rent ---------- */

    /* Change a room's number, floor or rent. Everyone in it keeps their bed
       and their payment history; only what the room charges changes. */
    updateRoom: function (id, data) {
      var target = room(id);
      if (!target) { return { ok: false, error: "That room is gone already." }; }
      if (!data || typeof data !== "object") { return { ok: false, error: "Nothing to change." }; }

      var no = clean(data.no, 12) || target.no;
      for (var i = 0; i < state.rooms.length; i++) {
        if (state.rooms[i].id !== id && state.rooms[i].no.toLowerCase() === no.toLowerCase()) {
          return { ok: false, error: "Room " + no + " already exists." };
        }
      }

      /* An empty rent box means "leave it alone", not "make it free". */
      var rent = target.rent;
      if (data.rent != null && data.rent !== "") {
        rent = Number(data.rent);
        if (!isFinite(rent) || rent < 0) {
          return { ok: false, error: "Enter the rent as a number, or 0 if it is not set yet." };
        }
      }

      var wasRent = target.rent;
      var wasNo = target.no;

      target.no = no;
      target.rent = rent;
      if (data.floor != null && data.floor !== "") {
        target.floor = Math.max(0, Number(data.floor) || 0);
      }

      state.rooms.sort(function (a, b) {
        return a.floor - b.floor || a.no.localeCompare(b.no, undefined, { numeric: true });
      });

      if (wasRent !== rent) {
        log("in", "Room " + no + " rent is now \\u20b9" + rent.toLocaleString("en-IN"),
          "was \\u20b9" + Number(wasRent || 0).toLocaleString("en-IN") + " per bed");
      } else {
        log("in", wasNo === no ? "Room " + no + " updated" : "Room " + wasNo + " is now " + no, "");
      }

      save();
      return { ok: true, changedRent: wasRent !== rent };
    },

    /* ---------- the payment ledger ---------- */

    monthKey: monthKey,
    monthLabel: monthLabel,
    monthsBetween: monthsBetween,

    /* One row per month this tenant has been here, oldest first. Runs from
       the joining date to today, or to the leaving date if that came first,
       so nobody is shown owing rent for months after they moved out. */
    ledger: function (roomId, bedIndex, upto) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return []; }

      var from = bed.joined || today();
      var to = clean(upto, 24) || billedTo(bed);
      if (to < from) { to = from; }

      return monthsBetween(from, to).map(function (m) {
        return { month: m, label: monthLabel(m), paid: hasMonth(bed, m), rent: target.rent };
      });
    },

    /* Settle or unsettle a single month, for fixing one mistake. */
    setMonthPaid: function (roomId, bedIndex, month, paid) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }
      if (!isMonth(String(month))) { return { ok: false, error: "Pick a month." }; }

      var changed = paid ? addMonth(bed, month) : dropMonth(bed, month);
      bed.paid = hasMonth(bed, thisMonth());
      if (changed) { save(); }
      return { ok: true, changed: changed };
    },

    /* The catch-up button: every month from the joining date through to the
       date given is marked as taken. Months already settled are left alone,
       so pressing it twice is harmless. */
    markPaidThrough: function (roomId, bedIndex, upto) {
      var target = room(roomId);
      var bed = target && target.beds[bedIndex];
      if (!bed) { return { ok: false, error: "That bed is empty." }; }
      if (!bed.joined) { return { ok: false, error: "Set a joining date on " + (bed.name || "this tenant") + " first." }; }

      var to = clean(upto, 24) || today();
      if (to < bed.joined) {
        return { ok: false, error: "That date is before " + bed.name + " joined." };
      }

      var months = monthsBetween(bed.joined, to);
      if (!months.length) { return { ok: false, error: "There are no months in that range." }; }

      var changed = 0;
      months.forEach(function (m) { if (addMonth(bed, m)) { changed++; } });
      bed.paid = hasMonth(bed, thisMonth());

      if (changed) {
        log("pay",
          changed + (changed === 1 ? " month" : " months") + " settled for " + bed.name,
          "Room " + target.no + " \\u00b7 \\u20b9" + (changed * Number(target.rent || 0)).toLocaleString("en-IN"));
        save();
      }

      return {
        ok: true,
        changed: changed,
        months: months.length,
        from: months[0],
        to: months[months.length - 1]
      };
    },

    /* What is still owed across the whole property, in months and in rupees.
       Rent is read from the room as it stands today, so raising the rent
       raises what an unpaid month is worth — which is what an owner chasing
       arrears actually means. */
    outstanding: function () {
      var months = 0;
      var amount = 0;
      var people = [];

      state.rooms.forEach(function (r) {
        r.beds.forEach(function (bed, i) {
          if (!bed) { return; }

          var from = bed.joined || today();
          var to = billedTo(bed);
          if (to < from) { to = from; }

          var due = monthsBetween(from, to).filter(function (m) {
            return !hasMonth(bed, m);
          });
          if (!due.length) { return; }

          months += due.length;
          amount += due.length * Number(r.rent || 0);
          people.push({
            roomId: r.id,
            roomNo: r.no,
            bedIndex: i,
            bed: bedLabel(i, r.id),
            name: bed.name,
            months: due.length,
            amount: due.length * Number(r.rent || 0),
            oldest: due[0]
          });
        });
      });

      people.sort(function (a, b) { return b.amount - a.amount || b.months - a.months; });
      return { months: months, amount: amount, people: people };
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

      log("out", category + " expense of \\u20b9" + amount.toLocaleString("en-IN"), entry.note || "");
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
        gone.category + " \\u00b7 \\u20b9" + gone.amount.toLocaleString("en-IN"));
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

      if (!label) { return { ok: false, error: "Name the rate, like \\u201c2 sharing\\u201d." }; }
      if (!(amount > 0)) { return { ok: false, error: "Enter an amount above zero." }; }
      if (state.rates.length >= 30) { return { ok: false, error: "That is as many rates as one card holds." }; }

      state.rates.push({
        id: uid(),
        label: label,
        amount: amount,
        note: clean(data.note, 60)
      });
      sortRates(state.rates);

      log("in", "Rate added: " + label, "\\u20b9" + amount.toLocaleString("en-IN") + " per bed");
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
