
let salesHistory = [];
let purchaseHistory = [];
let pendingSales = [];
let currentItems = [];
let currentTransactionType = 'penjualan';
let currentGrandTotalPenjualan = 0;
let currentGrandTotalLabaRugi = 0;
let currentGrandTotalPembelian = 0;
let itemCounter = 0;
let editingItemId = null;
let masterItems = [];
let userId = null;
let currentStrukData = null; // Variabel global untuk menyimpan data struk sementara

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered: ', registration);
      })
      .catch(registrationError => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}

// --- Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', (event) => {
    // Cek status autentikasi Firebase
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            
            // Inisialisasi variabel untuk memastikan tidak ada kesalahan "is not defined"
            salesHistory = [];
            purchaseHistory = [];
            pendingSales = [];
            
            await loadDataFromFirestore();

            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            document.getElementById('tanggalPenjualan').value = formattedDate;
            document.getElementById('tanggalPembelian').value = formattedDate;

            loadNamaToko();
            
            document.getElementById('namaBarangPenjualan').addEventListener('input', () => showSuggestions('penjualan'));
            document.getElementById('namaBarangPenjualan').addEventListener('blur', () => { setTimeout(() => { document.getElementById('namaBarangSuggestionsPenjualan').innerHTML = ''; }, 100); });
            document.getElementById('namaBarangPembelian').addEventListener('input', () => showSuggestions('pembelian'));
            document.getElementById('namaBarangPembelian').addEventListener('blur', () => { setTimeout(() => { document.getElementById('namaBarangSuggestionsPembelian').innerHTML = ''; }, 100); });
            document.getElementById('restoreFileInput').addEventListener('change', restoreMasterItems);
            
            showSection('dashboard', document.getElementById('navDashboard'));
            document.getElementById('filterStartDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            document.getElementById('filterEndDate').value = formattedDate;

            document.getElementById('historyFilterStartDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            document.getElementById('historyFilterEndDate').value = formattedDate;

        } else {
            window.location.href = 'login.html';
        }
    });
});

// --- Firebase and Firestore Management ---
async function loadDataFromFirestore() {
    try {
        const docRef = db.collection('users').doc(userId);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            masterItems = data.masterItems || [];
            salesHistory = data.salesHistory || [];
            purchaseHistory = data.purchaseHistory || [];
            pendingSales = data.pendingSales || [];
        } else {
            console.log("No data found for user, initializing new data.");
        }
        renderMasterItems();
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        showMessageBox("Gagal memuat data dari server. Coba muat ulang halaman.");
    }
}

async function saveDataToFirestore() {
    try {
        const docRef = db.collection('users').doc(userId);
        await docRef.set({
            masterItems: masterItems,
            salesHistory: salesHistory,
            purchaseHistory: purchaseHistory,
            pendingSales: pendingSales
        }, { merge: true });
        console.log("Data berhasil disimpan ke Firestore.");
    } catch (error) {
        console.error("Error saving data:", error);
        showMessageBox("Gagal menyimpan data ke server. Periksa koneksi internet Anda.");
    }
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Logout error:", error);
        showMessageBox("Gagal logout. Silakan coba lagi.");
    });
}

// --- Utility Functions ---
function formatRupiah(angka) {
    let reverse = String(angka).split('').reverse().join('');
    let ribuan = reverse.match(/\d{1,3}/g);
    let result = ribuan.join('.').split('').reverse().join('');
    return `Rp. ${result}`;
}

function hitungUlangTotal(type) {
    if (type === 'penjualan') {
        currentGrandTotalPenjualan = 0;
        currentGrandTotalLabaRugi = 0;
        currentItems.forEach(item => {
            currentGrandTotalPenjualan += item.jumlah;
            currentGrandTotalLabaRugi += item.labaRugi;
        });
        document.getElementById('grandTotalPenjualan').innerText = formatRupiah(currentGrandTotalPenjualan);
        document.getElementById('grandTotalLabaRugi').innerText = formatRupiah(currentGrandTotalLabaRugi);
    } else if (type === 'pembelian') {
        currentGrandTotalPembelian = 0;
        currentItems.forEach(item => {
            currentGrandTotalPembelian += item.jumlah;
        });
        document.getElementById('grandTotalPembelian').innerText = formatRupiah(currentGrandTotalPembelian);
    }
}

function clearBarangInputs(type) {
    if (type === 'penjualan') {
        document.getElementById('namaBarangPenjualan').value = '';
        document.getElementById('jumlahKuantitasPenjualan').value = '';
        document.getElementById('hargaSatuanPenjualan').value = '';
        document.getElementById('hargaBeliPenjualan').value = '';
        document.getElementById('namaBarangPenjualan').focus();
        document.getElementById('namaBarangSuggestionsPenjualan').innerHTML = '';
    } else if (type === 'pembelian') {
        document.getElementById('namaBarangPembelian').value = '';
        document.getElementById('jumlahKuantitasPembelian').value = '';
        document.getElementById('hargaBeliPembelian').value = '';
        document.getElementById('hargaJualPembelian').value = '';
        document.getElementById('namaBarangPembelian').focus();
        document.getElementById('namaBarangSuggestionsPembelian').innerHTML = '';
    }
}

function resetCurrentTransaction(type) {
    currentItems = [];
    itemCounter = 0;
    editingItemId = null;
    if (type === 'penjualan') {
        document.getElementById('namaPembeli').value = '';
        currentGrandTotalPenjualan = 0;
        currentGrandTotalLabaRugi = 0;
        renderTablePenjualan();
        clearBarangInputs('penjualan');
        const today = new Date();
        const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        document.getElementById('tanggalPenjualan').value = formattedDate;
        document.getElementById('printerCard').style.display = 'none';
    } else if (type === 'pembelian') {
        document.getElementById('namaSupplier').value = '';
        currentGrandTotalPembelian = 0;
        renderTablePembelian();
        clearBarangInputs('pembelian');
        document.getElementById('strukOutputPembelian').style.display = 'none';
        document.getElementById('shareButtonsPembelian').style.display = 'none';
        const today = new Date();
        const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        document.getElementById('tanggalPembelian').value = formattedDate;
    }
}

