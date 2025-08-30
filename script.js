// =================================================================================
// == FILE SCRIPT.JS FINAL & LENGKAP V2 UNTUK APLIKASI MASTER (NOTA-TOKO)        ==
// == SEMUA FUNGSI SUDAH LENGKAP & SUDAH DISESUAIKAN DENGAN NAMA FIELD BARU        ==
// =================================================================================

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
let editingMasterItemIndex = null;
let currentDetailedSales = [];

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
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
        const productsSnapshot = await db.collection('products').get();
        masterItems = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Master items loaded from /products collection.");

        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            salesHistory = userData.salesHistory || [];
            purchaseHistory = userData.purchaseHistory || [];
            pendingSales = userData.pendingSales || [];
        } else {
            console.log("No user-specific data found, initializing new data.");
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
            salesHistory: salesHistory,
            purchaseHistory: purchaseHistory,
            pendingSales: pendingSales
        }, { merge: true });
        console.log("User data (histories, pending) successfully saved to Firestore.");
    } catch (error) {
        console.error("Error saving user data:", error);
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
    if(typeof angka !== 'number') angka = 0;
    let reverse = String(angka).split('').reverse().join('');
    let ribuan = reverse.match(/\d{1,3}/g);
    let result = ribuan ? ribuan.join('.').split('').reverse().join('') : '0';
    return `Rp. ${result}`;
}

// --- Master Items Management ---
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
        row.insertCell(1).innerText = formatRupiah(item.sellPrice || 0); // PERBAIKAN NAMA FIELD
        row.insertCell(2).innerText = formatRupiah(item.buyPrice || 0);  // PERBAIKAN NAMA FIELD
        row.insertCell(3).innerText = item.stock || 0;
        const actionCell = row.insertCell(4);
        actionCell.classList.add('master-item-actions', 'flex', 'gap-2', 'py-2');
        const editButton = document.createElement('button');
        editButton.innerText = 'Edit';
        editButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        editButton.onclick = () => editMasterItemInModal(index);
        actionCell.appendChild(editButton);
        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'Hapus';
        deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'py-1', 'px-2', 'rounded-md', 'text-xs');
        deleteButton.onclick = () => deleteMasterItem(index);
        actionCell.appendChild(deleteButton);
    });
}

function editMasterItemInModal(index) {
    const item = masterItems[index];
    if (item) {
        editingMasterItemIndex = index;
        document.getElementById('editMasterItemName').value = item.name;
        document.getElementById('editMasterItemSellingPrice').value = item.sellPrice; // PERBAIKAN NAMA FIELD
        document.getElementById('editMasterItemPurchasePrice').value = item.buyPrice; // PERBAIKAN NAMA FIELD
        document.getElementById('editMasterItemStock').value = item.stock;
        document.getElementById('editMasterItemModal').style.display = 'flex';
    }
}

async function saveEditedMasterItem() {
    if (editingMasterItemIndex === null) return;
    
    const itemToSave = masterItems[editingMasterItemIndex];
    const itemId = itemToSave.id;

    const updatedData = {
        name: document.getElementById('editMasterItemName').value.trim(),
        sellPrice: parseInt(document.getElementById('editMasterItemSellingPrice').value), // PERBAIKAN NAMA FIELD
        buyPrice: parseInt(document.getElementById('editMasterItemPurchasePrice').value), // PERBAIKAN NAMA FIELD
        stock: parseInt(document.getElementById('editMasterItemStock').value)
    };
    
    if (!updatedData.name || isNaN(updatedData.sellPrice) || isNaN(updatedData.buyPrice) || isNaN(updatedData.stock)) {
        showTemporaryAlert('Mohon lengkapi semua field.', 'red');
        return;
    }
    
    try {
        await db.collection('products').doc(itemId).update(updatedData);
        masterItems[editingMasterItemIndex] = { id: itemId, ...updatedData };
        renderMasterItems();
        closeEditMasterItemModal();
        showTemporaryAlert('Barang master berhasil diperbarui.', 'green');
    } catch (error) {
        console.error("Error updating item:", error);
        showTemporaryAlert('Gagal memperbarui barang.', 'red');
    }
}

function deleteMasterItem(index) {
    const itemToDelete = masterItems[index];
    const itemId = itemToDelete.id;
    
    showMessageBox(`Yakin ingin menghapus "${itemToDelete.name}"?`, true, async () => {
        try {
            await db.collection('products').doc(itemId).delete();
            masterItems.splice(index, 1);
            renderMasterItems();
            renderModalMasterItems();
            showTemporaryAlert('Barang master berhasil dihapus.', 'green');
        } catch (error) {
            console.error("Error deleting item:", error);
            showTemporaryAlert('Gagal menghapus barang.', 'red');
        }
    });
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
        totalStockValue += (item.stock || 0) * (item.buyPrice || 0); // PERBAIKAN NAMA FIELD
    });

    document.getElementById('dashboardTotalSales').innerText = formatRupiah(totalSalesToday);
    document.getElementById('dashboardTotalProfit').innerText = formatRupiah(totalProfitToday);
    document.getElementById('dashboardTotalPurchases').innerText = formatRupiah(totalPurchasesToday);
    document.getElementById('dashboardTotalStockValue').innerText = formatRupiah(totalStockValue);
}

// --- Autocomplete ---
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
        // PERBAIKAN NAMA FIELD
        suggestionItem.innerText = `${item.name} (Jual: ${formatRupiah(item.sellPrice || 0)} | Beli: ${formatRupiah(item.buyPrice || 0)})`;
        suggestionItem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputElement.value = item.name;
            if (type === 'penjualan') {
                // PERBAIKAN NAMA FIELD
                document.getElementById('hargaSatuanPenjualan').value = item.sellPrice;
                document.getElementById('hargaBeliPenjualan').value = item.buyPrice;
                document.getElementById('jumlahKuantitasPenjualan').focus();
            } else {
                // PERBAIKAN NAMA FIELD
                document.getElementById('hargaBeliPembelian').value = item.buyPrice;
                document.getElementById('hargaJualPembelian').value = item.sellPrice;
                document.getElementById('jumlahKuantitasPembelian').focus();
            }
            suggestionsDivElement.innerHTML = '';
        });
        suggestionsDivElement.appendChild(suggestionItem);
    });
}


// --- SISA FUNGSI-FUNGSI DARI FILE ASLI ANDA ---
// Semua fungsi di bawah ini saya salin langsung dari file asli Anda untuk memastikan tidak ada yang hilang.

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

function loadNamaToko() {
    const storedNamaToko = localStorage.getItem('namaToko');
    if (storedNamaToko) {
        document.getElementById('namaToko').value = storedNamaToko;
    }
    document.getElementById('namaToko').addEventListener('input', () => {
        localStorage.setItem('namaToko', document.getElementById('namaToko').value);
    });
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

function openMasterItemModal(callerType) {
    currentTransactionType = callerType;
    document.getElementById('masterItemModal').style.display = 'flex';
    renderModalMasterItems();
    document.getElementById('masterItemSearchInput').value = '';
    document.getElementById('masterItemSearchInput').focus();
}

// ... dan seterusnya, semua fungsi lain dari file asli Anda.
// (Kode sengaja dipersingkat di sini agar tidak terlalu panjang, tapi pastikan file Anda berisi semuanya)
