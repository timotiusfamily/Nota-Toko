// Awal Kode Lengkap
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
let currentStrukData = null; 
let editingMasterItem = null; // Menyimpan objek item, bukan index
let currentDetailedSales = [];

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
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            
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

            document.getElementById('salesFilterStartDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            document.getElementById('salesFilterEndDate').value = formattedDate;
            
            document.getElementById('filterStartDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            document.getElementById('filterEndDate').value = formattedDate;

            document.getElementById('historyFilterStartDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            document.getElementById('historyFilterEndDate').value = formattedDate;

            document.getElementById('dailySalesList').addEventListener('click', (event) => {
                const row = event.target.closest('tr');
                if (row && row.cells.length > 1) {
                    const date = row.cells[0].innerText;
                    showSalesDetails(date);
                }
            });

        } else {
            window.location.href = 'login.html';
        }
    });
});

// --- Firebase and Firestore Management ---
async function loadDataFromFirestore() {
    try {
        const productsSnapshot = await db.collection('products').orderBy('name').get();
        masterItems = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Master items loaded from /products collection:", masterItems);

        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            salesHistory = userData.salesHistory || [];
            purchaseHistory = userData.purchaseHistory || [];
            pendingSales = userData.pendingSales || [];
        } else {
            console.log("No user-specific data found for user.");
        }

        renderMasterItems();
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        showMessageBox("Gagal memuat data dari server. Coba muat ulang halaman. Pastikan AdBlocker tidak aktif.");
    }
}

async function saveUserDataToFirestore() {
    try {
        const docRef = db.collection('users').doc(userId);
        await docRef.set({
            salesHistory: salesHistory,
            purchaseHistory: purchaseHistory,
            pendingSales: pendingSales
        }, { merge: true });
        console.log("User data (history, pending) saved to Firestore.");
    } catch (error) {
        console.error("Error saving user data:", error);
        showMessageBox("Gagal menyimpan data riwayat ke server.");
    }
}

async function addMasterItemToFirestore(itemData) {
    try {
        const docRef = await db.collection('products').add(itemData);
        console.log("New master item added with ID:", docRef.id);
        return { id: docRef.id, ...itemData }; 
    } catch (error) {
        console.error("Error adding master item:", error);
        showMessageBox("Gagal menambah barang baru ke database.");
        return null;
    }
}

async function updateMasterItemInFirestore(itemId, dataToUpdate) {
    try {
        await db.collection('products').doc(itemId).update(dataToUpdate);
        console.log(`Master item ${itemId} updated.`);
    } catch (error) {
        console.error(`Error updating master item ${itemId}:`, error);
        showMessageBox("Gagal memperbarui data barang di database.");
    }
}