// --- Tab Navigation ---
function showSection(sectionId, clickedButton, keepCurrentTransaction = false) {
    const sections = document.querySelectorAll('.main-content-wrapper.content-section');
    sections.forEach(section => section.classList.remove('active'));
    document.getElementById(`${sectionId}Section`).classList.add('active');

    const navButtons = document.querySelectorAll('.mobile-nav button');
    navButtons.forEach(btn => btn.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    currentTransactionType = sectionId;

    if (!keepCurrentTransaction) {
        if (sectionId === 'penjualan') {
            resetCurrentTransaction('penjualan');
        } else if (sectionId === 'pembelian') {
            resetCurrentTransaction('pembelian');
        }
    }

    if (sectionId === 'dashboard') {
        renderDashboard();
    } else if (sectionId === 'history') {
        filterHistory(); // Panggil filter history saat masuk tab
    } else if (sectionId === 'pending') {
        renderPendingSales();
    } else if (sectionId === 'profitLoss') {
        generateProfitLossReport();
    } else if (sectionId === 'stock') {
        generateStockReport();
    }
}

// --- Dashboard Management ---
function renderDashboard() {
    let totalSales = 0;
    let totalProfit = 0;
    let totalPurchases = 0;
    let totalStockValue = 0;

    salesHistory.forEach(struk => {
        totalSales += struk.totalPenjualan || 0;
        totalProfit += struk.totalLabaRugi || 0;
    });

    purchaseHistory.forEach(struk => {
        totalPurchases += struk.totalPembelian || 0;
    });

    masterItems.forEach(item => {
        totalStockValue += (item.stock || 0) * (item.purchasePrice || 0);
    });

    document.getElementById('dashboardTotalSales').innerText = formatRupiah(totalSales);
    document.getElementById('dashboardTotalProfit').innerText = formatRupiah(totalProfit);
    document.getElementById('dashboardTotalPurchases').innerText = formatRupiah(totalPurchases);
    document.getElementById('dashboardTotalStockValue').innerText = formatRupiah(totalStockValue);
}

// --- Penjualan Management ---
function tambahAtauUpdateBarangPenjualan() {
    const namaBarang = document.getElementById('namaBarangPenjualan').value.trim();
    const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPenjualan').value);
    const hargaSatuan = parseInt(document.getElementById('hargaSatuanPenjualan').value);
    const hargaBeli = parseInt(document.getElementById('hargaBeliPenjualan').value || '0');

    if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaSatuan)) {
        showTemporaryAlert('Mohon lengkapi Nama Barang, Kuantitas, dan Harga Satuan.', 'red');
        return;
    }
    if (jumlahKuantitas <= 0 || hargaSatuan < 0 || hargaBeli < 0) {
        showTemporaryAlert('Kuantitas dan Harga tidak boleh negatif atau nol.', 'red');
        return;
    }
    
    document.getElementById('printerCard').style.display = 'none';

    const jumlah = jumlahKuantitas * hargaSatuan;
    const labaRugi = (jumlahKuantitas * hargaSatuan) - (jumlahKuantitas * hargaBeli);

    if (editingItemId !== null) {
        const itemIndex = currentItems.findIndex(item => item.id === editingItemId);
        if (itemIndex > -1) {
            currentItems[itemIndex] = { ...currentItems[itemIndex], nama: namaBarang, qty: jumlahKuantitas, hargaSatuan: hargaSatuan, hargaBeli: hargaBeli, jumlah: jumlah, labaRugi: labaRugi };
        }
        editingItemId = null;
        document.getElementById('btnAddUpdatePenjualan').innerText = 'Update Barang';
        document.getElementById('btnCancelEditPenjualan').style.display = 'none';
    } else {
        itemCounter++;
        const newItem = { id: itemCounter, nama: namaBarang, qty: jumlahKuantitas, hargaSatuan: hargaSatuan, hargaBeli: hargaBeli, jumlah: jumlah, labaRugi: labaRugi };
        currentItems.push(newItem);
    }
    
    const masterItem = masterItems.find(mi => mi.name.toLowerCase() === namaBarang.toLowerCase());
    if (masterItem) {
        masterItem.price = hargaSatuan;
    } else {
        masterItems.push({ name: namaBarang, price: hargaSatuan, purchasePrice: hargaBeli, stock: 0 });
    }
    saveDataToFirestore();

    hitungUlangTotal('penjualan');
    renderTablePenjualan();
    clearBarangInputs('penjualan');
}

function editBarangPenjualan(id) {
    const itemToEdit = currentItems.find(item => item.id === id);
    if (itemToEdit) {
        document.getElementById('namaBarangPenjualan').value = itemToEdit.nama;
        document.getElementById('jumlahKuantitasPenjualan').value = itemToEdit.qty;
        document.getElementById('hargaSatuanPenjualan').value = itemToEdit.hargaSatuan;
        document.getElementById('hargaBeliPenjualan').value = itemToEdit.hargaBeli;

        document.getElementById('btnAddUpdatePenjualan').innerText = 'Update Barang';
        document.getElementById('btnCancelEditPenjualan').style.display = 'inline-block';
        editingItemId = id;
    }
}

function deleteBarangPenjualan(id) {
    showMessageBox('Apakah Anda yakin ingin menghapus barang ini?', true, () => {
        currentItems = currentItems.filter(item => item.id !== id);
        hitungUlangTotal('penjualan');
        renderTablePenjualan();
        batalEditPenjualan();
        document.getElementById('printerCard').style.display = 'none';
    });
}

function batalEditPenjualan() {
    editingItemId = null;
    document.getElementById('btnAddUpdatePenjualan').innerText = 'Tambah Barang';
    document.getElementById('btnCancelEditPenjualan').style.display = 'none';
    clearBarangInputs('penjualan');
}

