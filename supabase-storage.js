/* PG Manager — Supabase data storage.

   Replaces localStorage as the primary data store. Every room, bed, and
   expense row lives in Supabase with Row Level Security, so data syncs
   across devices and never leaves the signed-in account.

   Falls back to localStorage when Supabase is unreachable, so the app
   still works offline.
*/
(function (global) {
  "use strict";

  var cfg = global.PG_CONFIG || {};
  var client = null;
  var accountId = null;

  /* ---- helpers ---- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function clean(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 60);
  }

  function day(value) {
    var n = Math.floor(Number(value));
    return (n >= 1 && n <= 31) ? n : 0;
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  }

  function isMonth(v) {
    return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function cycleId() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1);
  }

  function thisMonth() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }

  function ym(value) {
    var text = String(value == null ? "" : value);
    var m = /^(\d{4})-(\d{2})/.exec(text);
    if (m) { return { y: Number(m[1]), m: Number(m[2]) - 1 }; }
    var d = new Date(text);
    if (isNaN(d.getTime())) { return null; }
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function monthKey(value) {
    if (value) {
      var p = ym(value);
      if (p) { return p.y + "-" + pad2(p.m + 1); }
    }
    return thisMonth();
  }

  function cycleMonth(cycle) {
    var bits = String(cycle || "").split("-");
    var y = Number(bits[0]);
    var m = Number(bits[1]);
    if (y > 1970 && m >= 1 && m <= 12) { return y + "-" + pad2(m); }
    return thisMonth();
  }

  /* ---- Supabase client ---- */

  function getClient() {
    if (client) { return client; }
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { return null; }
    try {
      client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } catch (e) {
      client = null;
    }
    return client;
  }

  function getUser() {
    var c = getClient();
    if (!c) { return null; }
    /* Supabase v2: session is fetched asynchronously. For sync callers,
       return null and let them use getUserAsync instead. */
    return null;
  }

  /* ---- CRUD: rooms ---- */

  async function fetchRooms() {
    var c = getClient();
    if (!c || !accountId) { return []; }
    var res = await c.from("rooms").select("*").eq("account_id", accountId).order("floor").order("no");
    return res.data || [];
  }

  async function upsertRooms(rows) {
    var c = getClient();
    if (!c || !accountId || !rows.length) { return; }
    var toSave = rows.map(function (r) {
      return { id: r.id, account_id: accountId, no: r.no, floor: r.floor || 0, rent: r.rent || 0 };
    });
    await c.from("rooms").upsert(toSave, { onConflict: "id" });
  }

  async function deleteRooms(ids) {
    var c = getClient();
    if (!c || !ids.length) { return; }
    await c.from("rooms").delete().in("id", ids);
  }

  /* ---- CRUD: beds ---- */

  async function fetchBeds() {
    var c = getClient();
    if (!c || !accountId) { return []; }
    var res = await c.from("beds").select("*").eq("account_id", accountId).order("bed_index");
    return res.data || [];
  }

  async function upsertBeds(rows) {
    var c = getClient();
    if (!c || !accountId || !rows.length) { return; }
    var toSave = rows.map(function (b) {
      return {
        id: b.id,
        room_id: b.room_id,
        account_id: accountId,
        bed_index: b.bed_index,
        name: b.name || null,
        phone: b.phone || null,
        joined: b.joined || null,
        leaving: b.leaving || null,
        note: b.note || "",
        collect: b.collect || 0,
        rent: b.rent != null ? b.rent : null,
        deposit: b.deposit || 0,
        id_type: b.id_type || "",
        id_number: b.id_number || "",
        emergency_contact: b.emergency_contact || "",
        workplace: b.workplace || "",
        on_notice: b.on_notice || false,
        paid_months: b.paid_months || []
      };
    });
    await c.from("beds").upsert(toSave, { onConflict: "id" });
  }

  async function deleteBeds(ids) {
    var c = getClient();
    if (!c || !ids.length) { return; }
    await c.from("beds").delete().in("id", ids);
  }

  /* ---- CRUD: expenses ---- */

  async function fetchExpenses() {
    var c = getClient();
    if (!c || !accountId) { return []; }
    var res = await c.from("expenses").select("*").eq("account_id", accountId).order("date", { ascending: false });
    return res.data || [];
  }

  async function upsertExpenses(rows) {
    var c = getClient();
    if (!c || !accountId || !rows.length) { return; }
    var toSave = rows.map(function (x) {
      return {
        id: x.id,
        account_id: accountId,
        date: x.date || today(),
        category: x.category || "Other",
        note: x.note || "",
        amount: x.amount || 0
      };
    });
    await c.from("expenses").upsert(toSave, { onConflict: "id" });
  }

  async function deleteExpenses(ids) {
    var c = getClient();
    if (!c || !ids.length) { return; }
    await c.from("expenses").delete().in("id", ids);
  }

  /* ---- high-level: load full state ---- */

  async function loadFull() {
    var rooms, beds, expenses;
    try { rooms = await fetchRooms(); } catch (e) { rooms = []; }
    try { beds = await fetchBeds(); } catch (e) { beds = []; }
    try { expenses = await fetchExpenses(); } catch (e) { expenses = []; }

    /* Rebuild the nested structure the app expects. */
    var roomsById = {};
    rooms.forEach(function (r) {
      roomsById[r.id] = {
        id: r.id,
        no: r.no,
        floor: r.floor,
        rent: r.rent,
        beds: []
      };
    });

    beds.forEach(function (b) {
      var room = roomsById[b.room_id];
      if (!room) { return; }
      while (room.beds.length <= b.bed_index) { room.beds.push(null); }

      var months = (b.paid_months || []).filter(isMonth).sort();
      var seed = cycleMonth(cycleId());
      if (!months.length && b.paid) { months = [seed]; }

      room.beds[b.bed_index] = {
        name: b.name || "",
        phone: b.phone || "",
        joined: b.joined || "",
        leaving: b.leaving || "",
        note: b.note || "",
        collect: b.collect || 0,
        rent: b.rent,
        deposit: b.deposit || 0,
        idType: b.id_type || "",
        idNumber: b.id_number || "",
        emergencyContact: b.emergency_contact || "",
        workplace: b.workplace || "",
        onNotice: b.on_notice || false,
        paidMonths: months,
        paid: months.indexOf(thisMonth()) !== -1
      };
    });

    var roomList = Object.values(roomsById);
    roomList.sort(function (a, b) {
      return a.floor - b.floor || String(a.no).localeCompare(String(b.no), undefined, { numeric: true });
    });

    return { rooms: roomList, expenses: expenses };
  }

  /* ---- high-level: save full state ---- */

  async function saveFull(state) {
    if (!accountId) { return; }

    var incomingRoomIds = {};
    var bedRows = [];
    var roomRows = [];

    (state.rooms || []).forEach(function (room) {
      incomingRoomIds[room.id] = true;
      roomRows.push({ id: room.id, no: room.no, floor: room.floor, rent: room.rent });

      (room.beds || []).forEach(function (bed, i) {
        if (!bed) { return; }
        bedRows.push({
          id: bed._dbId || (room.id + "-b" + i),
          room_id: room.id,
          bed_index: i,
          name: bed.name || "",
          phone: bed.phone || "",
          joined: bed.joined || "",
          leaving: bed.leaving || "",
          note: bed.note || "",
          collect: bed.collect || 0,
          rent: bed.rent != null ? bed.rent : null,
          deposit: bed.deposit || 0,
          id_type: bed.idType || "",
          id_number: bed.idNumber || "",
          emergency_contact: bed.emergencyContact || "",
          workplace: bed.workplace || "",
          on_notice: bed.onNotice || false,
          paid_months: bed.paidMonths || []
        });
      });
    });

    var expenseRows = (state.expenses || []).map(function (x) {
      return { id: x.id, date: x.date, category: x.category, note: x.note, amount: x.amount };
    });

    /* Upsert all current data. Each call is wrapped so a missing table
       never kills the entire save — the rest of the data still lands. */
    try { if (roomRows.length) { await upsertRooms(roomRows); } } catch (e) { console.warn('Supabase rooms save failed:', e); }
    try { if (bedRows.length) { await upsertBeds(bedRows); } } catch (e) { console.warn('Supabase beds save failed:', e); }
    try { if (expenseRows.length) { await upsertExpenses(expenseRows); } } catch (e) { console.warn('Supabase expenses save failed:', e); }

    /* Delete rows that were removed in the app. */
    try {
      var c = getClient();
      if (c) {
        var existingRooms = await c.from("rooms").select("id").eq("account_id", accountId);
        var toDeleteRooms = (existingRooms.data || [])
          .map(function (r) { return r.id; })
          .filter(function (id) { return !incomingRoomIds[id]; });
        if (toDeleteRooms.length) {
          await c.from("beds").delete().in("room_id", toDeleteRooms);
          await c.from("rooms").delete().in("id", toDeleteRooms);
        }
      }
    } catch (e) { /* best-effort cleanup */ }
  }

  /* ---- public API ---- */

  var SupabaseStorage = {
    init: function (aid) {
      accountId = aid || null;
      return !!getClient();
    },

    isAvailable: function () { return !!getClient() && !!accountId; },

    load: loadFull,
    save: saveFull,

    /* Individual operations for the import to call. */
    upsertRooms: upsertRooms,
    upsertBeds: upsertBeds,
    upsertExpenses: upsertExpenses,
    deleteRooms: deleteRooms,
    deleteBeds: deleteBeds,
    deleteExpenses: deleteExpenses,

    fetchRooms: fetchRooms,
    fetchBeds: fetchBeds,
    fetchExpenses: fetchExpenses
  };

  global.SupabaseStorage = SupabaseStorage;
})(window);
