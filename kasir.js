// ==========================
// KONFIGURASI TOKO
// ==========================
let TOKO = { nama: "Nama Toko", alamat: "-", telp: "-", footer: "Terima kasih", logo: "" };


// Auto reload toko.json setiap 10 detik
async function loadToko() {
  try {
  const res = await fetch("./toko.json?_=" + Date.now());
    const data = await res.json();
    TOKO = data;
    console.log("Toko data updated", TOKO);
  } catch (e) {
    console.warn("Gagal load toko.json, pakai data default", e);
  }
}

// Initial load & interval reload (tidak perlu menunggu)
loadToko();
setInterval(loadToko, 10000);

// ==========================
// IMPORT FIREBASE
// ==========================
import { ref, onValue, remove, update, set } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { db } from "./firebase.js";

// ==========================
// FORMAT RUPIAH
// ==========================
function formatRupiah(angka) {
  return angka.toLocaleString("id-ID");
}

// ==========================
// TABLE REFERENCES
// ==========================
const ordersTable = document.getElementById("orders");
const approvedTable = document.getElementById("approvedOrders");

// ==========================
// RENDER PESANAN MASUK
// ==========================
function renderOrders(data) {
  ordersTable.innerHTML = "";
  if (!data) return;

  Object.entries(data).forEach(([key, order]) => {
    if (order.status === "Disetujui") return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.nomorMeja}</td>
      <td>${order.namaPemesan}</td>
      <td>${order.pembayaran}</td>
      <td><button onclick="showDetail('${key}')">Lihat</button></td>
      <td>Rp ${formatRupiah(order.total)}</td>
      <td>${order.status || "-"}</td>
      <td>
        <button class="btn-approve" onclick="approveOrder('${key}')">Setujui</button>
        <button class="btn-edit" onclick="editOrder('${key}')">Edit</button>
        <button class="btn-cancel" onclick="cancelOrder('${key}')">Cancel</button>
      </td>
    `;
    ordersTable.appendChild(tr);
  });
}
let lastOrderCount = 0;
let firstLoad = true;

function handleNewOrders(data) {
  if (!data) {
    updateBadge(0);
    return;
  }

  // hitung pesanan yang BELUM disetujui
  const pendingOrders = Object.values(data)
    .filter(o => o.status !== "Disetujui");

  const count = pendingOrders.length;

  // update badge
  updateBadge(count);

  // mainkan suara jika ada pesanan BARU
  if (!firstLoad && count > lastOrderCount) {
    document.getElementById("notifSound").play();
  }

  lastOrderCount = count;
  firstLoad = false;
}

function updateBadge(count) {
  const badge = document.getElementById("orderBadge");
  if (count > 0) {
    badge.innerText = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

// ==========================
// RENDER PESANAN DISETUJUI
// ==========================
function renderApproved(data) {
  approvedTable.innerHTML = "";
  if (!data) return;

  // Ubah object ke array & urutkan (TERBARU DI ATAS)
  const sorted = Object.entries(data)
    .sort((a, b) => b[1].timestamp - a[1].timestamp);

  sorted.forEach(([key, order]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.id_pesanan}</td>
      <td>${order.nomor_meja}</td>
      <td>${order.metode_bayar}</td>
      <td>Rp ${formatRupiah(order.total)}</td>
      <td>${order.waktu}</td>
      <td><button onclick="printNota('${key}')">🖨 Print</button></td>
    `;
    approvedTable.appendChild(tr);
  });
}


// ==========================
// LISTEN DATABASE REALTIME
// ==========================
onValue(ref(db, "pesanan"), snap => {
  const data = snap.val();
  renderOrders(data);
  handleNewOrders(data); // 🔔 badge + suara
});

onValue(ref(db, "pesanan"), snap => renderOrders(snap.val()));
onValue(ref(db, "pesanan_disetujui"), snap => renderApproved(snap.val()));

// ==========================
// SHOW DETAIL MODAL
// ==========================
window.showDetail = async function(key) {
  const snap = await new Promise(res =>
    onValue(ref(db, "pesanan/" + key), s => res(s), { onlyOnce: true })
  );
  const order = snap.val();
  if (!order) return;

  let html = `<table style="width:100%">
    <tr><th>Item</th><th>Qty</th><th>Harga</th><th>Sub</th><th>Aksi</th></tr>
  `;
  Object.entries(order.pesanan).forEach(([id, item]) => {
    html += `
      <tr>
        <td>${item.item}</td>
        <td><input type="number" min="1" value="${item.qty}"
            onchange="updateQty('${key}','${id}',this.value)"></td>
        <td>Rp ${formatRupiah(item.harga)}</td>
        <td>Rp ${formatRupiah(item.qty * item.harga)}</td>
        <td><button onclick="hapusItem('${key}','${id}')">Hapus</button></td>
      </tr>
    `;
  });
   html += `</table><br><b>Total: Rp ${formatRupiah(order.total)}</b>`;
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("detailModal").style.display = "flex";
};

window.closeModal = () => document.getElementById("detailModal").style.display = "none";

// ==========================
// UPDATE QTY
// ==========================
window.updateQty = async function(orderKey, itemKey, qty) {
  qty = Number(qty);
  if (qty < 1) return;
  await update(ref(db, `pesanan/${orderKey}/pesanan/${itemKey}`), { qty });
  await hitungTotal(orderKey);
  showDetail(orderKey);
};