function renderTablePenjualan() {
    const daftarBelanja = document.getElementById('daftarBelanjaPenjualan');
    daftarBelanja.innerHTML = '';
    if (currentItems.length === 0) {
        daftarBelanja.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Belum ada barang.</td></tr>';
    }
    currentItems.forEach(item => {
        const row = daftarBelanja.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.id;
        row.insertCell(1).innerText = item.nama;
        row.insertCell(2).innerText = item.qty;
        row.insertCell(3).innerText = formatRupiah(item.hargaSatuan);
        row.insertCell(4).innerText = formatRupiah(item.hargaBeli);
        row.insertCell(5).innerText = formatRupiah(item.jumlah);
        row.insertCell(6).innerText = formatRupiah(item.labaRugi);
        const actionCell = row.insertCell(7);
        actionCell.classList.add('action-buttons', 'flex', 'gap-2', 'py-2');
        const editButton = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        editButton.onclick = () => editBarangPenjualan(item.id);
        actionCell.appendChild(editButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteBarangPenjualan(item.id);
        actionCell.appendChild(deleteButton);
    });
}

// FUNGSI REVISI
function renderStrukPreviewPenjualan(strukData) {
    currentStrukData = strukData; // Simpan data struk ke variabel global

    const namaToko = strukData.toko || 'Nama Toko';
    const tanggal = strukData.tanggal;
    const namaPembeli = strukData.pembeli || 'Pelanggan Yth.';

    let strukHTML = `<h3 class="text-center font-bold text-lg">${namaToko}</h3>`;
    strukHTML += `<p class="text-center text-sm">Tgl: ${tanggal} | Pembeli: ${namaPembeli}</p><hr class="my-2 border-dashed border-gray-400">`;
    strukHTML += `<ul>`;
    strukData.items.forEach(item => {
        strukHTML += `<li class="flex justify-between text-sm py-1"><span>${item.nama} (${item.qty} x ${formatRupiah(item.hargaSatuan)})</span><span>${formatRupiah(item.jumlah)}</span></li>`;
    });
    strukHTML += `</ul>`;
    strukHTML += `<hr class="my-2 border-dashed border-gray-400">`;
    strukHTML += `<p class="flex justify-between text-lg font-bold"><span>TOTAL:</span><span>${formatRupiah(strukData.totalPenjualan)}</span></p>`;
    
    document.getElementById('strukOutputPenjualan').innerHTML = strukHTML;
}

// FUNGSI REVISI
async function selesaikanPembayaran() {
    if (currentItems.length === 0) {
        showTemporaryAlert('Tambahkan barang terlebih dahulu.', 'red');
        return;
    }

    currentItems.forEach(item => {
        const masterItem = masterItems.find(mi => mi.name === item.nama);
        if (masterItem) {
            masterItem.stock -= item.qty;
        }
    });

    const namaToko = document.getElementById('namaToko').value || 'Nama Toko';
    const tanggal = document.getElementById('tanggalPenjualan').value;
    const namaPembeli = document.getElementById('namaPembeli').value || 'Pelanggan Yth.';

    const newStruk = {
        id: Date.now(),
        tanggal: tanggal,
        pembeli: namaPembeli,
        toko: namaToko,
        items: JSON.parse(JSON.stringify(currentItems)),
        totalPenjualan: currentGrandTotalPenjualan,
        totalLabaRugi: currentGrandTotalLabaRugi
    };

    salesHistory.push(newStruk);
    await saveDataToFirestore();

    // Render struk dan simpan data ke variabel global
    renderStrukPreviewPenjualan(newStruk);
    document.getElementById('printerCard').style.display = 'block';

    // Pemicu download otomatis
    downloadStrukJPG();
    
    showTemporaryAlert('Pembayaran berhasil diselesaikan dan struk akan diunduh otomatis!', 'green');
}

// FUNGSI REVISI untuk membagikan struk via WhatsApp
function shareViaWhatsAppPenjualan() {
    // Ambil data dari variabel global
    if (!currentStrukData) {
        showTemporaryAlert('Tidak ada struk untuk dibagikan. Silakan selesaikan pembayaran terlebih dahulu.', 'red');
        return;
    }

    // Siapkan pesan teks yang berisi semua detail struk
    const namaToko = currentStrukData.toko || 'Nama Toko';
    const tanggal = currentStrukData.tanggal;
    const namaPembeli = currentStrukData.pembeli || 'Pelanggan Yth.';
    const totalPenjualan = formatRupiah(currentStrukData.totalPenjualan);

    let message = `*NOTA PENJUALAN*\n\n`;
    message += `*${namaToko}*\n`;
    message += `Tgl: ${tanggal}\n`;
    message += `Pembeli: ${namaPembeli}\n`;
    message += `--------------------------------\n`;
    message += `*Daftar Barang:*\n`;

    // Gunakan map dan join untuk memastikan semua item masuk dalam string
    message += currentStrukData.items.map(item => 
        `${item.nama} (${item.qty} x ${formatRupiah(item.hargaSatuan)}) = ${formatRupiah(item.jumlah)}`
    ).join('\n');

    message += `\n--------------------------------\n`;
    message += `*TOTAL: ${totalPenjualan}*\n\n`;
    message += `_Terima kasih telah berbelanja!_`;

    // Buka WhatsApp dengan pesan teks yang sudah disiapkan
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}


// FUNGSI REVISI untuk membuat dan mengunduh struk sebagai JPG
function downloadStrukJPG() {
    const strukOutput = document.getElementById('strukOutputPenjualan');
    if (!strukOutput || !strukOutput.innerHTML.trim()) {
        showTemporaryAlert('Tidak ada struk untuk diunduh.', 'red');
        return;
    }

    // Menggunakan html2canvas untuk mengubah elemen struk menjadi canvas
    html2canvas(strukOutput, {
        scale: 3, // Meningkatkan resolusi gambar untuk kualitas yang lebih baik
        backgroundColor: '#ffffff' // Menghilangkan latar belakang transparan
    }).then(canvas => {
        // Mengubah canvas menjadi format blob (Binary Large Object)
        canvas.toBlob(function(blob) {
            // Menggunakan FileSaver.js untuk memicu dialog unduhan
            const fileName = `struk_penjualan_${new Date().toISOString().slice(0, 10)}.jpg`;
            saveAs(blob, fileName);
            showTemporaryAlert('Struk berhasil diunduh sebagai JPG!', 'green');
        }, 'image/jpeg', 0.9); // Mengatur format dan kualitas JPG
    }).catch(error => {
        console.error("Gagal membuat gambar dari canvas:", error);
        showTemporaryAlert('Gagal mengunduh struk JPG.', 'red');
    });
}

// --- Pembelian Management ---
async function tambahAtauUpdateBarangPembelian() {
    const namaBarang = document.getElementById('namaBarangPembelian').value.trim();
    const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPembelian').value);
    const hargaBeli = parseInt(document.getElementById('hargaBeliPembelian').value);
    const hargaJual = parseInt(document.getElementById('hargaJualPembelian').value);

    if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaBeli) || isNaN(hargaJual)) {
        showTemporaryAlert('Mohon lengkapi semua field: Nama Barang, Kuantitas, Harga Beli, dan Harga Jual.', 'red');
        return;
    }
    if (jumlahKuantitas <= 0 || hargaBeli < 0 || hargaJual < 0) {
        showTemporaryAlert('Kuantitas dan Harga tidak boleh negatif atau nol.', 'red');
        return;
    }
    
    const jumlah = jumlahKuantitas * hargaBeli;
    const masterItemIndex = masterItems.findIndex(mi => mi.name.toLowerCase() === namaBarang.toLowerCase());

    if (editingItemId !== null) {
        const itemIndex = currentItems.findIndex(item => item.id === editingItemId);
        if (itemIndex > -1) {
            const oldQty = currentItems[itemIndex].qty;
            const oldName = currentItems[itemIndex].nama;
            
            const oldMasterItem = masterItems.find(mi => mi.name === oldName);
            if(oldMasterItem) oldMasterItem.stock -= oldQty;

            currentItems[itemIndex] = { ...currentItems[itemIndex], nama: namaBarang, qty: jumlahKuantitas, hargaBeli: hargaBeli, jumlah: jumlah };
            
            if(masterItemIndex > -1) {
                const masterItem = masterItems[masterItemIndex];
                const totalOldValue = (masterItem.stock) * masterItem.purchasePrice;
                masterItem.stock += jumlahKuantitas;
                masterItem.purchasePrice = (totalOldValue + (jumlahKuantitas * hargaBeli)) / (masterItem.stock);
            }
        }
        editingItemId = null;
        document.getElementById('btnAddUpdatePembelian').innerText = 'Update Barang';
        document.getElementById('btnCancelEditPembelian').style.display = 'none';
    } else {
        itemCounter++;
        const newItem = { id: itemCounter, nama: namaBarang, qty: jumlahKuantitas, hargaBeli: hargaBeli, jumlah: jumlah, hargaJual: hargaJual };
        currentItems.push(newItem);

        if (masterItemIndex > -1) {
            const masterItem = masterItems[masterItemIndex];
            const oldStock = masterItem.stock || 0;
            const oldPurchasePrice = masterItem.purchasePrice || 0;
            const newStock = oldStock + jumlahKuantitas;
            const totalValueOld = oldStock * oldPurchasePrice;
            const totalValueNew = jumlahKuantitas * hargaBeli;
            const newPurchasePrice = (totalValueOld + totalValueNew) / newStock;
            
            masterItem.stock = newStock;
            masterItem.purchasePrice = newPurchasePrice;
            masterItem.price = hargaJual;
        } else {
            masterItems.push({ name: namaBarang, price: hargaJual, purchasePrice: hargaBeli, stock: jumlahKuantitas });
        }
    }
    await saveDataToFirestore();
    hitungUlangTotal('pembelian');
    renderTablePembelian();
    clearBarangInputs('pembelian');
}

