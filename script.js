let currentItems = []; // Items for the current active transaction (sale or purchase)
        let currentTransactionType = 'penjualan'; // 'penjualan' or 'pembelian'
        let currentGrandTotalPenjualan = 0;
        let currentGrandTotalLabaRugi = 0;
        let currentGrandTotalPembelian = 0;
        let itemCounter = 0; // Unique ID for current items
        let editingItemId = null;
        let salesHistory = []; // Stored sales receipts
        let purchaseHistory = []; // Stored purchase receipts
        let pendingSales = []; // Stored pending sales transactions
        let masterItems = []; // Master list of products

        // --- Initialization on DOMContentLoaded ---
        document.addEventListener('DOMContentLoaded', (event) => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;

            document.getElementById('tanggalPenjualan').value = formattedDate;
            document.getElementById('tanggalPembelian').value = formattedDate;

            loadNamaToko();
            loadHistory(); // Loads both sales and purchase history
            loadPendingSales();
            loadMasterItems();

            // Event listeners for autocomplete
            document.getElementById('namaBarangPenjualan').addEventListener('input', () => showSuggestions('penjualan'));
            document.getElementById('namaBarangPenjualan').addEventListener('blur', () => {
                setTimeout(() => { document.getElementById('namaBarangSuggestionsPenjualan').innerHTML = ''; }, 100);
            });
            document.getElementById('namaBarangPembelian').addEventListener('input', () => showSuggestions('pembelian'));
            document.getElementById('namaBarangPembelian').addEventListener('blur', () => {
                setTimeout(() => { document.getElementById('namaBarangSuggestionsPembelian').innerHTML = ''; }, 100);
            });

            // Event listener for Restore file input
            document.getElementById('restoreFileInput').addEventListener('change', restoreMasterItems);

            // Set default section to 'penjualan' on load
            showSection('penjualan', document.getElementById('navPenjualan'));

            // Set default filter dates for reports
            document.getElementById('filterStartDate').value = `${year}-${month}-01`;
            document.getElementById('filterEndDate').value = formattedDate;
        });

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
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                document.getElementById('tanggalPenjualan').value = `${year}-${month}-${day}`;
            } else if (type === 'pembelian') {
                document.getElementById('namaSupplier').value = '';
                currentGrandTotalPembelian = 0;
                renderTablePembelian();
                clearBarangInputs('pembelian');
                document.getElementById('strukOutputPembelian').style.display = 'none';
                document.getElementById('shareButtonsPembelian').style.display = 'none';
                document.getElementById('strukNamaSupplierPembelian').innerText = '';
                document.getElementById('strukTanggalPembelianPreview').innerText = '';
                document.getElementById('strukItemsPembelian').innerHTML = '';
                document.getElementById('strukGrandTotalPembelianPreview').innerText = '';
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                document.getElementById('tanggalPembelian').value = `${year}-${month}-${day}`;
            }
        }

        // Function to clear only the sales preview area
        function clearSalesPreview() {
            document.getElementById('strukOutputPenjualan').style.display = 'none';
            document.getElementById('shareButtonsPenjualan').style.display = 'none';
            document.getElementById('strukNamaTokoPenjualan').innerText = '';
            document.getElementById('strukTanggalPembeliPenjualan').innerText = '';
            document.getElementById('strukItemsPenjualan').innerHTML = '';
            document.getElementById('strukGrandTotalPenjualanPreview').innerText = '';
        }

        // --- Tab Navigation ---
        // Parameter keepCurrentTransaction: jika true, form dan currentItems tidak akan direset saat beralih tab.
        // Ini berguna saat memuat transaksi pending atau riwayat.
        function showSection(sectionId, clickedButton, keepCurrentTransaction = false) {
            const sections = document.querySelectorAll('.main-content-wrapper.content-section');
            sections.forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${sectionId}Section`).classList.add('active');

            const navButtons = document.querySelectorAll('.mobile-nav button');
            navButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            if (clickedButton) {
                clickedButton.classList.add('active');
            }

            currentTransactionType = sectionId;

            // Hanya reset jika tidak diminta untuk mempertahankan transaksi saat ini
            if (!keepCurrentTransaction) {
                if (sectionId === 'penjualan') {
                    clearSalesPreview(); // Kosongkan pratinjau penjualan saat masuk tab penjualan
                    resetCurrentTransaction('penjualan'); // Reset form untuk penjualan baru
                } else if (sectionId === 'pembelian') {
                    resetCurrentTransaction('pembelian');
                }
            }

            // Refresh reports/lists if applicable
            if (sectionId === 'history') {
                renderSalesHistory();
                renderPurchaseHistory();
            } else if (sectionId === 'pending') {
                renderPendingSales();
            } else if (sectionId === 'profitLoss') {
                generateProfitLossReport();
            } else if (sectionId === 'stock') {
                generateStockReport();
            }
        }

        // --- Penjualan Management ---
        function tambahAtauUpdateBarangPenjualan() {
            const namaBarang = document.getElementById('namaBarangPenjualan').value.trim();
            const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPenjualan').value);
            const hargaSatuan = parseInt(document.getElementById('hargaSatuanPenjualan').value);
            const hargaBeli = parseInt(document.getElementById('hargaBeliPenjualan').value || '0');

            if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaSatuan)) {
                showMessageBox('Mohon lengkapi Nama Barang, Kuantitas, dan Harga Satuan.');
                return;
            }
            if (jumlahKuantitas <= 0) {
                showMessageBox('Jumlah Kuantitas harus lebih dari 0.');
                return;
            }
            if (hargaSatuan < 0 || hargaBeli < 0) {
                showMessageBox('Harga tidak boleh negatif.');
                return;
            }

            // Kosongkan pratinjau penjualan jika menambahkan item baru ke transaksi
            clearSalesPreview();


            const jumlah = jumlahKuantitas * hargaSatuan;
            const labaRugi = (jumlahKuantitas * hargaSatuan) - (jumlahKuantitas * hargaBeli);

            if (editingItemId !== null) {
                const itemIndex = currentItems.findIndex(item => item.id === editingItemId);
                if (itemIndex > -1) {
                    currentItems[itemIndex].nama = namaBarang;
                    currentItems[itemIndex].qty = jumlahKuantitas;
                    currentItems[itemIndex].hargaSatuan = hargaSatuan;
                    currentItems[itemIndex].hargaBeli = hargaBeli;
                    currentItems[itemIndex].jumlah = jumlah;
                    currentItems[itemIndex].labaRugi = labaRugi;
                }
                editingItemId = null;
                document.getElementById('btnAddUpdatePenjualan').innerText = 'Tambah Barang';
                document.getElementById('btnCancelEditPenjualan').style.display = 'none';
            } else {
                itemCounter++;
                const newItem = {
                    id: itemCounter,
                    nama: namaBarang,
                    qty: jumlahKuantitas,
                    hargaSatuan: hargaSatuan,
                    hargaBeli: hargaBeli,
                    jumlah: jumlah,
                    labaRugi: labaRugi
                };
                currentItems.push(newItem);
            }

            // Update master item prices if they are new or changed
            addOrUpdateMasterItem(namaBarang, hargaSatuan, hargaBeli);
            saveMasterItems(); // Save master items after price update

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
            showMessageBox('Apakah Anda yakin ingin menghapus barang ini dari daftar saat ini?', true, () => {
                currentItems = currentItems.filter(item => item.id !== id);
                hitungUlangTotal('penjualan');
                renderTablePenjualan();
                batalEditPenjualan();
                clearSalesPreview(); // Kosongkan pratinjau jika item dihapus
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
                daftarBelanja.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Belum ada barang dalam daftar penjualan.</td></tr>';
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

        function selesaikanPembayaran() {
            if (currentItems.length === 0) {
                showMessageBox('Tambahkan barang terlebih dahulu sebelum menyelesaikan pembayaran.');
                return;
            }

            // Kurangi stok untuk barang yang terjual
            currentItems.forEach(item => {
                const masterItem = masterItems.find(mi => mi.name === item.nama);
                if (masterItem) {
                    masterItem.stock -= item.qty;
                }
            });
            saveMasterItems(); // Simpan master item setelah perubahan stok

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
            localStorage.setItem('salesHistory', JSON.stringify(salesHistory));

            renderStrukPreviewPenjualan(newStruk); // Render pratinjau menggunakan data struk yang baru selesai
            document.getElementById('strukOutputPenjualan').style.display = 'block'; // Tampilkan area pratinjau
            document.getElementById('shareButtonsPenjualan').style.display = 'flex'; // Tampilkan tombol share
            showMessageBox('Pembayaran berhasil diselesaikan dan struk siap dibagikan!');
            
            // Reset input form untuk transaksi baru, tapi biarkan pratinjau tetap terlihat
            resetCurrentTransaction('penjualan');
        }

        function renderStrukPreviewPenjualan(strukData) {
            // Gunakan strukData yang dilewatkan untuk pratinjau, bukan currentItems global
            const namaToko = strukData.toko || 'Nama Toko';
            const tanggal = strukData.tanggal;
            const namaPembeli = strukData.pembeli || 'Pelanggan Yth.';

            document.getElementById('strukNamaTokoPenjualan').innerText = `Nama Toko: ${namaToko}`;
            document.getElementById('strukTanggalPembeliPenjualan').innerText = `Tanggal: ${tanggal} | Pembeli: ${namaPembeli}`;

            const strukItemsDiv = document.getElementById('strukItemsPenjualan');
            strukItemsDiv.innerHTML = '';

            strukData.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('item-row', 'flex', 'justify-between', 'flex-wrap', 'mb-1');
                itemDiv.innerHTML = `
                    <span class="item-name flex-1 min-w-[50%]">${item.nama}</span>
                    <span class="item-qty-price text-right flex-grow-0 flex-shrink-0 w-[120px]">${item.qty} x ${formatRupiah(item.hargaSatuan)}</span>
                    <span class="item-total w-[80px] text-right ml-auto">${formatRupiah(item.jumlah)}</span>
                `;
                strukItemsDiv.appendChild(itemDiv);
            });
            document.getElementById('strukGrandTotalPenjualanPreview').innerText = `Total: ${formatRupiah(strukData.totalPenjualan)}`;
        }

        function shareViaWhatsAppPenjualan() {
            // Ambil data struk terakhir yang dihasilkan untuk dibagikan
            const lastStruk = salesHistory[salesHistory.length - 1];
            if (!lastStruk) {
                showMessageBox('Tidak ada struk untuk dibagikan.');
                return;
            }

            const namaToko = lastStruk.toko || 'Nama Toko';
            const tanggal = lastStruk.tanggal;
            const namaPembeli = lastStruk.pembeli || 'Pelanggan Yth.';

            let message = `*NOTA PENJUALAN*\n\n`; // Changed to PENJUALAN
            message += `*${namaToko}*\n`;
            message += `Tanggal: ${tanggal}\n`;
            message += `Pembeli: ${namaPembeli}\n`;
            message += `\n`;

            message += `*Daftar Barang:*\n`;
            lastStruk.items.forEach((item, index) => {
                message += `${index + 1}. ${item.nama} (${item.qty} x ${formatRupiah(item.hargaSatuan)}) = ${formatRupiah(item.jumlah)}\n`;
            });

            message += `\n------------------------------\n`;
            message += `*TOTAL PENJUALAN: ${formatRupiah(lastStruk.totalPenjualan)}*\n`;
            message += `------------------------------\n`;
            message += `\nTerima kasih atas kunjungan Anda!\n`;
            message += `_Dibuat dengan Aplikasi Nota & Stok_`;

            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        function simpanTransaksiPending() {
            if (currentItems.length === 0) {
                showMessageBox('Tidak ada barang untuk disimpan sebagai transaksi pending.');
                return;
            }

            const tanggal = document.getElementById('tanggalPenjualan').value;
            const namaPembeli = document.getElementById('namaPembeli').value || 'Pelanggan Yth.';
            const namaToko = document.getElementById('namaToko').value || 'Nama Toko';

            const newPendingTransaction = {
                id: Date.now(),
                tanggal: tanggal,
                pembeli: namaPembeli,
                toko: namaToko,
                items: JSON.parse(JSON.stringify(currentItems)),
                totalPenjualan: currentGrandTotalPenjualan,
                totalLabaRugi: currentGrandTotalLabaRugi
            };

            pendingSales.push(newPendingTransaction);
            localStorage.setItem('pendingSales', JSON.stringify(pendingSales));
            showMessageBox('Transaksi berhasil disimpan sebagai pending!');
            resetCurrentTransaction('penjualan'); // Kosongkan form untuk transaksi baru
            clearSalesPreview(); // Kosongkan pratinjau penjualan juga
        }

        // --- Pembelian Management ---
        function tambahAtauUpdateBarangPembelian() {
            const namaBarang = document.getElementById('namaBarangPembelian').value.trim();
            const jumlahKuantitas = parseInt(document.getElementById('jumlahKuantitasPembelian').value);
            const hargaBeli = parseInt(document.getElementById('hargaBeliPembelian').value || '0');

            if (!namaBarang || isNaN(jumlahKuantitas) || isNaN(hargaBeli)) {
                showMessageBox('Mohon lengkapi Nama Barang, Kuantitas, dan Harga Beli.');
                return;
            }
            if (jumlahKuantitas <= 0) {
                showMessageBox('Jumlah Kuantitas harus lebih dari 0.');
                return;
            }
            if (hargaBeli < 0) {
                showMessageBox('Harga beli tidak boleh negatif.');
                return;
            }

            const jumlah = jumlahKuantitas * hargaBeli; // Total pembelian untuk item ini

            if (editingItemId !== null) {
                const itemIndex = currentItems.findIndex(item => item.id === editingItemId);
                if (itemIndex > -1) {
                    // Kembalikan stok untuk kuantitas lama
                    const oldQty = currentItems[itemIndex].qty;
                    const oldName = currentItems[itemIndex].nama;
                    const oldMasterItem = masterItems.find(mi => mi.name === oldName);
                    if (oldMasterItem) {
                        oldMasterItem.stock -= oldQty; // Kurangi stok dari master
                    }

                    currentItems[itemIndex].nama = namaBarang;
                    currentItems[itemIndex].qty = jumlahKuantitas;
                    currentItems[itemIndex].hargaBeli = hargaBeli;
                    currentItems[itemIndex].jumlah = jumlah;

                    // Tambahkan stok untuk kuantitas baru
                    const newMasterItem = masterItems.find(mi => mi.name === namaBarang);
                    if (newMasterItem) {
                        newMasterItem.stock += jumlahKuantitas; // Tambahkan stok di master
                    }
                }
                editingItemId = null;
                document.getElementById('btnAddUpdatePembelian').innerText = 'Tambah Barang';
                document.getElementById('btnCancelEditPembelian').style.display = 'none';
            } else {
                itemCounter++;
                const newItem = {
                    id: itemCounter,
                    nama: namaBarang,
                    qty: jumlahKuantitas,
                    hargaBeli: hargaBeli,
                    jumlah: jumlah
                };
                currentItems.push(newItem);

                // Tambahkan stok untuk barang yang dibeli
                const masterItem = masterItems.find(mi => mi.name === namaBarang);
                if (masterItem) {
                    masterItem.stock += jumlahKuantitas;
                } else {
                    // Jika ini item baru, tambahkan ke masterItems dengan stok awal
                    masterItems.push({ name: namaBarang, price: 0, purchasePrice: hargaBeli, stock: jumlahKuantitas });
                }
            }
            saveMasterItems(); // Simpan master item setelah perubahan stok

            hitungUlangTotal('pembelian');
            renderTablePembelian();
            clearBarangInputs('pembelian');
            document.getElementById('strukOutputPembelian').style.display = 'none'; // Sembunyikan pratinjau saat menambah/mengedit
            document.getElementById('shareButtonsPembelian').style.display = 'none';
        }

        function editBarangPembelian(id) {
            const itemToEdit = currentItems.find(item => item.id === id);
            if (itemToEdit) {
                document.getElementById('namaBarangPembelian').value = itemToEdit.nama;
                document.getElementById('jumlahKuantitasPembelian').value = itemToEdit.qty;
                document.getElementById('hargaBeliPembelian').value = itemToEdit.hargaBeli;

                document.getElementById('btnAddUpdatePembelian').innerText = 'Update Barang';
                document.getElementById('btnCancelEditPembelian').style.display = 'inline-block';
                editingItemId = id;
            }
        }

        function deleteBarangPembelian(id) {
            showMessageBox('Apakah Anda yakin ingin menghapus barang ini dari daftar saat ini?', true, () => {
                const deletedItem = currentItems.find(item => item.id === id);
                if (deletedItem) {
                    // Kurangi stok untuk item yang dihapus (batalkan pembelian)
                    const masterItem = masterItems.find(mi => mi.name === deletedItem.nama);
                    if (masterItem) {
                        masterItem.stock -= deletedItem.qty;
                    }
                    saveMasterItems();
                }
                currentItems = currentItems.filter(item => item.id !== id);
                hitungUlangTotal('pembelian');
                renderTablePembelian();
                batalEditPembelian();
                document.getElementById('strukOutputPembelian').style.display = 'none'; // Sembunyikan pratinjau jika item dihapus
                document.getElementById('shareButtonsPembelian').style.display = 'none';
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
                daftarBelanja.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Belum ada barang dalam daftar pembelian.</td></tr>';
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

        function simpanNotaPembelian() {
            if (currentItems.length === 0) {
                showMessageBox('Tidak ada barang untuk disimpan dalam nota pembelian.');
                return;
            }

            const tanggal = document.getElementById('tanggalPembelian').value;
            const namaSupplier = document.getElementById('namaSupplier').value || 'Supplier Umum';
            const namaToko = document.getElementById('namaToko').value || 'Nama Toko';

            const newStruk = {
                id: Date.now(),
                tanggal: tanggal,
                supplier: namaSupplier,
                toko: namaToko,
                items: JSON.parse(JSON.stringify(currentItems)),
                totalPembelian: currentGrandTotalPembelian
            };

            purchaseHistory.push(newStruk);
            localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory));

            renderStrukPreviewPembelian(newStruk);
            document.getElementById('strukOutputPembelian').style.display = 'block';
            document.getElementById('shareButtonsPembelian').style.display = 'flex';
            showMessageBox('Nota pembelian berhasil disimpan!');
            resetCurrentTransaction('pembelian');
        }

        function renderStrukPreviewPembelian(strukData) {
            const namaToko = strukData.toko || 'Nama Toko';
            const tanggal = strukData.tanggal;
            const namaSupplier = strukData.supplier || 'Supplier Umum';

            document.getElementById('strukNamaSupplierPembelian').innerText = `Nama Toko: ${namaToko}`;
            document.getElementById('strukTanggalPembelianPreview').innerText = `Tanggal: ${tanggal} | Supplier: ${namaSupplier}`;

            const strukItemsDiv = document.getElementById('strukItemsPembelian');
            strukItemsDiv.innerHTML = '';

            strukData.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('item-row', 'flex', 'justify-between', 'flex-wrap', 'mb-1');
                itemDiv.innerHTML = `
                    <span class="item-name flex-1 min-w-[50%]">${item.nama}</span>
                    <span class="item-qty-price text-right flex-grow-0 flex-shrink-0 w-[120px]">${item.qty} x ${formatRupiah(item.hargaBeli)}</span>
                    <span class="item-total w-[80px] text-right ml-auto">${formatRupiah(item.jumlah)}</span>
                `;
                strukItemsDiv.appendChild(itemDiv);
            });
            document.getElementById('strukGrandTotalPembelianPreview').innerText = `Total: ${formatRupiah(strukData.totalPembelian)}`;
        }

        function shareViaWhatsAppPembelian() {
            const lastStruk = purchaseHistory[purchaseHistory.length - 1];
            if (!lastStruk) {
                showMessageBox('Tidak ada nota pembelian untuk dibagikan.');
                return;
            }

            const namaToko = lastStruk.toko || 'Nama Toko';
            const tanggal = lastStruk.tanggal;
            const namaSupplier = lastStruk.supplier || 'Supplier Umum';

            let message = `*NOTA PEMBELIAN*\n\n`;
            message += `*${namaToko}*\n`;
            message += `Tanggal: ${tanggal}\n`;
            message += `Supplier: ${namaSupplier}\n`;
            message += `\n`;

            message += `*Daftar Barang:*\n`;
            lastStruk.items.forEach((item, index) => {
                message += `${index + 1}. ${item.nama} (${item.qty} x ${formatRupiah(item.hargaBeli)}) = ${formatRupiah(item.jumlah)}\n`;
            });

            message += `\n------------------------------\n`;
            message += `*TOTAL PEMBELIAN: ${formatRupiah(lastStruk.totalPembelian)}*\n`;
            message += `------------------------------\n`;
            message += `\nTerima kasih!\n`;
            message += `_Dibuat dengan Aplikasi Nota & Stok_`;

            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }


        // --- Nama Toko Management ---
        function loadNamaToko() {
            const storedNamaToko = localStorage.getItem('namaToko');
            if (storedNamaToko) {
                document.getElementById('namaToko').value = storedNamaToko;
            }
            document.getElementById('namaToko').addEventListener('input', () => {
                localStorage.setItem('namaToko', document.getElementById('namaToko').value);
            });
        }

        // --- History Management ---
        function loadHistory() {
            const storedSalesHistory = localStorage.getItem('salesHistory');
            if (storedSalesHistory) {
                salesHistory = JSON.parse(storedSalesHistory);
            }
            const storedPurchaseHistory = localStorage.getItem('purchaseHistory');
            if (storedPurchaseHistory) {
                purchaseHistory = JSON.parse(storedPurchaseHistory);
            }
            renderSalesHistory();
            renderPurchaseHistory();
        }

        function renderSalesHistory() {
            const historyListBody = document.querySelector('#salesHistoryListBody');
            historyListBody.innerHTML = '';

            if (salesHistory.length === 0) {
                historyListBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Belum ada riwayat penjualan.</td></tr>';
                return;
            }

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
            historyListBody.innerHTML = '';

            if (purchaseHistory.length === 0) {
                historyListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada riwayat pembelian.</td></tr>';
                return;
            }

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
                    // Isi form penjualan dengan data riwayat
                    document.getElementById('namaToko').value = strukToView.toko || '';
                    document.getElementById('tanggalPenjualan').value = strukToView.tanggal;
                    document.getElementById('namaPembeli').value = strukToView.pembeli;
                    currentItems = JSON.parse(JSON.stringify(strukToView.items)); // Muat item ke currentItems

                    hitungUlangTotal('penjualan'); // Hitung ulang total untuk item yang dimuat
                    renderTablePenjualan(); // Render tabel daftar belanja dengan item yang dimuat

                    // Render pratinjau struk riwayat ini
                    renderStrukPreviewPenjualan(strukToView);
                    document.getElementById('strukOutputPenjualan').style.display = 'block';
                    document.getElementById('shareButtonsPenjualan').style.display = 'flex';

                    showMessageBox(`Menampilkan struk penjualan riwayat dengan ID: ${strukToView.id}`);
                    // Beralih ke tab penjualan, dan *pertahankan* data transaksi saat ini di form
                    showSection('penjualan', document.getElementById('navPenjualan'), true);
                }
            } else if (type === 'pembelian') {
                strukToView = purchaseHistory.find(s => s.id === id);
                if (strukToView) {
                    // Isi form pembelian dengan data riwayat
                    document.getElementById('namaToko').value = strukToView.toko || ''; // Asumsi namaToko bersifat global atau dibagikan
                    document.getElementById('tanggalPembelian').value = strukToView.tanggal;
                    document.getElementById('namaSupplier').value = strukToView.supplier;
                    currentItems = JSON.parse(JSON.stringify(strukToView.items)); // Muat item ke currentItems

                    hitungUlangTotal('pembelian'); // Hitung ulang total untuk item yang dimuat
                    renderTablePembelian(); // Render tabel daftar pembelian dengan item yang dimuat

                    renderStrukPreviewPembelian(strukToView);
                    document.getElementById('strukOutputPembelian').style.display = 'block';
                    document.getElementById('shareButtonsPembelian').style.display = 'flex';

                    showMessageBox(`Menampilkan nota pembelian riwayat dengan ID: ${strukToView.id}`);
                    // Beralih ke tab pembelian, dan *pertahankan* data transaksi saat ini di form
                    showSection('pembelian', document.getElementById('navPembelian'), true);
                }
            }
        }

        function deleteHistoryStruk(id, type) {
            showMessageBox(`Apakah Anda yakin ingin menghapus struk ${type} ini dari riwayat?`, true, () => {
                if (type === 'penjualan') {
                    const deletedStruk = salesHistory.find(s => s.id === id);
                    if (deletedStruk && deletedStruk.items) {
                        deletedStruk.items.forEach(item => {
                            const masterItem = masterItems.find(mi => mi.name === item.nama);
                            if (masterItem) {
                                masterItem.stock += item.qty; // Kembalikan stok untuk penjualan yang dihapus
                            }
                        });
                        saveMasterItems();
                    }
                    salesHistory = salesHistory.filter(s => s.id !== id);
                    localStorage.setItem('salesHistory', JSON.stringify(salesHistory));
                    renderSalesHistory();
                    showMessageBox('Struk penjualan berhasil dihapus dari riwayat.');
                } else if (type === 'pembelian') {
                    const deletedStruk = purchaseHistory.find(s => s.id === id);
                    if (deletedStruk && deletedStruk.items) {
                        deletedStruk.items.forEach(item => {
                            const masterItem = masterItems.find(mi => mi.name === item.nama);
                            if (masterItem) {
                                masterItem.stock -= item.qty; // Kurangi stok untuk pembelian yang dihapus
                            }
                        });
                        saveMasterItems();
                    }
                    purchaseHistory = purchaseHistory.filter(s => s.id !== id);
                    localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory));
                    renderPurchaseHistory();
                    showMessageBox('Nota pembelian berhasil dihapus dari riwayat.');
                }
            });
        }

        function clearSalesHistory() {
            showMessageBox('Apakah Anda yakin ingin menghapus SEMUA riwayat penjualan? Tindakan ini tidak dapat dibatalkan.', true, () => {
                // Ini TIDAK mengembalikan perubahan stok.
                localStorage.removeItem('salesHistory');
                salesHistory = [];
                renderSalesHistory();
                showMessageBox('Semua riwayat penjualan telah dihapus.');
            });
        }

        function clearPurchaseHistory() {
            showMessageBox('Apakah Anda yakin ingin menghapus SEMUA riwayat pembelian? Tindakan ini tidak dapat dibatalkan.', true, () => {
                // Ini TIDAK mengembalikan perubahan stok.
                localStorage.removeItem('purchaseHistory');
                purchaseHistory = [];
                renderPurchaseHistory();
                showMessageBox('Semua riwayat pembelian telah dihapus.');
            });
        }

        // --- Pending Sales Management ---
        function loadPendingSales() {
            const storedPendingSales = localStorage.getItem('pendingSales');
            if (storedPendingSales) {
                pendingSales = JSON.parse(storedPendingSales);
            }
            renderPendingSales();
        }

        function renderPendingSales() {
            const pendingSalesListBody = document.querySelector('#pendingSalesList');
            pendingSalesListBody.innerHTML = '';

            if (pendingSales.length === 0) {
                pendingSalesListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Belum ada transaksi pending.</td></tr>';
                return;
            }

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

        function loadPendingTransaction(id) {
            const transactionToLoad = pendingSales.find(t => t.id === id);
            if (transactionToLoad) {
                // Isi form penjualan dengan data transaksi pending
                document.getElementById('namaToko').value = transactionToLoad.toko || '';
                document.getElementById('tanggalPenjualan').value = transactionToLoad.tanggal;
                document.getElementById('namaPembeli').value = transactionToLoad.pembeli;
                currentItems = JSON.parse(JSON.stringify(transactionToLoad.items)); // Muat item ke currentItems

                hitungUlangTotal('penjualan'); // Hitung ulang total untuk item yang dimuat
                renderTablePenjualan(); // Render tabel daftar belanja dengan item yang dimuat

                // Beralih ke tab penjualan, dan *pertahankan* data transaksi saat ini di form
                showSection('penjualan', document.getElementById('navPenjualan'), true);

                // Pastikan pratinjau dikosongkan saat memuat transaksi pending untuk dikerjakan
                clearSalesPreview(); 

                showMessageBox(`Transaksi pending dengan ID ${id} dimuat. Lanjutkan pembayaran.`);

                // Hapus dari daftar pending setelah dimuat
                pendingSales = pendingSales.filter(t => t.id !== id);
                localStorage.setItem('pendingSales', JSON.stringify(pendingSales));
                renderPendingSales();
            }
        }

        function deletePendingTransaction(id) {
            showMessageBox('Apakah Anda yakin ingin menghapus transaksi pending ini?', true, () => {
                pendingSales = pendingSales.filter(t => t.id !== id);
                localStorage.setItem('pendingSales', JSON.stringify(pendingSales));
                renderPendingSales();
                showMessageBox('Transaksi pending berhasil dihapus.');
            });
        }

        function clearPendingSales() {
            showMessageBox('Apakah Anda yakin ingin menghapus SEMUA transaksi pending? Tindakan ini tidak dapat dibatalkan.', true, () => {
                localStorage.removeItem('pendingSales');
                pendingSales = [];
                renderPendingSales();
                showMessageBox('Semua transaksi pending telah dihapus.');
            });
        }

        // --- Master Items Management (Autocomplete, Storage, & Modal) ---
        function addOrUpdateMasterItem(name, sellingPrice, purchasePrice, stockChange = 0) {
            const existingItemIndex = masterItems.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
            if (existingItemIndex > -1) {
                masterItems[existingItemIndex].price = sellingPrice;
                masterItems[existingItemIndex].purchasePrice = purchasePrice;
                masterItems[existingItemIndex].stock = (masterItems[existingItemIndex].stock || 0) + stockChange;
            } else {
                masterItems.push({ name: name, price: sellingPrice, purchasePrice: purchasePrice, stock: stockChange });
            }
            saveMasterItems();
            renderMasterItems();
            renderModalMasterItems();
        }

        function saveMasterItems() {
            localStorage.setItem('masterItems', JSON.stringify(masterItems));
        }

        function loadMasterItems() {
            const storedMasterItems = localStorage.getItem('masterItems');
            if (storedMasterItems) {
                masterItems = JSON.parse(storedMasterItems);
                masterItems.forEach(item => {
                    if (typeof item.stock === 'undefined') item.stock = 0;
                    if (typeof item.purchasePrice === 'undefined') item.purchasePrice = 0;
                });
            }
            renderMasterItems();
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
                row.insertCell(1).innerText = formatRupiah(item.price);
                row.insertCell(2).innerText = formatRupiah(item.purchasePrice);
                row.insertCell(3).innerText = item.stock;

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
                // Isi form penjualan dengan field
                document.getElementById('namaBarangPenjualan').value = itemToEdit.name;
                document.getElementById('hargaSatuanPenjualan').value = itemToEdit.price;
                document.getElementById('hargaBeliPenjualan').value = itemToEdit.purchasePrice;
                document.getElementById('jumlahKuantitasPenjualan').value = '';
                document.getElementById('namaBarangPenjualan').focus();
                showSection('penjualan', document.getElementById('navPenjualan'));
            }
        }

        function deleteMasterItem(index) {
            showMessageBox(`Apakah Anda yakin ingin menghapus "${masterItems[index].name}" dari daftar barang master?`, true, () => {
                masterItems.splice(index, 1);
                saveMasterItems();
                renderMasterItems();
                renderModalMasterItems();
                showMessageBox('Barang master berhasil dihapus.');
            });
        }

        function clearMasterItems() {
            showMessageBox('Apakah Anda yakin ingin menghapus SEMUA daftar barang master? Tindakan ini tidak dapat dibatalkan.', true, () => {
                localStorage.removeItem('masterItems');
                masterItems = [];
                renderMasterItems();
                renderModalMasterItems();
                showMessageBox('Semua daftar barang master telah dihapus.');
            });
        }

        // Autocomplete logic
        function showSuggestions(type) {
            let inputElement, suggestionsDivElement;
            if (type === 'penjualan') {
                inputElement = document.getElementById('namaBarangPenjualan');
                suggestionsDivElement = document.getElementById('namaBarangSuggestionsPenjualan');
            } else if (type === 'pembelian') {
                inputElement = document.getElementById('namaBarangPembelian');
                suggestionsDivElement = document.getElementById('namaBarangSuggestionsPembelian');
            } else {
                return;
            }

            const filter = inputElement.value.toLowerCase();
            suggestionsDivElement.innerHTML = '';

            if (!filter) {
                return;
            }

            const filteredItems = masterItems.filter(item =>
                item.name.toLowerCase().includes(filter)
            );

            filteredItems.forEach(item => {
                const suggestionItem = document.createElement('div');
                suggestionItem.classList.add('p-2', 'cursor-pointer', 'hover:bg-gray-100', 'border-b', 'border-gray-200', 'last:border-b-0');
                suggestionItem.innerText = `${item.name} (Jual: ${formatRupiah(item.price)} | Beli: ${formatRupiah(item.purchasePrice)})`;
                suggestionItem.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    inputElement.value = item.name;
                    if (type === 'penjualan') {
                        document.getElementById('hargaSatuanPenjualan').value = item.price;
                        document.getElementById('hargaBeliPenjualan').value = item.purchasePrice;
                        document.getElementById('jumlahKuantitasPenjualan').focus();
                    } else if (type === 'pembelian') {
                        document.getElementById('hargaBeliPembelian').value = item.purchasePrice;
                        document.getElementById('jumlahKuantitasPembelian').focus();
                    }
                    suggestionsDivElement.innerHTML = '';
                });
                suggestionsDivElement.appendChild(suggestionItem);
            });
        }

        // --- Master Item Search Modal ---
        function openMasterItemModal(callerType) {
            currentTransactionType = callerType; // Simpan bagian mana yang memanggil modal
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

            const filteredMasterItems = masterItems.filter(item =>
                item.name.toLowerCase().includes(searchFilter)
            );

            if (filteredMasterItems.length === 0) {
                modalListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Tidak ada barang yang cocok.</td></tr>';
                return;
            }

            filteredMasterItems.forEach(item => {
                const row = modalListBody.insertRow();
                row.classList.add('hover:bg-gray-50');
                row.insertCell(0).innerText = item.name;
                row.insertCell(1).innerText = formatRupiah(item.price);
                row.insertCell(2).innerText = formatRupiah(item.purchasePrice);
                row.insertCell(3).innerText = item.stock;
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
                document.getElementById('jumlahKuantitasPenjualan').value = '';
                document.getElementById('jumlahKuantitasPenjualan').focus();
            } else if (currentTransactionType === 'pembelian') {
                document.getElementById('namaBarangPembelian').value = name;
                document.getElementById('hargaBeliPembelian').value = purchasePrice;
                document.getElementById('jumlahKuantitasPembelian').value = '';
                document.getElementById('jumlahKuantitasPembelian').focus();
            }
            closeMasterItemModal();
        }

        // --- Backup / Restore Master Items ---
        function backupMasterItems() {
            if (masterItems.length === 0) {
                showMessageBox('Tidak ada barang master untuk di-backup.');
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
            showMessageBox('Daftar barang master berhasil di-backup!');
        }

        function restoreMasterItems(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const loadedData = JSON.parse(e.target.result);
                    if (Array.isArray(loadedData) && loadedData.every(item => typeof item.name === 'string' && typeof item.price === 'number' && typeof item.purchasePrice === 'number' && typeof item.stock === 'number')) {
                        showMessageBox('Apakah Anda yakin ingin me-restore daftar barang master? Ini akan menimpa data yang ada.', true, () => {
                            masterItems = loadedData;
                            saveMasterItems();
                            renderMasterItems();
                            renderModalMasterItems();
                            showMessageBox('Daftar barang master berhasil di-restore!');
                        });
                    } else {
                        showMessageBox('Format file JSON tidak valid. Pastikan itu adalah array objek dengan "name" (string), "price" (number), "purchasePrice" (number), dan "stock" (number).');
                    }
                } catch (error) {
                    showMessageBox('Gagal membaca atau memproses file JSON. Error: ' + error.message);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // --- Laporan Rugi Laba Sederhana ---
        function generateProfitLossReport() {
            const startDate = document.getElementById('filterStartDate').value;
            const endDate = document.getElementById('filterEndDate').value;
            const filterItemName = document.getElementById('filterItemName').value.toLowerCase();

            let filteredSalesHistory = salesHistory.filter(struk => {
                const strukDate = struk.tanggal;
                return (!startDate || strukDate >= startDate) && (!endDate || strukDate <= endDate);
            });

            if (filterItemName) {
                filteredSalesHistory = filteredSalesHistory.filter(struk =>
                    struk.items.some(item => item.nama.toLowerCase().includes(filterItemName))
                );
            }

            // Rugi Laba Harian
            const dailyProfitLoss = {};
            filteredSalesHistory.forEach(struk => {
                const date = struk.tanggal;
                if (!dailyProfitLoss[date]) {
                    dailyProfitLoss[date] = { totalPenjualan: 0, totalHargaBeli: 0, labaRugi: 0 };
                }
                dailyProfitLoss[date].totalPenjualan += struk.totalPenjualan;
                let totalBeliTransaksi = struk.items.reduce((sum, item) => sum + (item.qty * (item.hargaBeli || 0)), 0);
                dailyProfitLoss[date].totalHargaBeli += totalBeliTransaksi;
                dailyProfitLoss[date].labaRugi += struk.totalLabaRugi;
            });

            const dailyProfitLossList = document.getElementById('dailyProfitLossList');
            dailyProfitLossList.innerHTML = '';
            let overallTotalFilteredProfitLoss = 0;

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
            if (Object.keys(dailyProfitLoss).length === 0) {
                 dailyProfitLossList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada data rugi laba harian.</td></tr>';
            }


            // Rugi Laba per Transaksi
            const transactionProfitLossList = document.getElementById('transactionProfitLossList');
            transactionProfitLossList.innerHTML = '';
            filteredSalesHistory.forEach(struk => {
                const row = transactionProfitLossList.insertRow();
                row.classList.add('hover:bg-gray-50');
                row.insertCell(0).innerText = struk.id;
                row.insertCell(1).innerText = struk.tanggal;
                row.insertCell(2).innerText = struk.pembeli;
                row.insertCell(3).innerText = formatRupiah(struk.totalPenjualan);
                let totalBeliTransaksi = struk.items.reduce((sum, item) => sum + (item.qty * (item.hargaBeli || 0)), 0);
                row.insertCell(4).innerText = formatRupiah(totalBeliTransaksi);
                row.insertCell(5).innerText = formatRupiah(struk.totalLabaRugi || 0);
            });
            if (filteredSalesHistory.length === 0) {
                transactionProfitLossList.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Tidak ada data rugi laba per transaksi.</td></tr>';
            }


            // Rugi Laba per Barang
            const itemProfitLoss = {};
            filteredSalesHistory.forEach(struk => {
                struk.items.forEach(item => {
                    if (!itemProfitLoss[item.nama]) {
                        itemProfitLoss[item.nama] = { totalPenjualan: 0, totalHargaBeli: 0, labaRugi: 0 };
                    }
                    itemProfitLoss[item.nama].totalPenjualan += item.jumlah;
                    itemProfitLoss[item.nama].totalHargaBeli += (item.qty * (item.hargaBeli || 0));
                    itemProfitLoss[item.nama].labaRugi += item.labaRugi;
                });
            });

            const itemProfitLossList = document.getElementById('itemProfitLossList');
            itemProfitLossList.innerHTML = '';
            Object.keys(itemProfitLoss).sort().forEach(itemName => {
                const data = itemProfitLoss[itemName];
                const row = itemProfitLossList.insertRow();
                row.classList.add('hover:bg-gray-50');
                row.insertCell(0).innerText = itemName;
                row.insertCell(1).innerText = formatRupiah(data.totalPenjualan);
                row.insertCell(2).innerText = formatRupiah(data.totalHargaBeli);
                row.insertCell(3).innerText = formatRupiah(data.labaRugi);
            });
            if (Object.keys(itemProfitLoss).length === 0) {
                itemProfitLossList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada data rugi laba per barang.</td></tr>';
            }

            document.getElementById('totalFilteredProfitLoss').innerText = formatRupiah(overallTotalFilteredProfitLoss);
        }

        // --- Laporan Stok Barang Sederhana ---
        function generateStockReport() {
            const stockReportList = document.getElementById('stockReportList');
            stockReportList.innerHTML = '';
            const stockFilterItemName = document.getElementById('stockFilterItemName').value.toLowerCase();

            let filteredMasterItems = masterItems;
            if (stockFilterItemName) {
                filteredMasterItems = masterItems.filter(item =>
                    item.name.toLowerCase().includes(stockFilterItemName)
                );
            }

            if (filteredMasterItems.length === 0) {
                stockReportList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Tidak ada barang master yang cocok untuk laporan stok.</td></tr>';
                return;
            }

            filteredMasterItems.forEach(item => {
                const row = stockReportList.insertRow();
                row.classList.add('hover:bg-gray-50');
                row.insertCell(0).innerText = item.name;
                row.insertCell(1).innerText = item.stock;
                row.insertCell(2).innerText = formatRupiah(item.price);
                row.insertCell(3).innerText = formatRupiah(item.purchasePrice);
            });
        }

        // Custom Message Box (replacing alert and confirm)
        function showMessageBox(message, isConfirm = false, onConfirm = null) {
            const modalId = 'customMessageBox';
            let modal = document.getElementById(modalId);

            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.classList.add('modal');
                modal.innerHTML = `
                    <div class="modal-content">
                        <span class="close-button" onclick="closeMessageBox()">&times;</span>
                        <p id="messageBoxText" class="text-gray-800 text-base mb-6"></p>
                        <div class="flex justify-center gap-4">
                            <button id="messageBoxConfirmBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200" style="display: none;">OK</button>
                            <button id="messageBoxCancelBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-200" style="display: none;">Batal</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            document.getElementById('messageBoxText').innerText = message;
            const confirmBtn = document.getElementById('messageBoxConfirmBtn');
            const cancelBtn = document.getElementById('messageBoxCancelBtn');

            if (isConfirm) {
                confirmBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
                confirmBtn.onclick = () => {
                    closeMessageBox();
                    if (onConfirm) onConfirm();
                };
                cancelBtn.onclick = () => closeMessageBox();
            } else {
                confirmBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'none';
                confirmBtn.onclick = () => closeMessageBox();
            }

            modal.style.display = 'flex';
        }

        function closeMessageBox() {
            const modal = document.getElementById('customMessageBox');
            if (modal) {
                modal.style.display = 'none';
            }
        }

