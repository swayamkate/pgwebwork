/* PG Manager — dashboard.

   No sample data lives in this file. Everything on screen comes from PGStore,
   which starts empty for every account and is filled in through the UI.
*/

/* ---------- helpers ---------- */

const el = (id) => document.getElementById(id);
const money = (n) => "\u20b9" + Number(n || 0).toLocaleString("en-IN");
const BADGE = { paid: "Paid", due: "Due", late: "Overdue" };

const initials = (name) =>
  String(name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/* Tenant names and phone numbers are typed by the user, so everything that
   reaches innerHTML goes through this first. */
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function prettyDate(value) {
  if (!value) { return "\u2014"; }
  const d = new Date(value);
  if (isNaN(d.getTime())) { return esc(value); }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function sinceLabel(iso) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) { return ""; }
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) { return "just now"; }
  if (mins < 60) { return mins + " min ago"; }
  const hrs = Math.round(mins / 60);
  if (hrs < 24) { return hrs + (hrs === 1 ? " hour ago" : " hours ago"); }
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : days + " days ago";
}

/* Unpaid becomes "Overdue" once we are past the 10th of the month. */
function bedStatus(bed) {
  if (bed.paid) { return "paid"; }
  return new Date().getDate() > 10 ? "late" : "due";
}

function tenants() {
  const out = [];
  PGStore.state().rooms.forEach((room) => {
    room.beds.forEach((bed, i) => {
      if (!bed) { return; }
      out.push({
        name: bed.name,
        phone: bed.phone,
        joined: bed.joined,
        onNotice: bed.onNotice,
        paid: bed.paid,
        status: bedStatus(bed),
        roomId: room.id,
        roomNo: room.no,
        bedIndex: i,
        bed: PGStore.bedLabel(i, room.id),
        rent: room.rent
      });
    });
  });
  return out;
}

function totals() {
  const rooms = PGStore.state().rooms;
  const list = tenants();
  const beds = rooms.reduce((s, r) => s + r.beds.length, 0);
  const expected = list.reduce((s, t) => s + t.rent, 0);
  const collected = list.filter((t) => t.paid).reduce((s, t) => s + t.rent, 0);
  return {
    rooms: rooms.length,
    beds,
    occupied: list.length,
    vacant: beds - list.length,
    onNotice: list.filter((t) => t.onNotice).length,
    expected,
    collected,
    pending: expected - collected,
    rate: beds ? Math.round((list.length / beds) * 100) : 0
  };
}

const ICONS = {
  bed: '<path d="M4 18v-8"/><path d="M4 14h16v4"/><path d="M20 14v-1.5a2 2 0 0 0-2-2h-7V14"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 4.8"/><path d="M18.5 19a5.6 5.6 0 0 0-2-4"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="14" cy="12" r=".6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h11v3"/><rect x="3" y="7" width="18" height="12" rx="2.5"/><circle cx="16.5" cy="13" r="1"/>',
  rupee: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8h5"/><path d="M9.5 10.5h5"/><path d="M13 10.5a2.5 2.5 0 0 1-2.5 2.5H9.5l4 4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  receipt: '<path d="M6 3.5h12v17l-2.5-1.5-2.5 1.5-2.5-1.5L8 20.5 6 20.5Z"/><path d="M9.5 8.5h5"/><path d="M9.5 12h5"/>',
  chart: '<path d="M4.5 20V11"/><path d="M10 20V4.5"/><path d="M15.5 20v-6"/><path d="M20.5 20V8"/>'
};

/* ---------- expenses ---------- */

const EXPENSE_CATS = [
  "Electricity", "Water", "Staff salary", "Groceries",
  "Maintenance", "Internet", "Gas", "Rent to owner", "Other"
];

/* yyyy-mm for the month we are in, to match against an expense date. */
function monthKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function expenseSummary() {
  const list = PGStore.state().expenses || [];
  const mk = monthKey();
  const month = list.filter((x) => String(x.date).slice(0, 7) === mk);
  const byCat = {};
  month.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const top = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0] || "";
  return {
    list,
    month,
    monthTotal: month.reduce((s, x) => s + x.amount, 0),
    allTotal: list.reduce((s, x) => s + x.amount, 0),
    top,
    topAmount: top ? byCat[top] : 0
  };
}