function editBarangPembelian(id) {
    const itemToEdit = currentItems.find(item => item.id === id);
    if (itemToEdit) {
        document.getElementById('namaBarangPembelian').value = itemToEdit.nama;
        document.getElementById('jumlahKuantitasPembelian').value = itemToEdit.qty;
        document.getElementById('hargaBeliPembelian').value = itemToEdit.hargaBeli;
        document.getElementById('hargaJualPembelian').value = itemToEdit.hargaJual;

        document.getElementById('btnAddUpdatePembelian').innerText = 'Update Barang';
        document.getElementById('btnCancelEditPembelian').style.display = 'inline-block';
        editingItemId = id;
    }
}

function deleteBarangPembelian(id) {
    showMessageBox('Apakah Anda yakin ingin menghapus barang ini?', true, async () => {
        const deletedItem = currentItems.find(item => item.id === id);
        if (deletedItem) {
            const masterItem = masterItems.find(mi => mi.name === deletedItem.nama);
            if (masterItem) {
                masterItem.stock -= deletedItem.qty;
            }
            await saveDataToFirestore();
        }
        currentItems = currentItems.filter(item => item.id !== id);
        hitungUlangTotal('pembelian');
        renderTablePembelian();
        batalEditPembelian();
        document.getElementById('strukOutputPembelian').style.display = 'none';
    });
}

function batalEditPembelian() {
    editingItemId = null;
    document.getElementById('btnAddUpdatePembelian').innerText = 'Tambah Barang';
    document.getElementById('btnCancelEditPembelian').style.display = 'none';
    clearBarangInputs('pembelian');
}

