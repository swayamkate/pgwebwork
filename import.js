/* PG Manager — spreadsheet import.

   Lets the owner bring in a property they already keep in Excel or Google
   Sheets instead of retyping it. Three steps: read the file (or pasted cells),
   show what was understood along with anything questionable, then write it in.
   Nothing is changed until the owner has seen the summary and pressed Import.

   This file is deliberately self-contained. It reads and writes through the
   public PGStore methods and borrows renderAll/commit from app.js if they are
   there, so neither of those files needed changing.

   .xlsx is unzipped in the browser by SheetJS when that library loads; CSV and
   pasted cells are parsed here, so the import still works if the CDN is
   blocked. No spreadsheet ever leaves the browser.
*/
(function (global) {
  "use strict";

  var MAX_BEDS = 8;        // PGStore.addRoom enforces the same ceiling
  var MAX_PREVIEW = 8;
  var MAX_WARNINGS = 12;

  /* ---------- small helpers ---------- */

  function norm(v) {
    if (v instanceof Date) { return iso(v); }
    return String(v == null ? "" : v).trim();
  }

  function key(v) {
    return norm(v).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "\u20b9" + Number(n || 0).toLocaleString("en-IN");
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function bedLabel(i) {
    return "ABCDEFGH".charAt(i) || String(i + 1);
  }

  function pad(v, n) {
    var s = String(v);
    while (s.length < n) { s = "0" + s; }
    return s;
  }

  function iso(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  /* "\u20b9 8,500 /bed" -> 8500 */
  function num(v) {
    if (typeof v === "number") { return isFinite(v) ? v : 0; }
    var s = norm(v).replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  var YES = ["yes", "y", "true", "1", "paid", "done", "received", "cleared",
             "notice", "onnotice", "leaving", "vacating", "\u2713", "\u2714"];

  /* Anything not recognised as a yes is treated as a no, so "Due", "Pending"
     and an empty cell all mean unpaid without needing their own list. */
  function truthy(v) {
    if (typeof v === "boolean") { return v; }
    if (typeof v === "number") { return v > 0; }
    return YES.indexOf(key(v)) !== -1;
  }

  /* Spreadsheets hand dates over as Date objects, serial numbers, or text in
     any number of local formats. Returns "" for blank and null for present but
     unreadable, so the caller can tell the difference and report it. */
  function toDate(v) {
    if (v instanceof Date) { return isNaN(v.getTime()) ? null : iso(v); }
    if (typeof v === "number") {
      // Excel serial day count, offset from 1899-12-30.
      if (v > 20000 && v < 60000) { return iso(new Date(Math.round((v - 25569) * 86400000))); }
      return null;
    }

    var s = norm(v);
    if (!s) { return ""; }

    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) { return m[1] + "-" + pad(m[2], 2) + "-" + pad(m[3], 2); }

    // Day first: the India-facing formats people actually type.
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? "20" + m[3] : m[3];
      return y + "-" + pad(m[2], 2) + "-" + pad(m[1], 2);
    }

    var d = new Date(s);
    return isNaN(d.getTime()) ? null : iso(d);
  }

  /* ---------- reading delimited text ---------- */

  /* Handles quoted fields, doubled quotes inside them, and either line ending. */
  function parseDelimited(text, delim) {
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    var i = 0;

    while (i < text.length) {
      var c = text.charAt(i);

      if (quoted) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += c; i++; continue;
      }

      if (c === '"') { quoted = true; i++; continue; }
      if (c === delim) { row.push(field); field = ""; i++; continue; }

      if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") { i++; }
        row.push(field); rows.push(row); row = []; field = ""; i++; continue;
      }

      field += c; i++;
    }

    row.push(field);
    rows.push(row);

    return withLines(rows);
  }

  /* Blank rows are dropped, but the owner still reads row numbers off their own
     screen, so each surviving row remembers where it actually came from. */
  function withLines(rows) {
    rows.forEach(function (r, i) { r.line = i + 1; });
    return rows.filter(function (r) {
      return r.some(function (cell) { return norm(cell) !== ""; });
    });
  }

  /* Cells copied out of Google Sheets arrive tab separated; a downloaded file
     is usually commas, and a European export may be semicolons. */
  function parseText(text) {
    var sample = text.split(/\r?\n/).slice(0, 5).join("\n");
    var counts = [
      { d: "\t", n: (sample.match(/\t/g) || []).length },
      { d: ",", n: (sample.match(/,/g) || []).length },
      { d: ";", n: (sample.match(/;/g) || []).length }
    ].sort(function (a, b) { return b.n - a.n; });

    return parseDelimited(text, counts[0].n > 0 ? counts[0].d : ",");
  }

  /* ---------- understanding the columns ---------- */

  var FIELDS = {
    room:     { label: "Room",       aliases: ["room", "roomno", "roomnumber", "roomname", "rm", "rooms"] },
    floor:    { label: "Floor",      aliases: ["floor", "flr", "level", "storey"] },
    rent:     { label: "Rent",       aliases: ["rent", "rentperbed", "monthlyrent", "rentamount", "roomrent", "price", "fees", "fee"] },
    bed:      { label: "Bed",        aliases: ["bed", "bedno", "bedletter", "bedname", "bednumber"] },
    tenant:   { label: "Tenant",     aliases: ["tenant", "tenantname", "name", "fullname", "student", "occupant", "person", "boarder", "guest"] },
    phone:    { label: "Phone",      aliases: ["phone", "phoneno", "phonenumber", "mobile", "mobileno", "contact", "contactno", "whatsapp"] },
    joined:   { label: "Joined",     aliases: ["joined", "joiningdate", "joindate", "doj", "dateofjoining", "since", "checkin", "admissiondate"] },
    notice:   { label: "On notice",  aliases: ["onnotice", "notice", "leaving", "vacating", "noticeperiod"] },
    paid:     { label: "Paid",       aliases: ["paid", "rentpaid", "payment", "paymentstatus", "paidstatus", "status"] },
    category: { label: "Category",   aliases: ["category", "head", "expensehead", "particulars", "item", "expense", "type"] },
    amount:   { label: "Amount",     aliases: ["amount", "cost", "value", "spent", "expenseamount", "total"] },
    date:     { label: "Date",       aliases: ["date", "expensedate", "paidon", "billdate"] },
    note:     { label: "Note",       aliases: ["note", "notes", "remark", "remarks", "description", "details", "comment"] }
  };

  var BED_FIELDS = ["room", "floor", "rent", "bed", "tenant", "phone", "joined", "notice", "paid"];
  var EXPENSE_FIELDS = ["date", "category", "amount", "note"];

  function matchField(cell) {
    var k = key(cell);
    if (!k) { return null; }
    for (var f in FIELDS) {
      if (FIELDS[f].aliases.indexOf(k) !== -1) { return f; }
    }
    return null;
  }

  /* Score one row as a candidate header row. */
  function scoreRow(cells) {
    var map = {};
    var hits = 0;
    cells.forEach(function (cell, i) {
      var f = matchField(cell);
      if (f && map[f] === undefined) { map[f] = i; hits++; }
    });
    return { map: map, hits: hits };
  }

  /* The header is rarely row 1. Our own backup sheet puts the property name in
     rows 1-2 and the column names in row 4, and people leave title rows above
     their tables all the time, so the best-scoring of the first ten rows wins. */
  function findHeader(rows) {
    var best = { index: -1, map: {}, hits: 0 };
    var limit = Math.min(rows.length, 10);
    for (var i = 0; i < limit; i++) {
      var r = scoreRow(rows[i]);
      if (r.hits > best.hits) { best = { index: i, map: r.map, hits: r.hits }; }
    }
    return best;
  }

  function detectKind(map) {
    if (map.room !== undefined || map.tenant !== undefined) { return "beds"; }
    if (map.amount !== undefined) { return "expenses"; }
    return "";
  }

  /* "A" -> 0, "Bed C" -> 2, "2" -> 1. Returns -1 when there is nothing usable. */
  function bedIndex(v) {
    var s = norm(v).toUpperCase().replace(/^BED\s*/, "");
    if (!s) { return -1; }
    if (/^[A-H]$/.test(s)) { return s.charCodeAt(0) - 65; }
    var n = parseInt(s, 10);
    if (isFinite(n) && n >= 1 && n <= MAX_BEDS) { return n - 1; }
    return -1;
  }

  /* ---------- turning rows into rooms ---------- */

  function buildBeds(rows, headerIndex, map) {
    var warnings = [];
    var rooms = [];
    var byNo = {};
    var used = 0;

    rows.slice(headerIndex + 1).forEach(function (cells, n) {
      var line = cells.line || headerIndex + n + 2;   // as numbered in the sheet
      var get = function (f) {
        return map[f] === undefined ? "" : cells[map[f]];
      };

      var roomNo = norm(get("room")).slice(0, 12);
      var tenant = norm(get("tenant")).slice(0, 60);

      if (!roomNo && !tenant) { return; }

      if (!roomNo) {
        warn(warnings, "Row " + line + ": no room number, so " + (tenant || "the row") + " was left out.");
        return;
      }

      var rk = roomNo.toLowerCase();
      var room = byNo[rk];
      if (!room) {
        room = { id: uid(), no: roomNo, floor: 0, rent: 0, beds: [], seen: 0, hasFloor: false };
        byNo[rk] = room;
        rooms.push(room);
      }

      var floorRaw = norm(get("floor"));
      if (floorRaw !== "" && !room.hasFloor) {
        room.floor = Math.max(0, Math.round(num(floorRaw)));
        room.hasFloor = true;
      }

      var rent = Math.round(num(get("rent")));
      if (rent > 0) {
        if (room.rent > 0 && room.rent !== rent) {
          warn(warnings, "Room " + roomNo + " has more than one rent in the sheet (" +
            money(room.rent) + " and " + money(rent) + "). Rent is per room here, so " +
            money(room.rent) + " was kept.");
        } else if (room.rent === 0) {
          room.rent = rent;
        }
      }

      var idx = map.bed !== undefined ? bedIndex(get("bed")) : -1;
      if (idx < 0) { idx = room.seen; }
      room.seen++;

      if (idx >= MAX_BEDS) {
        warn(warnings, "Row " + line + ": room " + roomNo + " cannot hold more than " +
          MAX_BEDS + " beds, so this one was left out.");
        return;
      }

      while (room.beds.length <= idx) { room.beds.push(null); }

      if (room.beds[idx]) {
        warn(warnings, "Row " + line + ": room " + roomNo + " bed " + bedLabel(idx) +
          " is listed twice, so " + room.beds[idx].name + " was kept and " +
          (tenant || "the blank row") + " dropped.");
        return;
      }

      if (!tenant) { return; }   // a real row for an empty bed

      var joined = toDate(get("joined"));
      if (joined === null) {
        warn(warnings, "Row " + line + ": could not read the joining date \"" +
          norm(get("joined")) + "\", so it was left blank.");
        joined = "";
      }

      room.beds[idx] = {
        name: tenant,
        phone: norm(get("phone")).slice(0, 24),
        joined: joined,
        onNotice: map.notice !== undefined ? truthy(get("notice")) : false,
        paid: map.paid !== undefined ? truthy(get("paid")) : false
      };
      used++;
    });

    rooms.forEach(function (r) {
      if (!r.beds.length) { r.beds = [null]; }
      delete r.seen;
      delete r.hasFloor;
      if (r.rent === 0) {
        warn(warnings, "Room " + r.no + " has no rent in the sheet, so it was set to \u20b90. " +
          "You can change it later.");
      }
    });

    rooms.sort(function (a, b) {
      return a.floor - b.floor || a.no.localeCompare(b.no, undefined, { numeric: true });
    });

    return { rooms: rooms, warnings: warnings, used: used };
  }

  function buildExpenses(rows, headerIndex, map) {
    var warnings = [];
    var list = [];

    rows.slice(headerIndex + 1).forEach(function (cells, n) {
      var line = cells.line || headerIndex + n + 2;
      var get = function (f) {
        return map[f] === undefined ? "" : cells[map[f]];
      };

      var amount = Math.round(num(get("amount")));
      var category = norm(get("category")).slice(0, 30);
      var note = norm(get("note")).slice(0, 80);

      if (!amount && !category && !note) { return; }

      if (!(amount > 0)) {
        warn(warnings, "Row " + line + ": \"" + (category || note || "this row") +
          "\" has no amount above zero, so it was left out.");
        return;
      }

      var date = toDate(get("date"));
      if (date === null) {
        warn(warnings, "Row " + line + ": could not read the date \"" + norm(get("date")) +
          "\", so today's date was used.");
        date = "";
      }

      list.push({
        id: uid(),
        date: date || iso(new Date()),
        category: category || "Other",
        note: note,
        amount: amount
      });
    });

    return { expenses: list, warnings: warnings, used: list.length };
  }

  function warn(list, text) {
    if (list.length < 200) { list.push(text); }
  }

  /* ---------- the analysis shown before importing ---------- */

  function summariseBeds(rooms) {
    var out = { rooms: rooms.length, beds: 0, tenants: 0, vacant: 0, notice: 0,
                expected: 0, collected: 0, floors: 0 };
    var floors = {};

    rooms.forEach(function (r) {
      floors[r.floor] = true;
      out.beds += r.beds.length;
      r.beds.forEach(function (b) {
        if (!b) { return; }
        out.tenants++;
        out.expected += r.rent;
        if (b.onNotice) { out.notice++; }
        if (b.paid) { out.collected += r.rent; }
      });
    });

    out.vacant = out.beds - out.tenants;
    out.floors = Object.keys(floors).length;
    return out;
  }

  function summariseExpenses(list) {
    var total = 0;
    var cats = {};
    list.forEach(function (x) {
      total += x.amount;
      cats[x.category] = (cats[x.category] || 0) + x.amount;
    });
    var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0] || "";
    return { count: list.length, total: total, top: top, topAmount: top ? cats[top] : 0 };
  }

  /* ---------- writing it into the store ---------- */

  function importBeds(rooms, mode) {
    var current = PGStore.state();
    var next = {
      property: current.property,
      cycle: current.cycle,
      expenses: current.expenses || [],
      activity: current.activity || [],
      rooms: []
    };

    if (mode === "replace") {
      next.rooms = rooms;
      return finish(next, "Imported " + rooms.length + (rooms.length === 1 ? " room" : " rooms") +
        " from a spreadsheet", "Everything that was here before was replaced");
    }

    // Add mode: keep what is here, fill empty beds, append genuinely new rooms.
    var existing = (current.rooms || []).map(function (r) {
      return { id: r.id, no: r.no, floor: r.floor, rent: r.rent, beds: r.beds.slice() };
    });
    var byNo = {};
    existing.forEach(function (r) { byNo[r.no.toLowerCase()] = r; });

    var added = 0;
    var skipped = 0;

    rooms.forEach(function (incoming) {
      var match = byNo[incoming.no.toLowerCase()];

      if (!match) {
        existing.push(incoming);
        byNo[incoming.no.toLowerCase()] = incoming;
        added += incoming.beds.filter(Boolean).length;
        return;
      }

      if (!match.rent && incoming.rent) { match.rent = incoming.rent; }

      incoming.beds.forEach(function (bed, i) {
        if (!bed) { return; }

        var slot = -1;
        if (!match.beds[i]) { slot = i; }
        else {
          for (var j = 0; j < match.beds.length; j++) {
            if (!match.beds[j]) { slot = j; break; }
          }
        }

        if (slot === -1 && match.beds.length < MAX_BEDS) { slot = match.beds.length; }
        if (slot === -1) { skipped++; return; }

        while (match.beds.length <= slot) { match.beds.push(null); }
        match.beds[slot] = bed;
        added++;
      });
    });

    existing.sort(function (a, b) {
      return a.floor - b.floor || String(a.no).localeCompare(String(b.no), undefined, { numeric: true });
    });

    next.rooms = existing;
    return finish(next,
      "Imported " + added + (added === 1 ? " tenant" : " tenants") + " from a spreadsheet",
      skipped ? skipped + " could not be placed, every bed was full" : "Added to what was already here");
  }

  function importExpenses(list, mode) {
    var current = PGStore.state();
    var next = {
      property: current.property,
      cycle: current.cycle,
      rooms: current.rooms || [],
      activity: current.activity || [],
      expenses: mode === "replace" ? list : (current.expenses || []).concat(list)
    };
    return finish(next,
      "Imported " + list.length + (list.length === 1 ? " expense" : " expenses") + " from a spreadsheet",
      mode === "replace" ? "The previous spending log was replaced" : "Added to the spending log");
  }

  /* Record the import in the activity feed, then hand the whole thing to the
     store, which validates every field on the way in. */
  function finish(next, text, meta) {
    next.activity = [{ type: "in", text: text, meta: meta, at: new Date().toISOString() }]
      .concat(next.activity || []).slice(0, 20);
    PGStore.replaceAll(next);
    return { ok: true, text: text };
  }

  /* ---------- dialog ---------- */

  var current = null;   // the sheet being looked at right now

  function el(id) { return document.getElementById(id); }

  function fail(message) {
    var p = el("imp-err");
    if (!p) { return; }
    p.textContent = message;
    p.hidden = false;
  }

  function openImport() {
    current = null;
    var file = el("imp-file");
    if (file) { file.value = ""; }
    var paste = el("imp-paste");
    if (paste) { paste.value = ""; }
    el("imp-err").hidden = true;
    el("imp-step-pick").hidden = false;
    el("imp-step-check").hidden = true;

    var d = el("dlg-import");
    if (d.showModal) { d.showModal(); } else { d.setAttribute("open", ""); }
  }

  function closeImport() {
    var d = el("dlg-import");
    if (d.close) { d.close(); } else { d.removeAttribute("open"); }
  }

  /* Take raw rows and work out everything we want to show. */
  function analyse(rows, sheetName) {
    if (!rows || rows.length < 2) {
      fail("That sheet does not have enough rows to read. It needs a header row and at least one row of data.");
      return;
    }

    var header = findHeader(rows);
    if (header.hits < 2) {
      fail("The column names could not be recognised. The sheet needs a header row with at least a room number and a tenant name, " +
        "or a category and an amount for expenses.");
      return;
    }

    current = {
      rows: rows,
      sheetName: sheetName || "",
      headerIndex: header.index,
      map: header.map,
      kind: detectKind(header.map),
      mode: PGStore.isEmpty() ? "replace" : "add"
    };

    if (!current.kind) {
      fail("That sheet was read, but it does not look like rooms and tenants or a list of expenses.");
      current = null;
      return;
    }

    el("imp-step-pick").hidden = true;
    el("imp-step-check").hidden = false;
    review();
  }

  /* Rebuild the result from the current column mapping and redraw the review. */
  function review() {
    var c = current;
    var built = c.kind === "beds"
      ? buildBeds(c.rows, c.headerIndex, c.map)
      : buildExpenses(c.rows, c.headerIndex, c.map);

    c.built = built;

    el("imp-summary").innerHTML = summaryHtml(c, built);
    el("imp-mapping").innerHTML = mappingHtml(c);
    el("imp-preview").innerHTML = previewHtml(c, built);
    el("imp-warnings").innerHTML = warningsHtml(built.warnings);
    el("imp-mode").innerHTML = modeHtml(c, built);

    var apply = el("imp-apply");
    apply.disabled = !built.used;
    apply.textContent = built.used
      ? (c.kind === "beds" ? "Import " + built.rooms.length + " rooms" : "Import " + built.used + " expenses")
      : "Nothing to import";
  }

  function chip(label, value) {
    return '<div class="imp-chip"><b>' + esc(String(value)) + "</b><span>" + esc(label) + "</span></div>";
  }

  function summaryHtml(c, built) {
    var where = c.sheetName ? "Sheet \u201c" + esc(c.sheetName) + "\u201d" : "Pasted cells";
    var read = c.rows.length - c.headerIndex - 1;
    var chips;

    if (c.kind === "beds") {
      var s = summariseBeds(built.rooms);
      chips = chip("rooms", s.rooms) + chip("beds", s.beds) + chip("tenants", s.tenants) +
        chip("vacant", s.vacant) + chip("rent a month", money(s.expected)) +
        chip("already paid", money(s.collected));
    } else {
      var e = summariseExpenses(built.expenses);
      chips = chip("expenses", e.count) + chip("total", money(e.total)) +
        chip("biggest", e.top || "\u2014") + chip("of which", money(e.topAmount));
    }

    var headerLine = (c.rows[c.headerIndex] && c.rows[c.headerIndex].line) || c.headerIndex + 1;

    return '<p class="imp-lead">' + where + " \u00b7 " + read + (read === 1 ? " row" : " rows") +
      " read \u00b7 column names found on row " + headerLine + ".</p>" +
      '<div class="imp-chips">' + chips + "</div>";
  }

  /* Every guess is editable, because one wrong column should not mean giving up
     and typing the whole property in by hand. */
  function mappingHtml(c) {
    var wanted = c.kind === "beds" ? BED_FIELDS : EXPENSE_FIELDS;
    var headerCells = c.rows[c.headerIndex] || [];

    var options = function (selected) {
      var out = '<option value="">\u2014 not in the sheet \u2014</option>';
      headerCells.forEach(function (cell, i) {
        var name = norm(cell) || "Column " + (i + 1);
        out += '<option value="' + i + '"' + (selected === i ? " selected" : "") + ">" +
          esc(name) + "</option>";
      });
      return out;
    };

    return "<details class=\"imp-map\"><summary>Columns we matched \u2014 change any that look wrong</summary><div class=\"imp-map-grid\">" +
      wanted.map(function (f) {
        return '<label class="imp-map-row"><span>' + esc(FIELDS[f].label) + "</span>" +
          '<select data-imp-field="' + f + '">' + options(c.map[f]) + "</select></label>";
      }).join("") +
      "</div></details>";
  }

  function previewHtml(c, built) {
    var head, body;

    if (c.kind === "beds") {
      var flat = [];
      built.rooms.forEach(function (r) {
        r.beds.forEach(function (b, i) {
          flat.push({ room: r.no, bed: bedLabel(i), rent: r.rent, bedObj: b });
        });
      });

      head = "<tr><th>Room</th><th>Bed</th><th>Tenant</th><th>Phone</th><th>Joined</th><th>Rent</th><th>Paid</th></tr>";
      body = flat.slice(0, MAX_PREVIEW).map(function (x) {
        var b = x.bedObj;
        return "<tr><td>" + esc(x.room) + "</td><td>" + x.bed + "</td><td>" +
          (b ? esc(b.name) : '<i class="imp-dim">vacant</i>') + "</td><td>" +
          (b && b.phone ? esc(b.phone) : "\u2014") + "</td><td>" +
          (b && b.joined ? esc(b.joined) : "\u2014") + "</td><td>" + money(x.rent) + "</td><td>" +
          (b && b.paid ? "Yes" : "No") + "</td></tr>";
      }).join("");

      return table(head, body, flat.length);
    }

    head = "<tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr>";
    body = built.expenses.slice(0, MAX_PREVIEW).map(function (x) {
      return "<tr><td>" + esc(x.date) + "</td><td>" + esc(x.category) + "</td><td>" +
        (x.note ? esc(x.note) : "\u2014") + "</td><td>" + money(x.amount) + "</td></tr>";
    }).join("");

    return table(head, body, built.expenses.length);
  }

  function table(head, body, total) {
    if (!body) {
      return '<p class="imp-none">Nothing usable was found in these columns.</p>';
    }
    var more = total > MAX_PREVIEW
      ? '<p class="imp-more">and ' + (total - MAX_PREVIEW) + " more\u2026</p>"
      : "";
    return '<div class="imp-preview"><table class="imp-table"><thead>' + head +
      "</thead><tbody>" + body + "</tbody></table></div>" + more;
  }

  function warningsHtml(list) {
    if (!list.length) {
      return '<p class="imp-clean">Every row was read cleanly.</p>';
    }
    var shown = list.slice(0, MAX_WARNINGS);
    var rest = list.length - shown.length;
    return '<div class="imp-warn"><b>' + list.length +
      (list.length === 1 ? " thing to check" : " things to check") + "</b><ul>" +
      shown.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") +
      (rest ? "<li>and " + rest + " more\u2026</li>" : "") +
      "</ul></div>";
  }

  function modeHtml(c, built) {
    var empty = PGStore.isEmpty() && !(PGStore.state().expenses || []).length;
    if (empty) {
      return '<p class="imp-note">This account is empty, so everything above will simply be added.</p>';
    }

    var thing = c.kind === "beds" ? "rooms and tenants" : "expenses";
    return '<div class="imp-mode">' +
      '<label><input type="radio" name="imp-mode" value="add"' +
      (c.mode === "add" ? " checked" : "") + " /><span><b>Add to what is here</b>" +
      "Keeps your current " + thing + " and fills in the rest.</span></label>" +
      '<label><input type="radio" name="imp-mode" value="replace"' +
      (c.mode === "replace" ? " checked" : "") + " /><span><b>Replace them</b>" +
      "Throws away the " + thing + " on this account first.</span></label>" +
      "</div>";
  }

  /* ---------- reading a chosen file ---------- */

  function readFile(file) {
    var name = String(file.name || "").toLowerCase();
    var isExcel = /\.xlsx?$/.test(name);
    var reader = new FileReader();

    reader.onerror = function () { fail("That file could not be opened."); };

    reader.onload = function () {
      try {
        if (!isExcel) {
          analyse(parseText(String(reader.result)), file.name);
          return;
        }

        if (!global.XLSX) {
          fail("The Excel reader did not load, so .xlsx cannot be opened right now. " +
            "In Excel or Google Sheets use File \u2192 Download \u2192 CSV, or just copy the cells and paste them below.");
          return;
        }

        var wb = XLSX.read(new Uint8Array(reader.result), { type: "array", cellDates: true });
        var pick = bestSheet(wb);
        if (!pick) {
          fail("That workbook has no readable sheets.");
          return;
        }
        analyse(pick.rows, pick.name);
      } catch (err) {
        fail("That file could not be read as a spreadsheet. If it is an .xls from an old Excel, save it as .xlsx or CSV first.");
      }
    };

    if (isExcel) { reader.readAsArrayBuffer(file); } else { reader.readAsText(file); }
  }

  /* A workbook often has several tabs; take the one whose header we understand
     best rather than assuming the first. */
  function bestSheet(wb) {
    var best = null;
    wb.SheetNames.forEach(function (name) {
      // Blank rows are kept here only so withLines can number them, then dropped.
      var rows = withLines(XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1, raw: true, blankrows: true, defval: ""
      }));
      if (!rows.length) { return; }
      var score = findHeader(rows).hits;
      if (!best || score > best.score) { best = { name: name, rows: rows, score: score }; }
    });
    return best;
  }

  /* ---------- wiring ---------- */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) { return; }
    var act = btn.dataset.act;

    if (act === "import-data") {
      openImport();
      return;
    }

    if (act === "imp-read") {
      el("imp-err").hidden = true;
      var file = el("imp-file").files[0];
      var pasted = String(el("imp-paste").value || "").trim();

      if (file) { readFile(file); }
      else if (pasted) { analyse(parseText(pasted), ""); }
      else { fail("Choose a file, or paste the cells copied from your sheet."); }
      return;
    }

    if (act === "imp-back") {
      el("imp-step-check").hidden = true;
      el("imp-step-pick").hidden = false;
      return;
    }

    if (act === "imp-apply") {
      if (!current || !current.built || !current.built.used) { return; }

      var res = current.kind === "beds"
        ? importBeds(current.built.rooms, current.mode)
        : importExpenses(current.built.expenses, current.mode);

      closeImport();
      current = null;

      // Redraw and let the sheet backup pick the change up, falling back to a
      // reload if the dashboard script is not there for some reason.
      if (typeof commit === "function") { commit(); }
      else if (typeof renderAll === "function") { renderAll(); }
      else { location.reload(); }

      if (res && res.text) { location.hash = "dashboard"; }
    }
  });

  /* Column remapping and the add/replace choice both just redraw the review. */
  document.addEventListener("change", function (e) {
    var target = e.target;

    if (target.matches("[data-imp-field]")) {
      if (!current) { return; }
      var field = target.getAttribute("data-imp-field");
      var value = target.value;
      if (value === "") { delete current.map[field]; }
      else { current.map[field] = Number(value); }
      review();
      return;
    }

    if (target.name === "imp-mode" && current) {
      current.mode = target.value;
    }
  });

  /* Dropping a file straight onto the panel. */
  document.addEventListener("dragover", function (e) {
    var drop = e.target.closest && e.target.closest(".imp-drop");
    if (drop) { e.preventDefault(); drop.classList.add("is-over"); }
  });

  document.addEventListener("dragleave", function (e) {
    var drop = e.target.closest && e.target.closest(".imp-drop");
    if (drop) { drop.classList.remove("is-over"); }
  });

  document.addEventListener("drop", function (e) {
    var drop = e.target.closest && e.target.closest(".imp-drop");
    if (!drop) { return; }
    e.preventDefault();
    drop.classList.remove("is-over");
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) { el("imp-err").hidden = true; readFile(file); }
  });

  /* Exported for testing and for anything else that wants to reuse the parser.
     The html builders are here so the review panel can be rendered outside a
     browser and checked, rather than being eyeballed only in the real app. */
  global.PGImport = {
    open: openImport,
    summaryHtml: summaryHtml,
    mappingHtml: mappingHtml,
    previewHtml: previewHtml,
    warningsHtml: warningsHtml,
    modeHtml: modeHtml,
    parseText: parseText,
    findHeader: findHeader,
    detectKind: detectKind,
    buildBeds: buildBeds,
    buildExpenses: buildExpenses,
    summariseBeds: summariseBeds,
    summariseExpenses: summariseExpenses,
    toDate: toDate
  };
})(window);