/* money() has no sign handling, so negatives are built by hand. */
function signedMoney(n) {
  return (n < 0 ? "\u2212" : "") + money(Math.abs(n));
}

function statCard(s) {
  return `
    <div class="stat">
      <div class="stat-top">
        <span class="stat-label">${s.label}</span>
        <span class="stat-ico ico-${s.tone}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[s.icon]}</svg>
        </span>
      </div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-note ${s.cls || ""}">${s.note}</div>
    </div>`;
}

function emptyState(title, note, action) {
  return `
    <div class="empty">
      <span class="empty-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS.bed}</svg>
      </span>
      <b>${title}</b>
      <p>${note}</p>
      ${action || ""}
    </div>`;
}

/* ---------- render ---------- */

function renderStats() {
  const t = totals();
  el("stats").innerHTML = [
    { label: "Total beds", value: t.beds, note: t.rooms === 1 ? "1 room" : t.rooms + " rooms", icon: "bed", tone: "brand" },
    { label: "Occupied", value: t.occupied, note: t.beds ? t.rate + "% occupancy" : "No beds yet", cls: "up", icon: "users", tone: "green" },
    { label: "Vacant", value: t.vacant, note: t.onNotice + " on notice", cls: "warn", icon: "door", tone: "amber" },
    { label: "Collected", value: money(t.collected), note: money(t.pending) + " pending", cls: "warn", icon: "wallet", tone: "brand" }
  ].map(statCard).join("");
}