function renderTablePembelian() {
    const daftarBelanja = document.getElementById('daftarBelanjaPembelian');
    daftarBelanja.innerHTML = '';
    if (currentItems.length === 0) {
        daftarBelanja.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Belum ada barang.</td></tr>';
    }
    currentItems.forEach(item => {
        const row = daftarBelanja.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.id;
        row.insertCell(1).innerText = item.nama;
        row.insertCell(2).innerText = item.qty;
        row.insertCell(3).innerText = formatRupiah(item.hargaBeli);
        row.insertCell(4).innerText = formatRupiah(item.jumlah);
        const actionCell = row.insertCell(5);
        actionCell.classList.add('action-buttons', 'flex', 'gap-2', 'py-2');
        const editButton = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        editButton.onclick = () => editBarangPembelian(item.id);
        actionCell.appendChild(editButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteBarangPembelian(item.id);
        actionCell.appendChild(deleteButton);
    });
}

async function simpanNotaPembelian() {
    if (currentItems.length === 0) {
        showTemporaryAlert('Tidak ada barang untuk disimpan.', 'red');
        return;
    }
    const tanggal = document.getElementById('tanggalPembelian').value;
    const namaSupplier = document.getElementById('namaSupplier').value || 'Supplier Umum';
    const newStruk = {
        id: Date.now(),
        tanggal: tanggal,
        supplier: namaSupplier,
        items: JSON.parse(JSON.stringify(currentItems)),
        totalPembelian: currentGrandTotalPembelian
    };
    purchaseHistory.push(newStruk);
    await saveDataToFirestore();
    renderStrukPreviewPembelian(newStruk);
    document.getElementById('strukOutputPembelian').style.display = 'block';
    document.getElementById('shareButtonsPembelian').style.display = 'flex'; // Pastikan tombol muncul
    
    // Tampilkan notifikasi non-blokir
    showTemporaryAlert('Nota pembelian berhasil disimpan!', 'green');
    
    // Tidak lagi ada setTimeout untuk menghapus struk. Struk akan tetap di layar.
}

function renderStrukPreviewPembelian(strukData) {
    const namaToko = document.getElementById('namaToko').value || 'Nama Toko';
    const tanggal = strukData.tanggal;
    const namaSupplier = strukData.supplier || 'Supplier Umum';

    let strukHTML = `<h3 class="text-center font-bold text-lg">${namaToko}</h3>`;
    strukHTML += `<p class="text-center text-sm">Tgl: ${tanggal} | Supplier: ${namaSupplier}</p><hr class="my-2 border-dashed border-gray-400">`;
    strukHTML += `<ul>`;
    strukData.items.forEach(item => {
        strukHTML += `<li class="flex justify-between text-sm py-1"><span>${item.nama} (${item.qty} x ${formatRupiah(item.hargaBeli)})</span><span>${formatRupiah(item.jumlah)}</span></li>`;
    });
    strukHTML += `</ul>`;
    strukHTML += `<hr class="my-2 border-dashed border-gray-400">`;
    strukHTML += `<p class="flex justify-between text-lg font-bold"><span>TOTAL:</span><span>${formatRupiah(strukData.totalPembelian)}</span></p>`;
    
    document.getElementById('strukContentPembelian').innerHTML = strukHTML;
}

function shareViaWhatsAppPembelian() {
    const lastStruk = purchaseHistory[purchaseHistory.length - 1];
    if (!lastStruk) {
        showTemporaryAlert('Tidak ada nota untuk dibagikan.', 'red');
        return;
    }
    const namaToko = document.getElementById('namaToko').value || 'Nama Toko';
    let message = `*NOTA PEMBELIAN*\n\n*${namaToko}*\nTanggal: ${lastStruk.tanggal}\nSupplier: ${lastStruk.supplier}\n\n*Daftar Barang:*\n`;
    lastStruk.items.forEach((item, index) => {
        message += `${index + 1}. ${item.nama} (${item.qty} x ${formatRupiah(item.hargaBeli)}) = ${formatRupiah(item.jumlah)}\n`;
    });
    message += `\n*TOTAL: ${formatRupiah(lastStruk.totalPembelian)}*\n\nTerima kasih!\n_Dibuat dengan Aplikasi Nota & Stok_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

// --- Master Items Management ---
async function addOrUpdateMasterItem(name, sellingPrice, purchasePrice, stockChange = 0) {
    const existingItemIndex = masterItems.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
    if (existingItemIndex > -1) {
        masterItems[existingItemIndex].price = sellingPrice;
        masterItems[existingItemIndex].purchasePrice = purchasePrice;
        masterItems[existingItemIndex].stock = (masterItems[existingItemIndex].stock || 0) + stockChange;
    } else {
        masterItems.push({ name: name, price: sellingPrice, purchasePrice: purchasePrice, stock: stockChange });
    }
    await saveDataToFirestore();
    renderMasterItems();
    renderModalMasterItems();
}

function renderMasterItems() {
    const masterItemsListBody = document.querySelector('#masterItemsList');
    masterItemsListBody.innerHTML = '';
    if (masterItems.length === 0) {
        masterItemsListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada barang master.</td></tr>';
        return;
    }
    masterItems.forEach((item, index) => {
        const row = masterItemsListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = formatRupiah(item.price || 0);
        row.insertCell(2).innerText = formatRupiah(item.purchasePrice || 0);
        row.insertCell(3).innerText = item.stock || 0;
        const actionCell = row.insertCell(4);
        actionCell.classList.add('master-item-actions', 'flex', 'gap-2', 'py-2');
        const editButton = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        editButton.onclick = () => editMasterItem(index);
        actionCell.appendChild(editButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteMasterItem(index);
        actionCell.appendChild(deleteButton);
    });
}

function editMasterItem(index) {
    const itemToEdit = masterItems[index];
    if (itemToEdit) {
        document.getElementById('namaBarangPenjualan').value = itemToEdit.name;
        document.getElementById('hargaSatuanPenjualan').value = itemToEdit.price;
        document.getElementById('hargaBeliPenjualan').value = itemToEdit.purchasePrice;
        document.getElementById('jumlahKuantitasPenjualan').value = '';
        document.getElementById('namaBarangPenjualan').focus();
        showSection('penjualan', document.getElementById('navPenjualan'));
    }
}

function deleteMasterItem(index) {
    showMessageBox(`Yakin ingin menghapus "${masterItems[index].name}"?`, true, async () => {
        masterItems.splice(index, 1);
        await saveDataToFirestore();
        renderMasterItems();
        renderModalMasterItems();
        showTemporaryAlert('Barang master berhasil dihapus.', 'green');
    });
}

function clearMasterItems() {
    showMessageBox('Yakin ingin menghapus SEMUA daftar barang master?', true, async () => {
        masterItems = [];
        await saveDataToFirestore();
        renderMasterItems();
        renderModalMasterItems();
        showTemporaryAlert('Semua barang master telah dihapus.', 'green');
    });
}

// Autocomplete logic
function showSuggestions(type) {
    const inputElement = (type === 'penjualan') ? document.getElementById('namaBarangPenjualan') : document.getElementById('namaBarangPembelian');
    const suggestionsDivElement = (type === 'penjualan') ? document.getElementById('namaBarangSuggestionsPenjualan') : document.getElementById('namaBarangSuggestionsPembelian');
    const filter = inputElement.value.toLowerCase();
    suggestionsDivElement.innerHTML = '';

    if (!filter) return;

    const filteredItems = masterItems.filter(item => item.name.toLowerCase().includes(filter));
    filteredItems.forEach(item => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('p-2', 'cursor-pointer', 'hover:bg-gray-100', 'border-b', 'border-gray-200');
        suggestionItem.innerText = `${item.name} (Jual: ${formatRupiah(item.price || 0)} | Beli: ${formatRupiah(item.purchasePrice || 0)})`;
        suggestionItem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputElement.value = item.name;
            if (type === 'penjualan') {
                document.getElementById('hargaSatuanPenjualan').value = item.price;
                document.getElementById('hargaBeliPenjualan').value = item.purchasePrice;
                document.getElementById('jumlahKuantitasPenjualan').focus();
            } else {
                document.getElementById('hargaBeliPembelian').value = item.purchasePrice;
                document.getElementById('hargaJualPembelian').value = item.price;
                document.getElementById('jumlahKuantitasPembelian').focus();
            }
            suggestionsDivElement.innerHTML = '';
        });
        suggestionsDivElement.appendChild(suggestionItem);
    });
}

// --- Master Item Search Modal ---
function openMasterItemModal(callerType) {
    currentTransactionType = callerType;
    document.getElementById('masterItemModal').style.display = 'flex';
    renderModalMasterItems();
    document.getElementById('masterItemSearchInput').value = '';
    document.getElementById('masterItemSearchInput').focus();
}

function closeMasterItemModal() {
    document.getElementById('masterItemModal').style.display = 'none';
}

function renderModalMasterItems() {
    const modalListBody = document.getElementById('modalMasterItemsList');
    modalListBody.innerHTML = '';
    const searchFilter = document.getElementById('masterItemSearchInput').value.toLowerCase();
    const filteredMasterItems = masterItems.filter(item => item.name.toLowerCase().includes(searchFilter));

    if (filteredMasterItems.length === 0) {
        modalListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Tidak ada barang yang cocok.</td></tr>';
        return;
    }

    filteredMasterItems.forEach(item => {
        const row = modalListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = formatRupiah(item.price || 0);
        row.insertCell(2).innerText = formatRupiah(item.purchasePrice || 0);
        row.insertCell(3).innerText = item.stock || 0;
        const selectCell = row.insertCell(4);
        const selectButton = document.createElement('button');
        selectButton.innerText = 'Pilih';
        selectButton.classList.add('bg-green-500', 'hover:bg-green-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        selectButton.onclick = () => selectMasterItemFromModal(item.name, item.price, item.purchasePrice);
        selectCell.appendChild(selectButton);
    });
}
document.getElementById('masterItemSearchInput').addEventListener('input', renderModalMasterItems);

function selectMasterItemFromModal(name, sellingPrice, purchasePrice) {
    if (currentTransactionType === 'penjualan') {
        document.getElementById('namaBarangPenjualan').value = name;
        document.getElementById('hargaSatuanPenjualan').value = sellingPrice;
        document.getElementById('hargaBeliPenjualan').value = purchasePrice;
        document.getElementById('jumlahKuantitasPenjualan').focus();
    } else if (currentTransactionType === 'pembelian') {
        document.getElementById('namaBarangPembelian').value = name;
        document.getElementById('hargaBeliPembelian').value = purchasePrice;
        document.getElementById('hargaJualPembelian').value = sellingPrice;
        document.getElementById('jumlahKuantitasPembelian').value = '';
        document.getElementById('jumlahKuantitasPembelian').focus();
    }
    closeMasterItemModal();
}

// --- History, Pending, Profit/Loss, Stock Reports ---
async function filterHistory() {
    const startDate = document.getElementById('historyFilterStartDate').value;
    const endDate = document.getElementById('historyFilterEndDate').value;
    const filterName = document.getElementById('historyFilterName').value.toLowerCase();

    const filteredSales = salesHistory.filter(struk => {
        const strukDate = struk.tanggal;
        const dateMatch = (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
        const nameMatch = !filterName || (struk.pembeli && struk.pembeli.toLowerCase().includes(filterName));
        return dateMatch && nameMatch;
    });

    const filteredPurchases = purchaseHistory.filter(struk => {
        const strukDate = struk.tanggal;
        const dateMatch = (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
        const nameMatch = !filterName || (struk.supplier && struk.supplier.toLowerCase().includes(filterName));
        return dateMatch && nameMatch;
    });

    renderFilteredSalesHistory(filteredSales);
    renderFilteredPurchaseHistory(filteredPurchases);
}

function renderFilteredSalesHistory(filteredSales) {
    const historyListBody = document.querySelector('#salesHistoryListBody');
    historyListBody.innerHTML = filteredSales.length === 0 ? '<tr><td colspan="6" class="text-center py-4 text-gray-500">Belum ada riwayat penjualan.</td></tr>' : '';
    filteredSales.forEach(struk => {
        const row = historyListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = struk.id;
        row.insertCell(1).innerText = struk.tanggal;
        row.insertCell(2).innerText = struk.pembeli;
        row.insertCell(3).innerText = formatRupiah(struk.totalPenjualan);
        row.insertCell(4).innerText = formatRupiah(struk.totalLabaRugi || 0);
        const actionCell = row.insertCell(5);
        actionCell.classList.add('history-actions', 'flex', 'gap-2', 'py-2');
        const viewButton = document.createElement('button');
        viewButton.innerText = 'Lihat';
        viewButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        viewButton.onclick = () => viewHistoryStruk(struk.id, 'penjualan');
        actionCell.appendChild(viewButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteHistoryStruk(struk.id, 'penjualan');
        actionCell.appendChild(deleteButton);
    });
}

function renderFilteredPurchaseHistory(filteredPurchases) {
    const historyListBody = document.querySelector('#purchaseHistoryListBody');
    historyListBody.innerHTML = filteredPurchases.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada riwayat pembelian.</td></tr>' : '';
    filteredPurchases.forEach(struk => {
        const row = historyListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = struk.id;
        row.insertCell(1).innerText = struk.tanggal;
        row.insertCell(2).innerText = struk.supplier;
        row.insertCell(3).innerText = formatRupiah(struk.totalPembelian);
        const actionCell = row.insertCell(4);
        actionCell.classList.add('history-actions', 'flex', 'gap-2', 'py-2');
        const viewButton = document.createElement('button');
        viewButton.innerText = 'Lihat';
        viewButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        viewButton.onclick = () => viewHistoryStruk(struk.id, 'pembelian');
        actionCell.appendChild(viewButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteHistoryStruk(struk.id, 'pembelian');
        actionCell.appendChild(deleteButton);
    });
}


async function clearSalesHistory() {
    showMessageBox('Yakin ingin menghapus SEMUA riwayat penjualan? Stok tidak dikembalikan.', true, async () => {
        salesHistory = [];
        await saveDataToFirestore();
        renderSalesHistory();
        showTemporaryAlert('Semua riwayat penjualan telah dihapus.', 'green');
    });
}
async function clearPurchaseHistory() {
    showMessageBox('Yakin ingin menghapus SEMUA riwayat pembelian? Stok tidak dikembalikan.', true, async () => {
        purchaseHistory = [];
        await saveDataToFirestore();
        renderPurchaseHistory();
        showTemporaryAlert('Semua riwayat pembelian telah dihapus.', 'green');
    });
}
async function clearPendingSales() {
    showMessageBox('Yakin ingin menghapus SEMUA transaksi pending?', true, async () => {
        pendingSales = [];
        await saveDataToFirestore();
        renderPendingSales();
        showTemporaryAlert('Semua transaksi pending telah dihapus.', 'green');
    });
}

function renderSalesHistory() {
    const historyListBody = document.querySelector('#salesHistoryListBody');
    historyListBody.innerHTML = salesHistory.length === 0 ? '<tr><td colspan="6" class="text-center py-4 text-gray-500">Belum ada riwayat penjualan.</td></tr>' : '';
    salesHistory.forEach(struk => {
        const row = historyListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = struk.id;
        row.insertCell(1).innerText = struk.tanggal;
        row.insertCell(2).innerText = struk.pembeli;
        row.insertCell(3).innerText = formatRupiah(struk.totalPenjualan);
        row.insertCell(4).innerText = formatRupiah(struk.totalLabaRugi || 0);
        const actionCell = row.insertCell(5);
        actionCell.classList.add('history-actions', 'flex', 'gap-2', 'py-2');
        const viewButton = document.createElement('button');
        viewButton.innerText = 'Lihat';
        viewButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        viewButton.onclick = () => viewHistoryStruk(struk.id, 'penjualan');
        actionCell.appendChild(viewButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteHistoryStruk(struk.id, 'penjualan');
        actionCell.appendChild(deleteButton);
    });
}

function renderPurchaseHistory() {
    const historyListBody = document.querySelector('#purchaseHistoryListBody');
    historyListBody.innerHTML = purchaseHistory.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada riwayat pembelian.</td></tr>' : '';
    purchaseHistory.forEach(struk => {
        const row = historyListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = struk.id;
        row.insertCell(1).innerText = struk.tanggal;
        row.insertCell(2).innerText = struk.supplier;
        row.insertCell(3).innerText = formatRupiah(struk.totalPembelian);
        const actionCell = row.insertCell(4);
        actionCell.classList.add('history-actions', 'flex', 'gap-2', 'py-2');
        const viewButton = document.createElement('button');
        viewButton.innerText = 'Lihat';
        viewButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        viewButton.onclick = () => viewHistoryStruk(struk.id, 'pembelian');
        actionCell.appendChild(viewButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteHistoryStruk(struk.id, 'pembelian');
        actionCell.appendChild(deleteButton);
    });
}

function viewHistoryStruk(id, type) {
    let strukToView;
    if (type === 'penjualan') {
        strukToView = salesHistory.find(s => s.id === id);
        if (strukToView) {
            document.getElementById('namaToko').value = strukToView.toko || '';
            document.getElementById('tanggalPenjualan').value = strukToView.tanggal;
            document.getElementById('namaPembeli').value = strukToView.pembeli;
            currentItems = JSON.parse(JSON.stringify(strukToView.items));
            hitungUlangTotal('penjualan');
            renderTablePenjualan();
            renderStrukPreviewPenjualan(strukToView);
            document.getElementById('printerCard').style.display = 'block';
            showTemporaryAlert(`Menampilkan struk penjualan riwayat dengan ID: ${strukToView.id}`, 'green');
            showSection('penjualan', document.getElementById('navPenjualan'), true);
        }
    } else if (type === 'pembelian') {
        strukToView = purchaseHistory.find(s => s.id === id);
        if (strukToView) {
            document.getElementById('namaToko').value = document.getElementById('namaToko').value || 'Nama Toko';
            document.getElementById('tanggalPembelian').value = strukToView.tanggal;
            document.getElementById('namaSupplier').value = strukToView.supplier;
            currentItems = JSON.parse(JSON.stringify(strukToView.items));
            hitungUlangTotal('pembelian');
            renderTablePembelian();
            renderStrukPreviewPembelian(strukToView);
            document.getElementById('strukOutputPembelian').style.display = 'block';
            showTemporaryAlert(`Menampilkan nota pembelian riwayat dengan ID: ${strukToView.id}`, 'green');
            showSection('pembelian', document.getElementById('navPembelian'), true);
        }
    }
}

async function deleteHistoryStruk(id, type) {
    showMessageBox(`Yakin ingin menghapus struk ${type} ini?`, true, async () => {
        if (type === 'penjualan') {
            const deletedStruk = salesHistory.find(s => s.id === id);
            if (deletedStruk && deletedStruk.items) {
                deletedStruk.items.forEach(item => {
                    const masterItem = masterItems.find(mi => mi.name === item.nama);
                    if (masterItem) masterItem.stock += item.qty;
                });
            }
            salesHistory = salesHistory.filter(s => s.id !== id);
            renderSalesHistory();
            showTemporaryAlert('Struk penjualan berhasil dihapus.', 'green');
        } else if (type === 'pembelian') {
            const deletedStruk = purchaseHistory.find(s => s.id === id);
            if (deletedStruk && deletedStruk.items) {
                deletedStruk.items.forEach(item => {
                    const masterItem = masterItems.find(mi => mi.name === item.nama);
                    if (masterItem) masterItem.stock -= item.qty;
                });
            }
            purchaseHistory = purchaseHistory.filter(s => s.id !== id);
            renderPurchaseHistory();
            showTemporaryAlert('Nota pembelian berhasil dihapus.', 'green');
        }
        await saveDataToFirestore();
        renderMasterItems();
    });
}

function renderPendingSales() {
    const pendingSalesListBody = document.querySelector('#pendingSalesList');
    pendingSalesListBody.innerHTML = pendingSales.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada transaksi pending.</td></tr>' : '';
    pendingSales.forEach(transaction => {
        const row = pendingSalesListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = transaction.id;
        row.insertCell(1).innerText = transaction.tanggal;
        row.insertCell(2).innerText = transaction.pembeli;
        row.insertCell(3).innerText = formatRupiah(transaction.totalPenjualan);
        const actionCell = row.insertCell(4);
        actionCell.classList.add('action-buttons', 'flex', 'gap-2', 'py-2');
        const continueButton = document.createElement('button');
        continueButton.innerText = 'Lanjutkan';
        continueButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        continueButton.onclick = () => loadPendingTransaction(transaction.id);
        actionCell.appendChild(continueButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deletePendingTransaction(transaction.id);
        actionCell.appendChild(deleteButton);
    });
}

async function loadPendingTransaction(id) {
    const transactionToLoad = pendingSales.find(t => t.id === id);
    if (transactionToLoad) {
        document.getElementById('namaToko').value = transactionToLoad.toko || '';
        document.getElementById('tanggalPenjualan').value = transactionToLoad.tanggal;
        document.getElementById('namaPembeli').value = transactionToLoad.pembeli;
        currentItems = JSON.parse(JSON.stringify(transactionToLoad.items));
        hitungUlangTotal('penjualan');
        renderTablePenjualan();
        showSection('penjualan', document.getElementById('navPenjualan'), true);
        showTemporaryAlert(`Transaksi pending dengan ID ${id} dimuat. Lanjutkan pembayaran.`, 'green');
        pendingSales = pendingSales.filter(t => t.id !== id);
        await saveDataToFirestore();
        renderPendingSales();
    }
}

async function deletePendingTransaction(id) {
    showMessageBox('Yakin ingin menghapus transaksi pending ini?', true, async () => {
        pendingSales = pendingSales.filter(t => t.id !== id);
        await saveDataToFirestore();
        renderPendingSales();
        showTemporaryAlert('Transaksi pending berhasil dihapus.', 'green');
    });
}

// Laporan Rugi Laba
function generateProfitLossReport() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const filterItemName = document.getElementById('filterItemName').value.toLowerCase();
    
    let filteredSalesHistory = salesHistory.filter(struk => {
        const strukDate = struk.tanggal;
        return (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
    });
    
    if (filterItemName) {
        filteredSalesHistory = filteredSalesHistory.filter(struk => struk.items.some(item => item.nama.toLowerCase().includes(filterItemName)));
    }
    
    const dailyProfitLoss = {};
    filteredSalesHistory.forEach(struk => {
        const date = struk.tanggal;
        if (!dailyProfitLoss[date]) dailyProfitLoss[date] = { totalPenjualan: 0, totalHargaBeli: 0, labaRugi: 0 };
        dailyProfitLoss[date].totalPenjualan += struk.totalPenjualan;
        let totalBeliTransaksi = struk.items.reduce((sum, item) => sum + (item.qty * (item.hargaBeli || 0)), 0);
        dailyProfitLoss[date].totalHargaBeli += totalBeliTransaksi;
        dailyProfitLoss[date].labaRugi += struk.totalLabaRugi;
    });

    const dailyProfitLossList = document.getElementById('dailyProfitLossList');
    dailyProfitLossList.innerHTML = '';
    let overallTotalFilteredProfitLoss = 0;
    
    const reportTitle = document.getElementById('profitLossReportTitle');
    if (filterItemName) {
        reportTitle.innerText = `Rugi Laba Harian (Barang: ${document.getElementById('filterItemName').value})`;
    } else {
        reportTitle.innerText = `Rugi Laba Harian`;
    }

    Object.keys(dailyProfitLoss).sort().forEach(date => {
        const data = dailyProfitLoss[date];
        const row = dailyProfitLossList.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = date;
        row.insertCell(1).innerText = formatRupiah(data.totalPenjualan);
        row.insertCell(2).innerText = formatRupiah(data.totalHargaBeli);
        row.insertCell(3).innerText = formatRupiah(data.labaRugi);
        overallTotalFilteredProfitLoss += data.labaRugi;
    });
    if (Object.keys(dailyProfitLoss).length === 0) dailyProfitLossList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada data.</td></tr>';
    document.getElementById('totalFilteredProfitLoss').innerText = formatRupiah(overallTotalFilteredProfitLoss);
}

function shareProfitLossViaWhatsApp() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const filterItemName = document.getElementById('filterItemName').value.trim();

    let message = `*Laporan Rugi Laba*\n`;
    if (startDate && endDate) {
        message += `Periode: ${startDate} s/d ${endDate}\n`;
    }
    if (filterItemName) {
        message += `Nama Barang: ${filterItemName}\n`;
    }
    message += `\n`;
    
    const reportTable = document.getElementById('dailyProfitLossList');
    for (let i = 0; i < reportTable.rows.length; i++) {
        const row = reportTable.rows[i];
        if (row.cells.length > 1) { 
            const date = row.cells[0].innerText;
            const labaRugi = row.cells[3].innerText;
            message += `Tanggal ${date}: ${labaRugi}\n`;
        }
    }

    const totalProfit = document.getElementById('totalFilteredProfitLoss').innerText;
    message += `\n*TOTAL LABA/RUGI: ${totalProfit}*\n`;
    message += `\n_Dibuat dengan Aplikasi Nota & Stok_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

// Perbaikan untuk fungsi download PDF
function downloadProfitLossPDF() {
    const element = document.getElementById('profitLossReportContainer');
    html2pdf(element, {
        margin: 10,
        filename: `Laporan_Rugi_Laba_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).then(() => {
        showTemporaryAlert('Laporan Rugi Laba berhasil diunduh!', 'green');
    }).catch(error => {
        console.error("PDF generation failed:", error);
        showTemporaryAlert('Gagal mengunduh Laporan Rugi Laba PDF.', 'red');
    });
}

// Laporan Stok Barang
function generateStockReport() {
    const stockReportList = document.getElementById('stockReportList');
    stockReportList.innerHTML = '';
    const stockFilterItemName = document.getElementById('stockFilterItemName').value.toLowerCase();
    const filteredMasterItems = masterItems.filter(item => item.name.toLowerCase().includes(stockFilterItemName));
    if (filteredMasterItems.length === 0) {
        stockReportList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada barang yang cocok.</td></tr>';
        return;
    }
    filteredMasterItems.forEach(item => {
        const row = stockReportList.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = item.stock || 0;
        row.insertCell(2).innerText = formatRupiah(item.price || 0);
        row.insertCell(3).innerText = formatRupiah(item.purchasePrice || 0);
    });
}

function shareStockReportViaWhatsApp() {
    const stockReportTable = document.getElementById('stockReportList');
    const filteredName = document.getElementById('stockFilterItemName').value.trim();
    
    let message = `*Laporan Stok Barang*\n`;
    if (filteredName) {
        message += `Filter: ${filteredName}\n\n`;
    }
    
    for (let i = 0; i < stockReportTable.rows.length; i++) {
        const row = stockReportTable.rows[i];
        const namaBarang = row.cells[0].innerText;
        const stok = row.cells[1].innerText;
        const hargaJual = row.cells[2].innerText;
        const hargaBeli = row.cells[3].innerText;
        
        message += `Nama: ${namaBarang}\n`;
        message += `Stok: ${stok}\n`;
        message += `Harga Jual: ${hargaJual}\n`;
        message += `Harga Beli: ${hargaBeli}\n\n`;
    }

    message += `_Dibuat dengan Aplikasi Nota & Stok_`;

    if (message.length > 2000) {
        showTemporaryAlert('Laporan terlalu panjang untuk WhatsApp, mohon gunakan fitur PDF.', 'red');
        return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

// Perbaikan untuk fungsi download PDF
function downloadStockReportPDF() {
    const element = document.getElementById('stockReportContainer');
    html2pdf(element, {
        margin: 10,
        filename: `Laporan_Stok_Barang_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).then(() => {
        showTemporaryAlert('Laporan Stok Barang berhasil diunduh!', 'green');
    }).catch(error => {
        console.error("PDF generation failed:", error);
        showTemporaryAlert('Gagal mengunduh Laporan Stok Barang PDF.', 'red');
    });
}

// Backup & Restore
function backupMasterItems() {
    if (masterItems.length === 0) {
        showTemporaryAlert('Tidak ada barang master untuk di-backup.', 'red');
        return;
    }
    const dataStr = JSON.stringify(masterItems, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master_barang_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showTemporaryAlert('Daftar barang master berhasil di-backup!', 'green');
}

function restoreMasterItems(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const loadedData = JSON.parse(e.target.result);
            if (Array.isArray(loadedData) && loadedData.every(item => typeof item.name === 'string')) {
                showMessageBox('Yakin ingin me-restore daftar barang master? Ini akan menimpa data yang ada.', true, async () => {
                    masterItems = loadedData;
                    await saveDataToFirestore();
                    renderMasterItems();
                    renderModalMasterItems();
                    showTemporaryAlert('Daftar barang master berhasil di-restore!', 'green');
                });
            } else {
                showTemporaryAlert('Format file JSON tidak valid.', 'red');
            }
        } catch (error) {
            showTemporaryAlert('Gagal membaca atau memproses file JSON. Error: ' + error.message, 'red');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Fungsi baru untuk koneksi Web Bluetooth
let printerDevice;
let printerCharacteristic;

async function connectToBluetoothPrinter() {
    try {
        showTemporaryAlert('Mencari perangkat Bluetooth...', 'green');
        // Filter untuk menemukan printer thermal umum
        const device = await navigator.bluetooth.requestDevice({
            filters: [{
                services: ['000018f0-0000-1000-8000-00805f9b34fb'] // UUID untuk Layanan Printer
            }, {
                services: ['000018f1-0000-1000-8000-00805f9b34fb'] // UUID lain jika diperlukan
            }, {
                namePrefix: 'MTP'
            }, {
                namePrefix: 'Printer'
            }, {
                namePrefix: 'BT-PRINTER'
            }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002af0-0000-1000-8000-00805f9b34fb');
        
        printerDevice = device;
        printerCharacteristic = characteristic;
        
        showTemporaryAlert(`Berhasil terhubung ke ${device.name}!`, 'green');
        return true;
    } catch (error) {
        console.error("Web Bluetooth Error:", error);
        showTemporaryAlert('Gagal terhubung ke printer. Pastikan Bluetooth aktif dan printer terdeteksi.', 'red');
        return false;
    }
}

async function printThermal() {
    const lastStruk = salesHistory[salesHistory.length - 1];
    if (!lastStruk) {
        showTemporaryAlert('Tidak ada struk untuk dicetak.', 'red');
        return;
    }
    
    // Periksa apakah sudah terhubung. Jika belum, coba hubungkan.
    if (!printerDevice || !printerDevice.gatt.connected) {
        const success = await connectToBluetoothPrinter();
        if (!success) {
            return;
        }
    }
    
    try {
        // Perintah ESC/POS
        let printerCommands = new Uint8Array([
            0x1B, 0x40, // ESC @ - Initialize printer
            0x1B, 0x61, 0x01, // ESC a 1 - Center align
            0x1B, 0x21, 0x01 // ESC ! 1 - Double height
        ]);
        
        // Nama Toko (ukuran besar)
        const namaToko = (lastStruk.toko || 'NAMA TOKO').toUpperCase() + '\n';
        printerCommands = concatenate(printerCommands, new TextEncoder().encode(namaToko));
        
        // Reset dan align kiri
        printerCommands = concatenate(printerCommands, new Uint8Array([
            0x1B, 0x21, 0x00, // ESC ! 0 - Normal font
            0x1B, 0x61, 0x00, // ESC a 0 - Left align
        ]));

        // Informasi Transaksi
        const infoStruk = `--------------------------------\n` +
                          `Tgl: ${lastStruk.tanggal}\n` +
                          `Pembeli: ${lastStruk.pembeli || 'Pelanggan'}\n` +
                          `--------------------------------\n`;
        printerCommands = concatenate(printerCommands, new TextEncoder().encode(infoStruk));

        // Daftar Barang
        lastStruk.items.forEach(item => {
            const line = `${item.nama}\n` +
                         `  ${item.qty} x ${formatRupiah(item.hargaSatuan)}\t${formatRupiah(item.jumlah)}\n`;
            printerCommands = concatenate(printerCommands, new TextEncoder().encode(line));
        });

        // Total
        const totalStruk = `--------------------------------\n` +
                           `TOTAL:\t\t${formatRupiah(lastStruk.totalPenjualan)}\n` +
                           `--------------------------------\n\n`;
        printerCommands = concatenate(printerCommands, new TextEncoder().encode(totalStruk));
        
        // Pesan penutup
        const closingMessage = `Terima kasih!\n` +
                               `Aplikasi Nota & Stok\n\n\n\n`;
        printerCommands = concatenate(printerCommands, new TextEncoder().encode(closingMessage));
        
        // Mengirim data ke printer dalam potongan kecil
        const chunkSize = 512;
        for (let i = 0; i < printerCommands.length; i += chunkSize) {
            const chunk = printerCommands.slice(i, i + chunkSize);
            await printerCharacteristic.writeValue(chunk);
        }
        
        showTemporaryAlert('Struk berhasil dicetak!', 'green');

    } catch (error) {
        console.error("Print Error:", error);
        showTemporaryAlert('Gagal mencetak. Error: ' + error.message, 'red');
    }
}

function concatenate(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}

// Custom Message Box
function showMessageBox(message, isConfirm = false, onConfirm = null) {
    const modal = document.getElementById('customMessageBox');
    document.getElementById('messageBoxText').innerText = message;
    const confirmBtn = document.getElementById('messageBoxConfirmBtn');
    const cancelBtn = document.getElementById('messageBoxCancelBtn');
    if (isConfirm) {
    
        confirmBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        confirmBtn.onclick = () => { closeMessageBox(); if (onConfirm) onConfirm(); };
        cancelBtn.onclick = () => closeMessageBox();
    } else {
        confirmBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'none';
        confirmBtn.onclick = () => { closeMessageBox(); if (onConfirm) onConfirm(); };
    }
    modal.style.display = 'flex';
}

function closeMessageBox() {
    const modal = document.getElementById('customMessageBox');
    modal.style.display = 'none';
}

// Custom Temporary Alert
function showTemporaryAlert(message, type) {
    let alertDiv = document.querySelector('.temporary-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.classList.add('temporary-alert');
        document.body.appendChild(alertDiv);
    }
    alertDiv.innerText = message;

    if (type === 'green') {
        alertDiv.style.backgroundColor = '#22c55e';
    } else if (type === 'red') {
        alertDiv.style.backgroundColor = '#ef4444';
    }

    alertDiv.style.opacity = '1';
    
    // Hilangkan alert setelah 3 detik
    setTimeout(() => {
        alertDiv.style.opacity = '0';
    }, 3000);
}

function loadNamaToko() {
    const storedNamaToko = localStorage.getItem('namaToko');
    if (storedNamaToko) {
        document.getElementById('namaToko').value = storedNamaToko;
    }
    document.getElementById('namaToko').addEventListener('input', () => {
        localStorage.setItem('namaToko', document.getElementById('namaToko').value);
    });
}