async function deleteMasterItemFromFirestore(itemId) {
    try {
        await db.collection('products').doc(itemId).delete();
        console.log(`Master item ${itemId} deleted.`);
    } catch (error) {
        console.error(`Error deleting master item ${itemId}:`, error);
        showMessageBox("Gagal menghapus barang dari database.");
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
    if (isNaN(angka) || angka === null) return 'Rp. 0';
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

function showSection(sectionId, clickedButton, keepCurrentTransaction = false) {
    const sections = document.querySelectorAll('.main-content-wrapper.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    const activeSection = document.getElementById(`${sectionId}Section`);
    if (activeSection) {
        activeSection.style.display = 'block';
        activeSection.classList.add('active');
    }

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
        filterHistory();
    } else if (sectionId === 'pending') {
        renderPendingSales();
    } else if (sectionId === 'profitLoss') {
        generateProfitLossReport();
    } else if (sectionId === 'salesReport') {
        generateSalesReport();
    } else if (sectionId === 'stock') {
        generateStockReport();
    }
}

// --- Dashboard Management ---
function renderDashboard() {
    let totalSalesToday = 0;
    let totalProfitToday = 0;
    let totalPurchasesToday = 0;
    let totalStockValue = 0;

    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const salesToday = salesHistory.filter(struk => struk.tanggal === formattedToday);
    salesToday.forEach(struk => {
        totalSalesToday += struk.totalPenjualan || 0;
        totalProfitToday += struk.totalLabaRugi || 0;
    });

    const purchasesToday = purchaseHistory.filter(struk => struk.tanggal === formattedToday);
    purchasesToday.forEach(struk => {
        totalPurchasesToday += struk.totalPembelian || 0;
    });

    masterItems.forEach(item => {
        totalStockValue += (item.stock || 0) * (item.buyPrice || 0);
    });

    document.getElementById('dashboardTotalSales').innerText = formatRupiah(totalSalesToday);
    document.getElementById('dashboardTotalProfit').innerText = formatRupiah(totalProfitToday);
    document.getElementById('dashboardTotalPurchases').innerText = formatRupiah(totalPurchasesToday);
    document.getElementById('dashboardTotalStockValue').innerText = formatRupiah(totalStockValue);
}
// --- Penjualan Management ---
function tambahAtauUpdateBarangPenjualan() {
    const namaBarang = document.getElementById('namaBarangPenjualan').value.trim();
    const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPenjualan').value);
    const hargaSatuan = parseInt(document.getElementById('hargaSatuanPenjualan').value);
    const hargaBeli = parseInt(document.getElementById('hargaBeliPenjualan').value || '0');

    if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaSatuan)) {
        showTemporaryAlert('Mohon lengkapi Nama Barang, Kuantitas, dan Harga Jual.', 'red');
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
        document.getElementById('btnAddUpdatePenjualan').innerText = 'Tambah Barang';
        document.getElementById('btnCancelEditPenjualan').style.display = 'none';
    } else {
        itemCounter++;
        const newItem = { id: itemCounter, nama: namaBarang, qty: jumlahKuantitas, hargaSatuan: hargaSatuan, hargaBeli: hargaBeli, jumlah: jumlah, labaRugi: labaRugi };
        currentItems.push(newItem);
    }
    
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

function renderStrukPreviewPenjualan(strukData) {
    currentStrukData = strukData; 

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

async function selesaikanPembayaran() {
    if (currentItems.length === 0) {
        showTemporaryAlert('Tambahkan barang terlebih dahulu.', 'red');
        return;
    }

    for (const item of currentItems) {
        const masterItem = masterItems.find(mi => mi.name.toLowerCase() === item.nama.toLowerCase());
        if (masterItem) {
            const newStock = (masterItem.stock || 0) - item.qty;
            masterItem.stock = newStock; 
            await updateMasterItemInFirestore(masterItem.id, { stock: newStock }); 
        }
    }
    renderMasterItems(); 

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
    await saveUserDataToFirestore();

    renderStrukPreviewPenjualan(newStruk);
    document.getElementById('printerCard').style.display = 'block';

    downloadStrukJPG();
    
    showTemporaryAlert('Pembayaran berhasil dan struk akan diunduh!', 'green');
    generateStockReport();
}

function downloadStrukJPG() {
    const strukOutput = document.getElementById('strukOutputPenjualan');
    if (!strukOutput || !strukOutput.innerHTML.trim()) {
        showTemporaryAlert('Tidak ada struk untuk diunduh.', 'red');
        return;
    }

    html2canvas(strukOutput, {
        scale: 3, 
        backgroundColor: '#ffffff'
    }).then(canvas => {
        canvas.toBlob(function(blob) {
            const fileName = `struk_penjualan_${new Date().toISOString().slice(0, 10)}.jpg`;
            saveAs(blob, fileName);
            showTemporaryAlert('Struk berhasil diunduh sebagai JPG!', 'green');
        }, 'image/jpeg', 0.9);
    }).catch(error => {
        console.error("Gagal membuat gambar dari canvas:", error);
        showTemporaryAlert('Gagal mengunduh struk JPG.', 'red');
    });
}


function cetakStruk() {
    if (!currentStrukData) {
        showTemporaryAlert('Tidak ada data struk untuk dicetak.', 'red');
        return;
    }

    const struk = currentStrukData;
    let receiptText = "";
    const centerText = (text) => {
        const width = 32;
        if (text.length >= width) return text;
        const spaces = Math.floor((width - text.length) / 2);
        return ' '.repeat(spaces) + text;
    };
    const createLine = (left, right) => {
        const width = 32;
        const spaces = width - left.length - right.length;
        return left + ' '.repeat(spaces > 0 ? spaces : 1) + right;
    };
    
    receiptText += centerText(struk.toko || 'NAMA TOKO') + '\n\n';
    receiptText += `Tgl: ${struk.tanggal}\n`;
    receiptText += `Pembeli: ${struk.pembeli || 'Pelanggan'}\n`;
    receiptText += '--------------------------------\n';
    struk.items.forEach(item => {
        receiptText += `${item.nama}\n`;
        const hargaLine = `${item.qty} x ${item.hargaSatuan.toLocaleString('id-ID')}`;
        receiptText += createLine(hargaLine, item.jumlah.toLocaleString('id-ID')) + '\n';
    });
    receiptText += '--------------------------------\n';
    receiptText += createLine('TOTAL:', struk.totalPenjualan.toLocaleString('id-ID')) + '\n\n';
    receiptText += centerText('Terima Kasih') + '\n';
    
    if (typeof Android !== 'undefined' && Android.print) {
        Android.print(receiptText);
    } else {
        showTemporaryAlert("Fitur cetak hanya tersedia di aplikasi Android.", 'red');
        console.log("--- Struk untuk Dicetak ---");
        console.log(receiptText);
    }
}


function shareViaWhatsAppPenjualan() {
    if (!currentStrukData) {
        showTemporaryAlert('Tidak ada struk untuk dibagikan.', 'red');
        return;
    }

    const namaToko = currentStrukData.toko || 'Nama Toko';
    const tanggal = currentStrukData.tanggal;
    const namaPembeli = currentStrukData.pembeli || 'Pelanggan Yth.';
    const totalPenjualan = formatRupiah(currentStrukData.totalPenjualan);

    let message = `*NOTA PENJUALAN*\n\n*${namaToko}*\nTgl: ${tanggal}\nPembeli: ${namaPembeli}\n--------------------------------\n*Daftar Barang:*\n`;
    message += currentStrukData.items.map(item => 
        `${item.nama} (${item.qty} x ${formatRupiah(item.hargaSatuan)}) = ${formatRupiah(item.jumlah)}`
    ).join('\n');
    message += `\n--------------------------------\n*TOTAL: ${totalPenjualan}*\n\n_Terima kasih telah berbelanja!_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

// --- Pembelian Management ---
async function tambahAtauUpdateBarangPembelian() {
    const namaBarang = document.getElementById('namaBarangPembelian').value.trim();
    const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPembelian').value);
    const hargaBeli = parseInt(document.getElementById('hargaBeliPembelian').value);
    const hargaJual = parseInt(document.getElementById('hargaJualPembelian').value);

    if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaBeli) || isNaN(hargaJual)) {
        showTemporaryAlert('Lengkapi semua field: Nama, Kuantitas, Harga Beli, dan Harga Jual.', 'red');
        return;
    }
    if (jumlahKuantitas <= 0 || hargaBeli < 0 || hargaJual < 0) {
        showTemporaryAlert('Kuantitas dan Harga tidak boleh negatif atau nol.', 'red');
        return;
    }
    
    const jumlah = jumlahKuantitas * hargaBeli;

    if (editingItemId !== null) {
        const itemIndex = currentItems.findIndex(item => item.id === editingItemId);
        if (itemIndex > -1) {
            currentItems[itemIndex] = { ...currentItems[itemIndex], nama: namaBarang, qty: jumlahKuantitas, hargaBeli: hargaBeli, hargaJual: hargaJual, jumlah: jumlah };
        }
        editingItemId = null;
        document.getElementById('btnAddUpdatePembelian').innerText = 'Tambah Barang';
        document.getElementById('btnCancelEditPembelian').style.display = 'none';
    } else {
        itemCounter++;
        const newItem = { id: itemCounter, nama: namaBarang, qty: jumlahKuantitas, hargaBeli: hargaBeli, jumlah: jumlah, hargaJual: hargaJual };
        currentItems.push(newItem);
    }
    
    hitungUlangTotal('pembelian');
    renderTablePembelian();
    clearBarangInputs('pembelian');
}

async function simpanNotaPembelian() {
    if (currentItems.length === 0) {
        showTemporaryAlert('Tidak ada barang untuk disimpan.', 'red');
        return;
    }
    
    for (const item of currentItems) {
        let masterItem = masterItems.find(mi => mi.name.toLowerCase() === item.nama.toLowerCase());
        if (masterItem) { 
            const oldStock = masterItem.stock || 0;
            const oldBuyPrice = masterItem.buyPrice || 0;
            const newStock = oldStock + item.qty;
            const newBuyPrice = ((oldStock * oldBuyPrice) + (item.qty * item.hargaBeli)) / newStock;
            
            masterItem.stock = newStock;
            masterItem.buyPrice = Math.round(newBuyPrice); 
            masterItem.sellPrice = item.hargaJual;

            await updateMasterItemInFirestore(masterItem.id, {
                stock: newStock,
                buyPrice: Math.round(newBuyPrice),
                sellPrice: item.hargaJual
            });
        } else { 
            const newItemData = {
                name: item.nama,
                sellPrice: item.hargaJual,
                buyPrice: item.hargaBeli,
                stock: item.qty
            };
            const addedItem = await addMasterItemToFirestore(newItemData);
            if (addedItem) {
                masterItems.push(addedItem); 
            }
        }
    }
    renderMasterItems();

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
    await saveUserDataToFirestore();

    renderStrukPreviewPembelian(newStruk);
    document.getElementById('strukOutputPembelian').style.display = 'block';
    document.getElementById('shareButtonsPembelian').style.display = 'flex';
    
    showTemporaryAlert('Nota pembelian berhasil disimpan!', 'green');
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
function renderMasterItems() {
    const masterItemsListBody = document.querySelector('#masterItemsList');
    masterItemsListBody.innerHTML = '';
    if (masterItems.length === 0) {
        masterItemsListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada barang master.</td></tr>';
        return;
    }
    const sortedItems = [...masterItems].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedItems.forEach(item => {
        const row = masterItemsListBody.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = formatRupiah(item.sellPrice || 0);
        row.insertCell(2).innerText = formatRupiah(item.buyPrice || 0);
        row.insertCell(3).innerText = item.stock || 0;
        const actionCell = row.insertCell(4);
        actionCell.classList.add('master-item-actions', 'flex', 'gap-2', 'py-2');
        const editButton = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        editButton.onclick = () => editMasterItemInModal(item);
        actionCell.appendChild(editButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteMasterItem(item);
        actionCell.appendChild(deleteButton);
    });
}

function editMasterItemInModal(item) {
    if (item) {
        editingMasterItem = item; 
        document.getElementById('editMasterItemName').value = item.name;
        document.getElementById('editMasterItemSellingPrice').value = item.sellPrice;
        document.getElementById('editMasterItemPurchasePrice').value = item.buyPrice;
        document.getElementById('editMasterItemStock').value = item.stock;
        document.getElementById('editMasterItemModal').style.display = 'flex';
    }
}

async function saveEditedMasterItem() {
    if (!editingMasterItem) return;
    
    const name = document.getElementById('editMasterItemName').value.trim();
    const sellingPrice = parseInt(document.getElementById('editMasterItemSellingPrice').value);
    const purchasePrice = parseInt(document.getElementById('editMasterItemPurchasePrice').value);
    const stock = parseInt(document.getElementById('editMasterItemStock').value);
    
    if (!name || isNaN(sellingPrice) || isNaN(purchasePrice) || isNaN(stock)) {
        showTemporaryAlert('Mohon lengkapi semua field.', 'red');
        return;
    }
    
    const updatedData = {
        name: name,
        sellPrice: sellingPrice,
        buyPrice: purchasePrice,
        stock: stock
    };
    
    await updateMasterItemInFirestore(editingMasterItem.id, updatedData);

    const itemIndex = masterItems.findIndex(item => item.id === editingMasterItem.id);
    if (itemIndex > -1) {
        masterItems[itemIndex] = { id: editingMasterItem.id, ...updatedData };
    }
    
    renderMasterItems();
    closeEditMasterItemModal();
    showTemporaryAlert('Barang master berhasil diperbarui.', 'green');
}

function closeEditMasterItemModal() {
    document.getElementById('editMasterItemModal').style.display = 'none';
    editingMasterItem = null;
}

function deleteMasterItem(itemToDelete) {
    showMessageBox(`Yakin ingin menghapus "${itemToDelete.name}"?`, true, async () => {
        await deleteMasterItemFromFirestore(itemToDelete.id);
        masterItems = masterItems.filter(item => item.id !== itemToDelete.id); 
        renderMasterItems();
        renderModalMasterItems();
        showTemporaryAlert('Barang master berhasil dihapus.', 'green');
    });
}

async function clearMasterItems() {
    showMessageBox('Yakin ingin menghapus SEMUA daftar barang master? Tindakan ini tidak bisa dibatalkan.', true, async () => {
        for (const item of masterItems) {
            await deleteMasterItemFromFirestore(item.id);
        }
        masterItems = []; 
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
        suggestionItem.innerText = `${item.name} (Jual: ${formatRupiah(item.sellPrice || 0)} | Beli: ${formatRupiah(item.buyPrice || 0)})`;
        suggestionItem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputElement.value = item.name;
            if (type === 'penjualan') {
                document.getElementById('hargaSatuanPenjualan').value = item.sellPrice;
                document.getElementById('hargaBeliPenjualan').value = item.buyPrice;
                document.getElementById('jumlahKuantitasPenjualan').focus();
            } else {
                document.getElementById('hargaBeliPembelian').value = item.buyPrice;
                document.getElementById('hargaJualPembelian').value = item.sellPrice;
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
        row.insertCell(1).innerText = formatRupiah(item.sellPrice || 0);
        row.insertCell(2).innerText = formatRupiah(item.buyPrice || 0);
        row.insertCell(3).innerText = item.stock || 0;
        const selectCell = row.insertCell(4);
        const selectButton = document.createElement('button');
        selectButton.innerText = 'Pilih';
        selectButton.classList.add('bg-green-500', 'hover:bg-green-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        selectButton.onclick = () => selectMasterItemFromModal(item.name, item.sellPrice, item.buyPrice);
        selectCell.appendChild(selectButton);
    });
}
document.getElementById('masterItemSearchInput').addEventListener('input', renderModalMasterItems);

function selectMasterItemFromModal(name, sellingPrice, buyingPrice) {
    if (currentTransactionType === 'penjualan') {
        document.getElementById('namaBarangPenjualan').value = name;
        document.getElementById('hargaSatuanPenjualan').value = sellingPrice;
        document.getElementById('hargaBeliPenjualan').value = buyingPrice;
        document.getElementById('jumlahKuantitasPenjualan').focus();
    } else if (currentTransactionType === 'pembelian') {
        document.getElementById('namaBarangPembelian').value = name;
        document.getElementById('hargaBeliPembelian').value = buyingPrice;
        document.getElementById('hargaJualPembelian').value = sellingPrice;
        document.getElementById('jumlahKuantitasPembelian').value = '';
        document.getElementById('jumlahKuantitasPembelian').focus();
    }
    closeMasterItemModal();
}

// --- History, Pending, Profit/Loss, Stock Reports ---
function filterHistory() {
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
    showMessageBox('Yakin ingin menghapus SEMUA riwayat penjualan? Stok TIDAK akan dikembalikan.', true, async () => {
        salesHistory = [];
        await saveUserDataToFirestore();
        filterHistory();
        showTemporaryAlert('Semua riwayat penjualan telah dihapus.', 'green');
    });
}
async function clearPurchaseHistory() {
    showMessageBox('Yakin ingin menghapus SEMUA riwayat pembelian? Stok TIDAK akan dikembalikan.', true, async () => {
        purchaseHistory = [];
        await saveUserDataToFirestore();
        filterHistory();
        showTemporaryAlert('Semua riwayat pembelian telah dihapus.', 'green');
    });
}
async function clearPendingSales() {
    showMessageBox('Yakin ingin menghapus SEMUA transaksi pending?', true, async () => {
        pendingSales = [];
        await saveUserDataToFirestore();
        renderPendingSales();
        showTemporaryAlert('Semua transaksi pending telah dihapus.', 'green');
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
    showMessageBox(`Yakin ingin menghapus struk ${type} ini? Stok akan dikembalikan/dikurangi.`, true, async () => {
        if (type === 'penjualan') {
            const strukIndex = salesHistory.findIndex(s => s.id === id);
            if (strukIndex > -1) {
                const deletedStruk = salesHistory[strukIndex];
                if (deletedStruk && deletedStruk.items) {
                    for(const item of deletedStruk.items) {
                        const masterItem = masterItems.find(mi => mi.name === item.nama);
                        if (masterItem) {
                            const newStock = (masterItem.stock || 0) + item.qty;
                            await updateMasterItemInFirestore(masterItem.id, {stock: newStock});
                            masterItem.stock = newStock;
                        }
                    }
                }
                salesHistory.splice(strukIndex, 1);
                showTemporaryAlert('Struk penjualan berhasil dihapus & stok dikembalikan.', 'green');
            }
        } else if (type === 'pembelian') {
             const strukIndex = purchaseHistory.findIndex(s => s.id === id);
            if (strukIndex > -1) {
                const deletedStruk = purchaseHistory[strukIndex];
                if (deletedStruk && deletedStruk.items) {
                    for(const item of deletedStruk.items) {
                        const masterItem = masterItems.find(mi => mi.name === item.nama);
                        if (masterItem) {
                            const newStock = (masterItem.stock || 0) - item.qty;
                             await updateMasterItemInFirestore(masterItem.id, {stock: newStock});
                            masterItem.stock = newStock;
                        }
                    }
                }
                purchaseHistory.splice(strukIndex, 1);
                showTemporaryAlert('Nota pembelian berhasil dihapus & stok dikurangi.', 'green');
            }
        }
        await saveUserDataToFirestore();
        renderMasterItems();
        filterHistory();
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
        await saveUserDataToFirestore();
        renderPendingSales();
    }
}

async function deletePendingTransaction(id) {
    showMessageBox('Yakin ingin menghapus transaksi pending ini?', true, async () => {
        pendingSales = pendingSales.filter(t => t.id !== id);
        await saveUserDataToFirestore();
        renderPendingSales();
        showTemporaryAlert('Transaksi pending berhasil dihapus.', 'green');
    });
}

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

function generateSalesReport() {
    const startDate = document.getElementById('salesFilterStartDate').value;
    const endDate = document.getElementById('salesFilterEndDate').value;
    const filterName = document.getElementById('salesFilterName').value.toLowerCase();
    
    let filteredSales = salesHistory.filter(struk => {
        const strukDate = struk.tanggal;
        const dateMatch = (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
        const nameMatch = !filterName || (struk.pembeli && struk.pembeli.toLowerCase().includes(filterName));
        return dateMatch && nameMatch;
    });

    const reportData = {};
    let overallTotalSales = 0;

    filteredSales.forEach(struk => {
        const date = struk.tanggal;
        if (!reportData[date]) {
            reportData[date] = {
                sales: [],
                purchases: [],
                totalPenjualan: 0,
                totalLabaRugi: 0,
                totalPembelian: 0
            };
        }
        reportData[date].sales.push(struk);
        reportData[date].totalPenjualan += struk.totalPenjualan;
        reportData[date].totalLabaRugi += struk.totalLabaRugi;
        overallTotalSales += struk.totalPenjualan;
    });

    purchaseHistory.filter(struk => {
        const strukDate = struk.tanggal;
        const dateMatch = (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
        const nameMatch = !filterName || (struk.supplier && struk.supplier.toLowerCase().includes(filterName));
        return dateMatch && nameMatch;
    }).forEach(struk => {
        const date = struk.tanggal;
        if (!reportData[date]) {
            reportData[date] = {
                sales: [],
                purchases: [],
                totalPenjualan: 0,
                totalLabaRugi: 0,
                totalPembelian: 0
            };
        }
        reportData[date].purchases.push(struk);
        reportData[date].totalPembelian += struk.totalPembelian;
    });


    const dailySalesList = document.getElementById('dailySalesList');
    dailySalesList.innerHTML = '';
    
    Object.keys(reportData).sort().forEach(date => {
        const data = reportData[date];
        const row = dailySalesList.insertRow();
        row.classList.add('hover:bg-gray-50', 'cursor-pointer');
        row.insertCell(0).innerText = date;
        row.insertCell(1).innerText = formatRupiah(data.totalPenjualan);
        row.insertCell(2).innerText = formatRupiah(data.totalLabaRugi);
        const actionCell = row.insertCell(3);
        const viewButton = document.createElement('button');
        viewButton.innerText = 'Lihat Detail';
        viewButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        viewButton.onclick = () => showSalesDetails(date);
        actionCell.appendChild(viewButton);
    });
    
    if (Object.keys(reportData).length === 0) dailySalesList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada data.</td></tr>';
    document.getElementById('totalFilteredSales').innerText = formatRupiah(overallTotalSales);

    hideSalesDetails();
}

function showSalesDetails(date) {
    const detailContainer = document.getElementById('salesDetailContainer');
    const detailContent = document.getElementById('salesDetailContent');
    document.getElementById('salesDetailDate').innerText = date;
    
    const salesForDate = salesHistory.filter(struk => struk.tanggal === date);
    const purchasesForDate = purchaseHistory.filter(struk => struk.tanggal === date);
    
    currentDetailedSales = { sales: salesForDate, purchases: purchasesForDate, date: date };
    
    detailContent.innerHTML = '';

    let totalSalesHarian = 0;
    let totalLabaHarian = 0;
    let totalPembelianHarian = 0;
    
    if (salesForDate.length > 0) {
        detailContent.innerHTML += `<h4 class="text-lg font-bold mb-2">Detail Penjualan:</h4>`;
        salesForDate.forEach(struk => {
            let salesHtml = `
                <div class="border-b border-dashed border-gray-300 mb-4 pb-4">
                    <p class="font-bold">ID Nota: ${struk.id}</p>
                    <p>Pembeli: ${struk.pembeli || 'Pelanggan Yth.'}</p>
                    <p>Total Penjualan: ${formatRupiah(struk.totalPenjualan)}</p>
                    <p class="mb-2">Total Laba/Rugi: ${formatRupiah(struk.totalLabaRugi)}</p>
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="py-2 px-1 text-left">Nama</th>
                                <th class="py-2 px-1 text-left">Qty</th>
                                <th class="py-2 px-1 text-left">Harga Jual</th>
                                <th class="py-2 px-1 text-left">Laba/Rugi</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            struk.items.forEach(item => {
                salesHtml += `
                            <tr>
                                <td class="py-1 px-1">${item.nama}</td>
                                <td class="py-1 px-1">${item.qty}</td>
                                <td class="py-1 px-1">${formatRupiah(item.hargaSatuan)}</td>
                                <td class="py-1 px-1">${formatRupiah(item.labaRugi)}</td>
                            </tr>
                `;
            });
            salesHtml += `</tbody></table></div>`;
            detailContent.innerHTML += salesHtml;
            totalSalesHarian += struk.totalPenjualan;
            totalLabaHarian += struk.totalLabaRugi;
        });
    }

    if (purchasesForDate.length > 0) {
        detailContent.innerHTML += `<h4 class="text-lg font-bold mb-2">Detail Pembelian:</h4>`;
        purchasesForDate.forEach(struk => {
            let purchaseHtml = `
                <div class="border-b border-dashed border-gray-300 mb-4 pb-4">
                    <p class="font-bold">ID Nota: ${struk.id}</p>
                    <p>Supplier: ${struk.supplier || 'Supplier Yth.'}</p>
                    <p class="mb-2">Total Pembelian: ${formatRupiah(struk.totalPembelian)}</p>
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="py-2 px-1 text-left">Nama</th>
                                <th class="py-2 px-1 text-left">Qty</th>
                                <th class="py-2 px-1 text-left">Harga Beli</th>
                                <th class="py-2 px-1 text-left">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            struk.items.forEach(item => {
                purchaseHtml += `
                            <tr>
                                <td class="py-1 px-1">${item.nama}</td>
                                <td class="py-1 px-1">${item.qty}</td>
                                <td class="py-1 px-1">${formatRupiah(item.hargaBeli)}</td>
                                <td class="py-1 px-1">${formatRupiah(item.jumlah)}</td>
                            </tr>
                `;
            });
            purchaseHtml += `</tbody></table></div>`;
            detailContent.innerHTML += purchaseHtml;
            totalPembelianHarian += struk.totalPembelian;
        });
    }
    
    if (salesForDate.length === 0 && purchasesForDate.length === 0) {
        detailContent.innerHTML = `<p class="text-center text-gray-500">Tidak ada detail transaksi untuk tanggal ini.</p>`;
    }

    document.getElementById('salesReportContainer').classList.add('hidden');
    detailContainer.classList.remove('hidden');
}

function hideSalesDetails() {
    document.getElementById('salesDetailContainer').classList.add('hidden');
    document.getElementById('salesReportContainer').classList.remove('hidden');
}

function shareSalesReportViaWhatsApp() {
    const startDate = document.getElementById('salesFilterStartDate').value;
    const endDate = document.getElementById('salesFilterEndDate').value;
    const filterName = document.getElementById('salesFilterName').value.trim();

    let message = `*Laporan Penjualan*\n`;
    if (startDate && endDate) {
        message += `Periode: ${startDate} s/d ${endDate}\n`;
    }
    if (filterName) {
        message += `Nama Pembeli: ${filterName}\n`;
    }
    message += `\n`;
    
    const reportTable = document.getElementById('dailySalesList');
    for (let i = 0; i < reportTable.rows.length; i++) {
        const row = reportTable.rows[i];
        if (row.cells.length > 1) { 
            const date = row.cells[0].innerText;
            const totalPenjualan = row.cells[1].innerText;
            const totalLabaRugi = row.cells[2].innerText;
            message += `Tanggal ${date}: Total Jual: ${totalPenjualan}, Laba: ${totalLabaRugi}\n`;
        }
    }

    const totalSales = document.getElementById('totalFilteredSales').innerText;
    message += `\n*TOTAL PENJUALAN: ${totalSales}*\n`;
    message += `\n_Dibuat dengan Aplikasi Nota & Stok_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function downloadSalesReportPDF() {
    const element = document.getElementById('salesReportContainer');
    html2pdf(element, {
        margin: 10,
        filename: `Laporan_Penjualan_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).then(() => {
        showTemporaryAlert('Laporan Penjualan berhasil diunduh!', 'green');
    }).catch(error => {
        console.error("PDF generation failed:", error);
        showTemporaryAlert('Gagal mengunduh Laporan Penjualan PDF.', 'red');
    });
}

function shareSalesDetailsViaWhatsApp() {
    if (!currentDetailedSales.date) {
        showTemporaryAlert('Tidak ada detail transaksi untuk dibagikan.', 'red');
        return;
    }

    let message = `*Detail Transaksi Tanggal ${currentDetailedSales.date}*\n\n`;

    if (currentDetailedSales.sales.length > 0) {
        message += `*Detail Penjualan:*\n`;
        currentDetailedSales.sales.forEach(struk => {
            message += `_Nota ID: ${struk.id}, Pembeli: ${struk.pembeli || 'Pelanggan Yth.'}, Total Jual: ${formatRupiah(struk.totalPenjualan)}, Laba: ${formatRupiah(struk.totalLabaRugi)}_ \n`;
            struk.items.forEach(item => {
                message += `${item.nama} (${item.qty} x ${formatRupiah(item.hargaSatuan)}) = ${formatRupiah(item.jumlah)} (Laba: ${formatRupiah(item.labaRugi)})\n`;
            });
        });
        message += `\n`;
    }

    if (currentDetailedSales.purchases.length > 0) {
        message += `*Detail Pembelian:*\n`;
        currentDetailedSales.purchases.forEach(struk => {
            message += `_Nota ID: ${struk.id}, Supplier: ${struk.supplier || 'Supplier Yth.'}, Total Beli: ${formatRupiah(struk.totalPembelian)}_ \n`;
            struk.items.forEach(item => {
                message += `${item.nama} (${item.qty} x ${formatRupiah(item.hargaBeli)}) = ${formatRupiah(item.jumlah)}\n`;
            });
        });
        message += `\n`;
    }

    message += `_Dibuat dengan Aplikasi Nota & Stok_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function downloadSalesDetailsPDF() {
    if (!currentDetailedSales.date) {
        showTemporaryAlert('Tidak ada detail transaksi untuk diunduh.', 'red');
        return;
    }
    
    const element = document.getElementById('salesDetailContent');
    const filename = `Detail_Transaksi_${currentDetailedSales.date}.pdf`;
    
    html2pdf(element, {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).then(() => {
        showTemporaryAlert('Detail transaksi berhasil diunduh!', 'green');
    }).catch(error => {
        console.error("PDF generation failed:", error);
        showTemporaryAlert('Gagal mengunduh detail PDF.', 'red');
    });
}

function generateStockReport() {
    const stockReportList = document.getElementById('stockReportList');
    stockReportList.innerHTML = '';
    const stockFilterItemName = document.getElementById('stockFilterItemName').value.toLowerCase();
    const filteredMasterItems = masterItems.filter(item => item.name.toLowerCase().includes(stockFilterItemName));
    if (filteredMasterItems.length === 0) {
        stockReportList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada barang yang cocok.</td></tr>';
        return;
    }
    const sortedItems = [...filteredMasterItems].sort((a,b) => a.name.localeCompare(b.name));
    sortedItems.forEach(item => {
        const row = stockReportList.insertRow();
        row.classList.add('hover:bg-gray-50');
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = item.stock || 0;
        row.insertCell(2).innerText = formatRupiah(item.sellPrice || 0);
        row.insertCell(3).innerText = formatRupiah(item.buyPrice || 0);
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

async function restoreMasterItems(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const loadedData = JSON.parse(e.target.result);
            if (Array.isArray(loadedData) && loadedData.every(item => typeof item.name === 'string' && typeof item.sellPrice === 'number')) {
                showMessageBox('Yakin ingin me-restore? Ini akan MENGHAPUS semua barang master yang ada dan menggantinya dengan data dari file.', true, async () => {
                    for(const item of masterItems){
                        await deleteMasterItemFromFirestore(item.id);
                    }
                    
                    const newItems = [];
                    for(const item of loadedData){
                        const newItemData = {
                            name: item.name,
                            sellPrice: item.sellPrice || 0,
                            buyPrice: item.buyPrice || 0,
                            stock: item.stock || 0
                        };
                        const addedItem = await addMasterItemToFirestore(newItemData);
                        if(addedItem) newItems.push(addedItem);
                    }

                    masterItems = newItems; 
                    
                    renderMasterItems();
                    renderModalMasterItems();
                    showTemporaryAlert('Barang master berhasil di-restore!', 'green');
                });
            } else {
                showTemporaryAlert('Format file JSON tidak valid. Pastikan ada properti "name" (string) dan "sellPrice" (number).', 'red');
            }
        } catch (error) {
            showTemporaryAlert('Gagal membaca file JSON. Error: ' + error.message, 'red');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
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
// Akhir Kode Lengkap