// ==========================
// HAPUS ITEM
// ==========================
window.hapusItem = async function(orderKey, itemKey) {
  await remove(ref(db, `pesanan/${orderKey}/pesanan/${itemKey}`));
  await hitungTotal(orderKey);
  showDetail(orderKey);
};

// ==========================
// HITUNG TOTAL
// ==========================
async function hitungTotal(orderKey) {
  const snap = await new Promise(res =>
    onValue(ref(db, "pesanan/" + orderKey), s => res(s), { onlyOnce: true })
  );
  const order = snap.val();
  if (!order) return;

  let total = 0;
  Object.values(order.pesanan || {}).forEach(i => total += i.qty * i.harga);
  await update(ref(db, "pesanan/" + orderKey), { total });
}

// ==========================
// SETUJUI PESANAN
// ==========================
window.approveOrder = async function(key) {
  const snap = await new Promise(res =>
    onValue(ref(db, "pesanan/" + key), s => res(s), { onlyOnce: true })
  );
  const data = snap.val();
  if (!data) return;

  data.status = "Disetujui";
await set(ref(db, "pesanan_disetujui/" + key), {
  id_pesanan: key,
  nomor_meja: data.nomorMeja,
  metode_bayar: data.pembayaran,
  total: data.total,
  pesanan: data.pesanan,
  status: "Disetujui",
  waktu: new Date().toLocaleString("id-ID"),
  timestamp: Date.now()   // ⬅️ TAMBAHKAN INI
});


  await remove(ref(db, "pesanan/" + key));
  alert("Pesanan berhasil disetujui!");
};

// ==========================
// CANCEL PESANAN
// ==========================
window.cancelOrder = async key => remove(ref(db, "pesanan/" + key));

// ==========================
// EDIT METODE PEMBAYARAN
// ==========================
window.editOrder = async function(key) {
  const snap = await new Promise(res =>
    onValue(ref(db, "pesanan/" + key), s => res(s), { onlyOnce: true })
  );
  const data = snap.val();
  if (!data) return;

  const newMethod = prompt("Metode pembayaran baru:", data.pembayaran);
  if (!newMethod) return;

  await update(ref(db, "pesanan/" + key), { pembayaran: newMethod });
};

// ==========================
// PRINT NOTA FULL ASYNC TANPA MENUNGGU
// ==========================
window.printNota = async function(key) {
  const snap = await new Promise(res =>
    onValue(ref(db, "pesanan_disetujui/" + key), s => res(s), { onlyOnce: true })
  );
  const d = snap.val();
  if (!d) return;

  let rows = "";
  Object.values(d.pesanan).forEach(i => {
    rows += `
      <tr>
        <td>${i.item}</td>
        <td class="qty">${i.qty}</td>
        <td class="harga">Rp ${formatRupiah(i.harga)}</td>
        <td class="sub">Rp ${formatRupiah(i.qty * i.harga)}</td>
      </tr>
    `;
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Nota</title>
<style>
body { font-family: monospace; width: 300px; margin: auto; font-size: 12px; }
.center { text-align: center; }
.line { border-top: 1px dashed #000; margin: 8px 0; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; border-bottom: 1px dashed #000; }
td { padding: 4px 0; }
.qty { text-align: center; width: 30px; }
.harga, .sub { text-align: right; }
.total { font-weight: bold; font-size: 14px; text-align: right; }
.footer { margin-top: 10px; text-align: center; font-size: 11px; }
@media print { body { margin: 0; } }
/* ===== JARAK DARI TEPI ATAS KERTAS ===== */
@media print {
  @page {
    margin-top: 120mm;/* 🔧 ATUR JARAK ATAS DI SINI */
    margin-left: 4mm;
    margin-right: 4mm;
    margin-bottom: 4mm;
  }

  body {
    margin: 0;
    padding-top: 0;
  }
}


/* ===== HEADER NOTA LOGO KIRI ===== */
.nota-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.nota-logo {
  width: 18mm;      /* cocok printer 58mm */
  height: auto;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.nota-info {
  font-size: 11px;
  line-height: 1.3;
}

.nota-info h3 {
  margin: 0;
  font-size: 13px;
  font-weight: bold;
}

</style>
</head>
<body>
<div class="nota-header">
  <img src="${TOKO.logo}" class="nota-logo">

  <div class="nota-info">
    <h3>${TOKO.nama}</h3>
    <div>${TOKO.alamat}</div>
    <div>Telp: ${TOKO.telp}</div>
  </div>
</div>

<div class="line"></div>
<div>ID Pesanan : ${d.id_pesanan}</div>
<div>No Meja     : ${d.nomor_meja}</div>
<div>Waktu       : ${d.waktu}</div>
<div>Pembayaran  : ${d.metode_bayar}</div>
<div class="line"></div>
<table>
<thead>
<tr>
<th>Item</th>
<th class="qty">Qty</th>
<th class="harga">Harga</th>
<th class="sub">Sub</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
<div class="line"></div>
<div class="total">Total : Rp ${formatRupiah(d.total)}</div>
<div class="line"></div>
<div class="footer">${TOKO.footer.replace(/\n/g, "<br>")}</div>
<script>
window.print();
window.onafterprint = () => window.close();
</script>
</body>
</html>
`;

  const w = window.open("", "_blank", "width=400,height=600");
  w.document.write(html);
  w.document.close();
};