function occBar(name, filled, total) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return `
    <div>
      <div class="bar-row-top"><span>${esc(name)}</span><b>${filled}/${total} · ${pct}%</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

/* An owner with floors switched off gets the same bars counted by room. */
function renderFloors() {
  const state = PGStore.state();
  const rooms = state.rooms;
  const t = totals();
  const useFloors = state.settings.floors !== false;

  el("occ-head").textContent = useFloors ? "Occupancy by floor" : "Occupancy by room";
  el("occ-total").textContent = t.beds ? t.occupied + " of " + t.beds + " beds filled" : "";

  if (!rooms.length) {
    el("floor-bars").innerHTML = '<p class="muted-sm">Add a room to see occupancy here.</p>';
    return;
  }

  if (!useFloors) {
    el("floor-bars").innerHTML = rooms
      .map((r) => occBar("Room " + r.no, r.beds.filter(Boolean).length, r.beds.length))
      .join("");
    return;
  }

  const floors = [];
  rooms.forEach((r) => { if (floors.indexOf(r.floor) === -1) { floors.push(r.floor); } });
  floors.sort((a, b) => a - b);

  el("floor-bars").innerHTML = floors.map((f) => {
    const on = rooms.filter((r) => r.floor === f);
    const total = on.reduce((sum, r) => sum + r.beds.length, 0);
    const filled = on.reduce((sum, r) => sum + r.beds.filter(Boolean).length, 0);
    return occBar("Floor " + f, filled, total);
  }).join("");
}

function renderFeed() {
  const items = PGStore.state().activity;
  const glyph = { pay: "\u20b9", in: "\u2192", out: "\u2190" };

  if (!items.length) {
    el("feed").innerHTML = '<li class="feed-blank">Nothing yet. Adding rooms, tenants and payments will show up here.</li>';
    return;
  }

  el("feed").innerHTML = items.map((a) => {
    const meta = [a.meta, sinceLabel(a.at)].filter(Boolean).join(" · ");
    return `
    <li>
      <span class="ico ico-${esc(a.type)}" aria-hidden="true">${glyph[a.type] || "\u2022"}</span>
      <span class="feed-body">${esc(a.text)}<span>${esc(meta)}</span></span>
    </li>`;
  }).join("");
}

function renderRooms() {
  const rooms = PGStore.state().rooms;

  if (!rooms.length) {
    el("rooms").innerHTML = emptyState(
      "No rooms yet",
      "Add your first room and the beds inside it. Everything else builds on this.",
      '<button class="btn-primary btn-sm" data-act="add-room" type="button">Add a room</button>'
    );
    return;
  }

  el("rooms").innerHTML = rooms.map((room) => {
    const filled = room.beds.filter(Boolean).length;

    const beds = room.beds.map((bed, i) => {
      const label = PGStore.bedLabel(i, room.id);
      if (!bed) {
        return `<button class="bed bed-add" type="button" data-act="fill-bed" data-room="${esc(room.id)}" data-bed="${i}">
          <b>Bed ${label}</b><span>+ Add tenant</span>
        </button>`;
      }
      const cls = bed.onNotice ? "bed bed-notice" : "bed bed-occupied";
      return `<button class="${cls}" type="button" data-act="profile" data-room="${esc(room.id)}" data-bed="${i}">
        <b>Bed ${label}</b><span>${esc(bed.name)}</span>
      </button>`;
    }).join("");

    return `
      <div class="room">
        <div class="room-head">
          <b>Room ${esc(room.no)}</b>
          <span class="room-head-right">
            <span class="muted-sm">${filled}/${room.beds.length} · ${money(room.rent)}</span>
            <button class="x-btn" type="button" data-act="del-room" data-room="${esc(room.id)}" title="Remove room ${esc(room.no)}" aria-label="Remove room ${esc(room.no)}">×</button>
          </span>
        </div>
        <div class="room-beds">${beds}</div>
      </div>`;
  }).join("");
}

function renderTenants() {
  const list = tenants();
  const table = document.querySelector(".table-card");
  const blank = el("tenants-empty");

  if (!list.length) {
    table.hidden = true;
    el("tenant-cards").innerHTML = "";
    blank.hidden = false;
    blank.innerHTML = emptyState(
      "No tenants yet",
      PGStore.isEmpty()
        ? "Add a room first, then move tenants into its beds."
        : "Move someone into a vacant bed to see them listed here.",
      PGStore.isEmpty()
        ? '<button class="btn-primary btn-sm" data-act="add-room" type="button">Add a room</button>'
        : '<button class="btn-primary btn-sm" data-act="add-tenant" type="button">Add a tenant</button>'
    );
    return;
  }

  table.hidden = false;
  blank.hidden = true;
  blank.innerHTML = "";

  const actions = (t) => `
    <button class="link-btn" type="button" data-act="profile" data-room="${esc(t.roomId)}" data-bed="${t.bedIndex}">Profile</button>
    <button class="link-btn" type="button" data-act="notice" data-room="${esc(t.roomId)}" data-bed="${t.bedIndex}">${t.onNotice ? "Cancel notice" : "On notice"}</button>
    <button class="link-btn link-danger" type="button" data-act="checkout" data-room="${esc(t.roomId)}" data-bed="${t.bedIndex}">Check out</button>`;

  el("tenant-rows").innerHTML = list.map((t) => `
    <tr>
      <td><button class="who who-btn" type="button" data-act="profile" data-room="${esc(t.roomId)}" data-bed="${t.bedIndex}"><span class="av">${esc(initials(t.name))}</span><span class="who-name">${esc(t.name)}</span>${t.onNotice ? ' <span class="tag-notice">notice</span>' : ""}</button></td>
      <td class="mono">${esc(t.roomNo)} · ${t.bed}</td>
      <td class="mono">${esc(t.phone) || "\u2014"}</td>
      <td>${prettyDate(t.joined)}</td>
      <td class="mono">${money(t.rent)}</td>
      <td><span class="badge badge-${t.status}">${BADGE[t.status]}</span></td>
      <td class="row-actions">${actions(t)}</td>
    </tr>`).join("");

  el("tenant-cards").innerHTML = list.map((t) => `
    <div class="tcard">
      <div class="tcard-top">
        <button class="who who-btn" type="button" data-act="profile" data-room="${esc(t.roomId)}" data-bed="${t.bedIndex}"><span class="av">${esc(initials(t.name))}</span><span class="who-name">${esc(t.name)}</span></button>
        <span class="badge badge-${t.status}">${BADGE[t.status]}</span>
      </div>
      <div class="tcard-grid">
        <div><b>Bed</b>${esc(t.roomNo)} · ${t.bed}</div>
        <div><b>Rent</b>${money(t.rent)}</div>
        <div><b>Phone</b>${esc(t.phone) || "\u2014"}</div>
        <div><b>Joined</b>${prettyDate(t.joined)}</div>
      </div>
      <div class="row-actions">${actions(t)}</div>
    </div>`).join("");
}

function renderRent() {
  const list = tenants();
  const t = totals();
  const paid = list.filter((x) => x.paid).length;

  el("rent-title").textContent =
    "Rent \u2014 " + new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  el("rent-stats").innerHTML = [
    { label: "Expected", value: money(t.expected), note: list.length === 1 ? "1 tenant" : list.length + " tenants", icon: "rupee", tone: "brand" },
    { label: "Collected", value: money(t.collected), note: paid + (paid === 1 ? " payment received" : " payments received"), cls: "up", icon: "wallet", tone: "green" },
    { label: "Pending", value: money(t.pending), note: (list.length - paid) + " still to pay", cls: "warn", icon: "clock", tone: "red" }
  ].map(statCard).join("");

  if (!list.length) {
    el("paylist").innerHTML = '<li class="feed-blank">Rent appears here once tenants move in.</li>';
    return;
  }

  const order = { late: 0, due: 1, paid: 2 };
  el("paylist").innerHTML = list
    .slice()
    .sort((a, b) => order[a.status] - order[b.status])
    .map((x) => `
      <li>
        <span class="pay-left">
          <span class="av">${esc(initials(x.name))}</span>
          <span class="pay-name">${esc(x.name)}<span>Room ${esc(x.roomNo)} · Bed ${x.bed}</span></span>
        </span>
        <span class="pay-right">
          <span class="amount">${money(x.rent)}</span>
          <span class="badge badge-${x.status}">${BADGE[x.status]}</span>
          <button class="link-btn" type="button" data-act="pay" data-room="${esc(x.roomId)}" data-bed="${x.bedIndex}" data-paid="${x.paid ? "0" : "1"}">${x.paid ? "Undo" : "Mark paid"}</button>
        </span>
      </li>`).join("");
}

function renderExpenses() {
  const x = expenseSummary();
  const t = totals();
  const net = t.collected - x.monthTotal;

  el("exp-title").textContent =
    "Expenses \u2014 " + new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  el("exp-count").textContent = x.list.length
    ? (x.list.length === 1 ? "1 entry" : x.list.length + " entries")
    : "";

  el("exp-stats").innerHTML = [
    {
      label: "Spent this month", value: money(x.monthTotal),
      note: x.month.length === 1 ? "1 entry" : x.month.length + " entries",
      cls: "warn", icon: "receipt", tone: "amber"
    },
    {
      label: "Biggest cost", value: x.top ? esc(x.top) : "\u2014",
      note: x.top ? money(x.topAmount) + " this month" : "Nothing logged yet",
      icon: "chart", tone: "brand"
    },
    {
      label: "Net this month", value: signedMoney(net),
      note: money(t.collected) + " rent collected",
      cls: net < 0 ? "warn" : "up", icon: "wallet", tone: net < 0 ? "red" : "green"
    }
  ].map(statCard).join("");

  if (!x.list.length) {
    el("exp-list").innerHTML =
      '<li class="feed-blank">Nothing logged yet. Add electricity, water, staff pay and anything else the property costs you.</li>';
    return;
  }

  el("exp-list").innerHTML = x.list.map((e) => {
    const meta = [e.note, prettyDate(e.date)].filter(Boolean).map(esc).join(" \u00b7 ");
    return `
      <li>
        <span class="pay-left">
          <span class="ico ico-out" aria-hidden="true">\u20b9</span>
          <span class="pay-name">${esc(e.category)}<span>${meta}</span></span>
        </span>
        <span class="pay-right">
          <span class="amount">${money(e.amount)}</span>
          <button class="link-btn link-danger" type="button" data-act="del-expense" data-exp="${esc(e.id)}">Remove</button>
        </span>
      </li>`;
  }).join("");
}

/* ---------- owner tab ---------- */

const SETTINGS_ROWS = [
  {
    key: "floors",
    title: "Floors",
    note: "Turn this off for a single-storey PG. Rooms stop asking for a floor, and the overview counts by room instead.",
    opts: [{ v: true, label: "Use floors" }, { v: false, label: "No floors" }]
  },
  {
    key: "bedStyle",
    title: "Bed labels",
    note: "How every bed is named \u2014 on the bed tiles, in the rent list and on each tenant profile.",
    opts: [{ v: "alpha", label: "Letters" }, { v: "number", label: "Numbers" }]
  },
  {
    key: "bedNumbering",
    title: "Beds in a new room",
    note: "Start every room again from the first label, or carry on counting from the room before it.",
    opts: [{ v: "restart", label: "Start again" }, { v: "continue", label: "Carry on" }]
  }
];

function ownerName() {
  const o = PGStore.state().owner || {};
  return o.name || (window.PG_SESSION && PG_SESSION.name) || "Owner";
}

function renderOwner() {
  const s = PGStore.state();
  const o = s.owner || {};
  const t = totals();
  const tel = String(o.phone || "").replace(/[^0-9+]/g, "");
  const name = ownerName();

  el("owner-card").innerHTML = `
    <div class="own-top">
      <span class="av own-av">${esc(initials(name))}</span>
      <span class="own-id">
        <b>${esc(name)}</b>
        <span>${esc(s.property || "Property not named yet")}</span>
      </span>
    </div>
    <div class="own-grid">
      <div class="own-cell"><b>Phone</b><span>${
        tel ? `<a href="tel:${esc(tel)}">${esc(o.phone)}</a>` : "<i>Not added yet</i>"
      }</span></div>
      <div class="own-cell"><b>Address</b><span>${
        o.address ? esc(o.address) : "<i>Not added yet</i>"
      }</span></div>
      <div class="own-cell"><b>Property</b><span>${t.rooms} ${t.rooms === 1 ? "room" : "rooms"} · ${t.beds} beds · ${t.occupied} filled</span></div>
      <div class="own-cell"><b>Rent this month</b><span>${money(t.collected)} of ${money(t.expected)}</span></div>
    </div>`;

  /* The greeting and the avatar follow whatever name the owner saved. */
  el("greet").textContent = greeting() + ", " + String(name).split(" ")[0];
  el("avatar").textContent = initials(name);
  el("avatar").title = name;
}

/* Shows the labels the current choices actually produce, using real rooms. */
function bedPreview() {
  const rooms = PGStore.state().rooms;
  if (!rooms.length) { return "Add a room and the labels will preview here."; }

  const a = rooms[0];
  const first = a.beds.map((bed, i) => PGStore.bedLabel(i, a.id)).join(", ");
  if (rooms.length < 2) { return "Beds read " + first + " in room " + a.no + "."; }

  const b = rooms[1];
  return "Beds read " + first + " in room " + a.no +
    ", then " + PGStore.bedLabel(0, b.id) + " in room " + b.no + ".";
}

function renderSettings() {
  const s = PGStore.state().settings;

  el("settings-list").innerHTML = SETTINGS_ROWS.map((row) => {
    const opts = row.opts.map((o) => {
      const on = o.v === s[row.key];
      return `<button class="seg${on ? " is-on" : ""}" type="button" aria-pressed="${on}" data-act="set-opt" data-key="${row.key}" data-val="${String(o.v)}">${o.label}</button>`;
    }).join("");

    return `
      <div class="set-row">
        <div class="set-text"><b>${row.title}</b><span>${row.note}</span></div>
        <div class="seg-group">${opts}</div>
      </div>`;
  }).join("");

  el("set-preview").textContent = bedPreview();
}

/* The rents your rooms are actually set to, so the card can be sanity-checked. */
function roomRates() {
  const map = {};
  PGStore.state().rooms.forEach((r) => {
    const k = String(r.rent);
    if (!map[k]) { map[k] = { amount: r.rent, beds: 0, rooms: [] }; }
    map[k].beds += r.beds.length;
    map[k].rooms.push(r.no);
  });
  return Object.keys(map).map((k) => map[k]).sort((a, b) => b.amount - a.amount);
}

function rateRow(label, sub, amount) {
  return `
    <div class="rc-row">
      <div><b>${esc(label)}</b><span>${esc(sub)}</span></div>
      <span class="rc-amt">${money(amount)}</span>
    </div>`;
}

function renderRates() {
  const rates = PGStore.state().rates;

  el("rate-list").innerHTML = rates.length
    ? rates.map((r) => `
      <div class="rc-row">
        <div><b>${esc(r.label)}</b><span>${esc(r.note || "per bed, per month")}</span></div>
        <span class="pay-right">
          <span class="rc-amt">${money(r.amount)}</span>
          <button class="link-btn link-danger" type="button" data-act="del-rate" data-rate="${esc(r.id)}">Remove</button>
        </span>
      </div>`).join("")
    : '<p class="rate-blank">Nothing on the card yet. Add what you charge for a single, a two sharing, an AC room \u2014 then you can pull it up in front of anyone who asks.</p>';
}

function openRateCard() {
  const rates = PGStore.state().rates;
  const rooms = roomRates();

  const mine = '<div class="rc-sec"><h4>What you charge</h4>' + (rates.length
    ? rates.map((r) => rateRow(r.label, r.note || "per bed, per month", r.amount)).join("")
    : '<p class="rate-blank">No rates added yet.</p>') + "</div>";

  const actual = rooms.length
    ? '<div class="rc-sec"><h4>What your rooms are set to</h4>' +
      rooms.map((d) => rateRow(
        d.beds + (d.beds === 1 ? " bed" : " beds"),
        "Room " + d.rooms.join(", "),
        d.amount
      )).join("") + "</div>"
    : "";

  el("rates-body").innerHTML = mine + actual;
  openDlg("dlg-rates");
}

function openOwnerDialog() {
  const o = PGStore.state().owner || {};
  el("o-name").value = o.name || (window.PG_SESSION && PG_SESSION.name) || "";
  el("o-phone").value = o.phone || "";
  el("o-address").value = o.address || "";
  openDlg("dlg-owner");
}

/* A PG with floors switched off should never be asked for one. */
function applyFloorSetting() {
  const field = el("r-floor-field");
  if (field) { field.hidden = PGStore.state().settings.floors === false; }
}

function renderAll() {
  const s = PGStore.state();
  el("brand-prop").textContent = s.property || "Name your property";
  el("setup").hidden = !PGStore.isEmpty();
  renderStats();
  renderFloors();
  renderFeed();
  renderRooms();
  renderTenants();
  renderRent();
  renderExpenses();
  renderOwner();
  renderSettings();
  renderRates();
  applyFloorSetting();
}

/* ---------- backup ---------- */

function backupLabel(s) {
  if (s.state === "off") { return "Sheet backup is not set up yet."; }
  if (s.state === "saving") { return "Backing up to Google Sheets\u2026"; }
  if (s.state === "error") { return "Backup failed. " + (s.error || ""); }
  if (s.at) { return "Backed up to Google Sheets " + sinceLabel(s.at) + "."; }
  return "Nothing backed up yet. Any change is saved to the sheet automatically.";
}

function renderBackup(s) {
  const bar = el("backup");
  if (!bar) { return; }
  bar.className = "backup is-" + s.state;
  el("backup-text").textContent = backupLabel(s);
  el("backup-actions").hidden = !(window.PGSheets && PGSheets.enabled);
}

/* Redraw, then send the change to the sheet once typing settles. */
function commit() {
  renderAll();
  if (window.PGSheets) { PGSheets.schedule(PGStore.state()); }
}

/* ---------- dialogs ---------- */

function openDlg(id) {
  const d = el(id);
  const err = d.querySelector(".auth-error");
  if (err) { err.hidden = true; }
  if (d.showModal) { d.showModal(); } else { d.setAttribute("open", ""); }
  const first = d.querySelector("input, select");
  if (first) { setTimeout(() => first.focus(), 30); }
}

function closeDlg(id) {
  const d = el(id);
  if (d.close) { d.close(); } else { d.removeAttribute("open"); }
}

function showErr(id, message) {
  const p = el(id);
  p.textContent = message;
  p.hidden = false;
}

/* Fill the bed picker with every vacant bed, optionally preselecting one. */
function fillBedPicker(roomId, bedIndex) {
  const picker = el("t-bed");
  const free = PGStore.vacantBeds();

  picker.innerHTML = free.map((b) =>
    `<option value="${esc(b.roomId)}|${b.bedIndex}">Room ${esc(b.roomNo)} · Bed ${b.bed} — ${money(b.rent)}</option>`
  ).join("");

  if (roomId != null) { picker.value = roomId + "|" + bedIndex; }
  return free.length;
}

function openTenantDialog(roomId, bedIndex) {
  if (!PGStore.vacantBeds().length) {
    alert(PGStore.isEmpty()
      ? "Add a room first, then you can move tenants in."
      : "Every bed is taken. Add another room to make space.");
    return;
  }
  fillBedPicker(roomId, bedIndex);
  el("t-joined").value = new Date().toISOString().slice(0, 10);
  openDlg("dlg-tenant");
}

function openExpenseDialog() {
  const sel = el("x-cat");
  sel.innerHTML = EXPENSE_CATS.map((c) => `<option value="${c}">${c}</option>`).join("");
  el("x-date").value = new Date().toISOString().slice(0, 10);
  openDlg("dlg-expense");
}

/* ---------- actions ---------- */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) { return; }

  const act = btn.dataset.act;
  const roomId = btn.dataset.room;
  const bedIndex = btn.dataset.bed;

  if (act === "add-room") {
    el("form-room").reset();
    openDlg("dlg-room");
  } else if (act === "add-tenant") {
    el("form-tenant").reset();
    openTenantDialog(null, null);
  } else if (act === "fill-bed") {
    el("form-tenant").reset();
    openTenantDialog(roomId, bedIndex);
  } else if (act === "name-property") {
    el("p-name").value = PGStore.state().property;
    openDlg("dlg-property");
  } else if (act === "del-room") {
    if (confirm("Remove this room? Any tenants in it are removed too.")) {
      PGStore.removeRoom(roomId);
      commit();
    }
  } else if (act === "notice") {
    PGStore.toggleNotice(roomId, Number(bedIndex));
    commit();
  } else if (act === "checkout") {
    if (confirm("Check this tenant out and free the bed?")) {
      PGStore.removeTenant(roomId, Number(bedIndex));
      commit();
    }
  } else if (act === "pay") {
    PGStore.setPaid(roomId, Number(bedIndex), btn.dataset.paid === "1");
    commit();
  } else if (act === "add-expense") {
    el("form-expense").reset();
    openExpenseDialog();
  } else if (act === "del-expense") {
    if (confirm("Remove this expense?")) {
      PGStore.removeExpense(btn.dataset.exp);
      commit();
    }
  } else if (act === "backup-now") {
    PGSheets.backupNow(PGStore.state());
  } else if (act === "backup-restore") {
    if (confirm("Replace everything on this account with the last backup from the sheet?")) {
      PGSheets.restore().then((data) => {
        PGStore.replaceAll(data);
        renderAll();
      }, (err) => {
        alert(err && err.message ? err.message : "Could not restore from the sheet.");
      });
    }
  } else if (act === "rate-card") {
    openRateCard();
  } else if (act === "add-rate") {
    closeDlg("dlg-rates");
    el("ra-label").value = "";
    el("ra-amt").value = "";
    el("ra-note").value = "";
    openDlg("dlg-rate");
  } else if (act === "del-rate") {
    PGStore.removeRate(btn.dataset.rate);
    commit();
  } else if (act === "edit-owner") {
    openOwnerDialog();
  } else if (act === "set-opt") {
    const raw = btn.dataset.val;
    const patch = {};
    patch[btn.dataset.key] = raw === "true" ? true : raw === "false" ? false : raw;
    PGStore.setSettings(patch);
    commit();
  } else if (act === "close") {
    closeDlg(btn.dataset.dlg);
  }
});

el("form-room").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = PGStore.addRoom({
    no: el("r-no").value,
    floor: PGStore.settings().floors === false ? 0 : el("r-floor").value,
    beds: el("r-beds").value,
    rent: el("r-rent").value
  });
  if (!res.ok) { showErr("r-err", res.error); return; }
  closeDlg("dlg-room");
  commit();
});

el("form-tenant").addEventListener("submit", (e) => {
  e.preventDefault();
  const picked = String(el("t-bed").value || "").split("|");
  const res = PGStore.addTenant(picked[0], picked[1], {
    name: el("t-name").value,
    phone: el("t-phone").value,
    joined: el("t-joined").value,
    leaving: el("t-leaving").value,
    note: el("t-note").value
  });
  if (!res.ok) { showErr("t-err", res.error); return; }
  closeDlg("dlg-tenant");
  commit();
});

el("form-expense").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = PGStore.addExpense({
    category: el("x-cat").value,
    amount: el("x-amt").value,
    date: el("x-date").value,
    note: el("x-note").value
  });
  if (!res.ok) { showErr("x-err", res.error); return; }
  closeDlg("dlg-expense");
  commit();
});

el("form-rate").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = PGStore.addRate({
    label: el("ra-label").value,
    amount: el("ra-amt").value,
    note: el("ra-note").value
  });
  if (!res.ok) { showErr("ra-err", res.error); return; }
  closeDlg("dlg-rate");
  commit();
});

el("form-owner").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = PGStore.setOwner({
    name: el("o-name").value,
    phone: el("o-phone").value,
    address: el("o-address").value
  });
  if (!res.ok) { showErr("o-err", res.error); return; }
  closeDlg("dlg-owner");
  commit();
});

el("form-property").addEventListener("submit", (e) => {
  e.preventDefault();
  PGStore.setProperty(el("p-name").value);
  closeDlg("dlg-property");
  commit();
});

/* ---------- navigation ---------- */

function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-" + view));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
  window.scrollTo({ top: 0 });
}

el("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) { location.hash = tab.dataset.view; }
});

window.addEventListener("hashchange", () => show(location.hash.slice(1) || "dashboard"));

/* ---------- boot ---------- */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) { return "Good morning"; }
  if (h < 17) { return "Good afternoon"; }
  return "Good evening";
}

function boot(session) {
  const name = (session && session.name) || "Owner";
  const accountId = (session && session.id) || "local";
  PGStore.use(accountId);
  window.PG_SESSION = { name: name, id: accountId };

  if (window.PGSheets) {
    PGSheets.use(accountId);
    PGSheets.onStatus(renderBackup);
  }

  el("greet").textContent = greeting() + ", " + String(name).split(" ")[0];
  el("avatar").textContent = initials(name);
  el("avatar").title = name;
  el("stamp").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });

  renderAll();
  show(location.hash.slice(1) || "dashboard");
}

try {
  PGAuth.session().then((s) => {
    // A signed-out visitor is redirected by the gate in index.html.
    if (s.signedIn) { boot(s); }
  }, () => boot(null));
} catch (err) {
  boot(null);
}

/* ---------- session + theme ---------- */

const themeBtn = el("theme-toggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("pgTheme", next); } catch (err) {}
  });
}

const logoutBtn = el("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const done = () => location.replace("login.html");
    if (window.PGAuth) {
      Promise.resolve(window.PGAuth.signOut()).then(done, done);
    } else {
      try { sessionStorage.removeItem("pgAuth"); } catch (err) {}
      done();
    }
  });
}
