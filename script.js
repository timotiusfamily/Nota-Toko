// File script.js Lengkap untuk APLIKASI MASTER
// Versi ini sudah diperbaiki untuk membaca dari koleksi /products terpusat

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => console.log('Service Worker registered: ', registration))
      .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
  });
}

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

// ... [ SISA SEMUA FUNGSI LAINNYA DARI FILE LENGKAP YANG SAYA BERIKAN SEBELUMNYA ] ...
// (Untuk keringkasan, sisa fungsi tidak ditampilkan di sini, tapi gunakan file lengkap yang sudah saya berikan)
