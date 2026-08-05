/* PG Manager — static preview build.
   All data below is demo data held in memory. Swap this file for real API
   calls when the backend is ready. */

const ROOMS = [
  { no: "101", floor: 1, sharing: 3, beds: ["Rohit Sharma", "Aman Verma", "Kunal Joshi"] },
  { no: "102", floor: 1, sharing: 3, beds: ["Vivek Nair", "Sahil Khan", null] },
  { no: "103", floor: 1, sharing: 2, beds: ["Arjun Rao", "Nikhil Patil"] },
  { no: "104", floor: 1, sharing: 4, beds: ["Dev Mehta", "Yash Kulkarni", "Omkar Deshmukh", "notice:Harsh Gupta"] },
  { no: "201", floor: 2, sharing: 3, beds: ["Pranav Iyer", "Sameer Shaikh", "Aditya Jain"] },
  { no: "202", floor: 2, sharing: 3, beds: ["Rahul Bose", null, "Karan Malhotra"] },
  { no: "203", floor: 2, sharing: 4, beds: ["Tejas Pawar", "Ishan Roy", "Manav Shah", "Zaid Ansari"] },
  { no: "204", floor: 2, sharing: 2, beds: ["notice:Gaurav Singh", "Akash Reddy"] },
  { no: "301", floor: 3, sharing: 3, beds: ["Siddharth Menon", "Ravi Chauhan", "Parth Trivedi"] },
  { no: "302", floor: 3, sharing: 3, beds: ["Naveen Kumar", null, null] },
  { no: "303", floor: 3, sharing: 2, beds: ["Abhay Sinha", "Rehan Qureshi"] },
  { no: "304", floor: 3, sharing: 4, beds: ["Varun Bhatt", "Imran Sheikh", "notice:Sanjay More", null] },
];

const JOIN_DATES = ["12 Jan 2026", "03 Feb 2026", "21 Feb 2026", "08 Mar 2026", "17 Apr 2026", "02 May 2026", "29 May 2026", "14 Jun 2026", "05 Jul 2026"];
const RENT_BY_SHARING = { 2: 9500, 3: 8000, 4: 6500 };
const BED_LETTERS = ["A", "B", "C", "D"];

const ACTIVITY = [
  { type: "pay", icon: "₹", text: "Rent received from Arjun Rao", meta: "₹9,500 · UPI · today, 4:12 PM" },
  { type: "in", icon: "→", text: "Naveen Kumar checked in", meta: "Room 301 · Bed A · yesterday" },
  { type: "out", icon: "←", text: "Harsh Gupta gave 30-day notice", meta: "Room 104 · Bed D · 2 days ago" },
  { type: "pay", icon: "₹", text: "Rent received from Tejas Pawar", meta: "₹6,500 · Cash · 3 days ago" },
  { type: "in", icon: "→", text: "Rehan Qureshi checked in", meta: "Room 303 · Bed B · 4 days ago" },
];

/* ---------- derive ---------- */

function buildTenants() {
  const out = [];
  ROOMS.forEach((room) => {
    room.beds.forEach((raw, i) => {
      if (!raw) return;
      const onNotice = raw.startsWith("notice:");
      const name = onNotice ? raw.slice(7) : raw;
      const n = out.length;
      const status = onNotice ? "late" : n % 7 === 3 ? "late" : n % 3 === 0 ? "due" : "paid";
      out.push({
        name,
        room: room.no,
        bed: BED_LETTERS[i],
        sharing: room.sharing,
        onNotice,
        rent: RENT_BY_SHARING[room.sharing],
        phone: "+91 9" + String(800000000 + n * 3717219).slice(0, 9),
        joined: JOIN_DATES[n % JOIN_DATES.length],
        status,
      });
    });
  });
  return out;
}

const TENANTS = buildTenants();
const BEDS_TOTAL = ROOMS.reduce((s, r) => s + r.beds.length, 0);
const OCCUPIED = TENANTS.length;
const VACANT = BEDS_TOTAL - OCCUPIED;
const ON_NOTICE = TENANTS.filter((t) => t.onNotice).length;
const EXPECTED = TENANTS.reduce((s, t) => s + t.rent, 0);
const COLLECTED = TENANTS.filter((t) => t.status === "paid").reduce((s, t) => s + t.rent, 0);
const PENDING = EXPECTED - COLLECTED;

/* ---------- helpers ---------- */

const money = (n) => "\u20b9" + n.toLocaleString("en-IN");
const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const el = (id) => document.getElementById(id);
const BADGE = { paid: "Paid", due: "Due", late: "Overdue" };

/* ---------- render ---------- */

function renderStats() {
  const rate = Math.round((OCCUPIED / BEDS_TOTAL) * 100);
  el("stats").innerHTML = [
    { label: "Total beds", value: BEDS_TOTAL, note: ROOMS.length + " rooms · 3 floors" },
    { label: "Occupied", value: OCCUPIED, note: rate + "% occupancy", cls: "up" },
    { label: "Vacant", value: VACANT, note: ON_NOTICE + " more on notice", cls: "warn" },
    { label: "Collected in Aug", value: money(COLLECTED), note: money(PENDING) + " pending", cls: "warn" },
  ].map((s) => `
    <div class="stat">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-note ${s.cls || ""}">${s.note}</div>
    </div>`).join("");
}

function renderFloors() {
  const floors = [1, 2, 3].map((f) => {
    const rooms = ROOMS.filter((r) => r.floor === f);
    const total = rooms.reduce((s, r) => s + r.beds.length, 0);
    const filled = rooms.reduce((s, r) => s + r.beds.filter(Boolean).length, 0);
    return { f, total, filled, pct: Math.round((filled / total) * 100) };
  });
  el("occ-total").textContent = OCCUPIED + " of " + BEDS_TOTAL + " beds filled";
  el("floor-bars").innerHTML = floors.map((x) => `
    <div>
      <div class="bar-row-top"><span>Floor ${x.f}</span><b>${x.filled}/${x.total} · ${x.pct}%</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${x.pct}%"></div></div>
    </div>`).join("");
}

function renderFeed() {
  el("feed").innerHTML = ACTIVITY.map((a) => `
    <li>
      <span class="ico ico-${a.type}" aria-hidden="true">${a.icon}</span>
      <span class="feed-body">${a.text}<span>${a.meta}</span></span>
    </li>`).join("");
}

function renderRooms() {
  el("rooms").innerHTML = ROOMS.map((room) => {
    const filled = room.beds.filter(Boolean).length;
    const beds = room.beds.map((raw, i) => {
      const onNotice = raw && raw.startsWith("notice:");
      const name = raw ? (onNotice ? raw.slice(7) : raw) : "Vacant";
      const cls = raw ? (onNotice ? "bed bed-notice" : "bed bed-occupied") : "bed";
      return `<div class="${cls}"><b>Bed ${BED_LETTERS[i]}</b><span>${name}</span></div>`;
    }).join("");
    return `
      <div class="room">
        <div class="room-head">
          <b>Room ${room.no}</b>
          <span class="muted-sm">${filled}/${room.beds.length} · ${money(RENT_BY_SHARING[room.sharing])}</span>
        </div>
        <div class="room-beds">${beds}</div>
      </div>`;
  }).join("");
}

function renderTenants() {
  el("tenant-rows").innerHTML = TENANTS.map((t) => `
    <tr>
      <td><span class="who"><span class="av">${initials(t.name)}</span>${t.name}</span></td>
      <td class="mono">${t.room} · ${t.bed}</td>
      <td class="mono">${t.phone}</td>
      <td>${t.joined}</td>
      <td class="mono">${money(t.rent)}</td>
      <td><span class="badge badge-${t.status}">${BADGE[t.status]}</span></td>
    </tr>`).join("");

  el("tenant-cards").innerHTML = TENANTS.map((t) => `
    <div class="tcard">
      <div class="tcard-top">
        <span class="who"><span class="av">${initials(t.name)}</span>${t.name}</span>
        <span class="badge badge-${t.status}">${BADGE[t.status]}</span>
      </div>
      <div class="tcard-grid">
        <div><b>Bed</b>${t.room} · ${t.bed}</div>
        <div><b>Rent</b>${money(t.rent)}</div>
        <div><b>Phone</b>${t.phone}</div>
        <div><b>Joined</b>${t.joined}</div>
      </div>
    </div>`).join("");
}

function renderRent() {
  const paid = TENANTS.filter((t) => t.status === "paid").length;
  el("rent-stats").innerHTML = [
    { label: "Expected", value: money(EXPECTED), note: TENANTS.length + " tenants" },
    { label: "Collected", value: money(COLLECTED), note: paid + " payments received", cls: "up" },
    { label: "Pending", value: money(PENDING), note: TENANTS.length - paid + " still to pay", cls: "warn" },
  ].map((s) => `
    <div class="stat">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-note ${s.cls || ""}">${s.note}</div>
    </div>`).join("");

  const order = { late: 0, due: 1, paid: 2 };
  el("paylist").innerHTML = [...TENANTS]
    .sort((a, b) => order[a.status] - order[b.status])
    .map((t) => `
      <li>
        <span class="pay-left">
          <span class="av">${initials(t.name)}</span>
          <span class="pay-name">${t.name}<span>Room ${t.room} · Bed ${t.bed}</span></span>
        </span>
        <span class="pay-right">
          <span class="amount">${money(t.rent)}</span>
          <span class="badge badge-${t.status}">${BADGE[t.status]}</span>
        </span>
      </li>`).join("");
}

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

/* ---------- init ---------- */

el("stamp").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
renderStats();
renderFloors();
renderFeed();
renderRooms();
renderTenants();
renderRent();
show(location.hash.slice(1) || "dashboard");

/* ---------- session ---------- */

const logoutBtn = el("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    try { sessionStorage.removeItem("pgAuth"); } catch (err) {}
    location.replace("login.html");
  });
}
