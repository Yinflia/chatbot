document.addEventListener('DOMContentLoaded', () => {
    // ================= CONFIGURATION =================
    const BACKEND_URL = 'http://localhost:3000/api/chat'; 

    // ================= STATE MANAGEMENT =================
    let transactions = JSON.parse(localStorage.getItem('sena_transactions')) || [];
    let conversationHistory = JSON.parse(localStorage.getItem('sena_chat_history')) || [];

    // ================= DOM ELEMENTS (Sesuai HTML Tailwind Terbaru) =================
    const totalPemasukanEl = document.getElementById('total-pemasukan');
    const totalPengeluaranEl = document.getElementById('total-pengeluaran');
    const sisaSaldoEl = document.getElementById('sisa-saldo');
    const garisSaldoEl = document.getElementById('garis-saldo');
    const boxIkonSaldoEl = document.getElementById('box-ikon-saldo');
    const formTransaksi = document.getElementById('form-transaksi');
    const inputDeskripsi = document.getElementById('deskripsi');
    const inputJumlah = document.getElementById('jumlah');
    const selectJenis = document.getElementById('jenis');
    const tabelTransaksi = document.getElementById('tabel-transaksi');
    const cardTransaksi = document.getElementById('card-transaksi');
    const pesanKosong = document.getElementById('pesan-kosong');

    const chatToggle = document.getElementById('chat-toggle');
    const chatPopup = document.getElementById('chat-popup');
    const closeChat = document.getElementById('close-chat');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');

    // ================= INITIALIZATION =================
    renderTransactions();
    renderChatHistory();

    // ================= EVENT LISTENERS =================
    formTransaksi.addEventListener('submit', (e) => {
        e.preventDefault();
        const desc = inputDeskripsi.value.trim();
        const amountStr = inputJumlah.value.trim();
        const type = selectJenis.value === 'pemasukan' ? 'income' : 'expense';
        const amount = parseIndonesianNumber(amountStr);
        
        if (desc && amount > 0) {
            addTransaction(desc, amount, type);
            formTransaksi.reset();
        }
    });

    chatToggle.addEventListener('click', () => chatPopup.classList.add('active'));
    closeChat.addEventListener('click', () => chatPopup.classList.remove('active'));

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        userInput.value = '';

        // ✅ PERBAIKAN: Parsing transaksi sekarang dilakukan PER CHUNK
        const multipleTransactions = parseMultipleTransactions(message);
        
        if (multipleTransactions.length > 0) {
            multipleTransactions.forEach(t => {
                addTransaction(t.desc, t.amount, t.type);
            });
            
            if (multipleTransactions.length > 1) {
                setTimeout(() => {
                    const summary = multipleTransactions.map((t, i) => {
                        const typeLabel = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
                        return `${i+1}. ${typeLabel} - ${t.desc}: Rp ${t.amount.toLocaleString('id-ID')}`;
                    }).join('<br>');
                    
                    appendMessage('bot', `✅ Berhasil mencatat <b>${multipleTransactions.length} transaksi</b>!<br><br>${summary}<br><br>💡 <b>Rekomendasi:</b> Pantau terus riwayat di dashboard agar arus kas Anda terkontrol.`);
                }, 500);
            } else if (multipleTransactions.length === 1) {
                // Konfirmasi untuk 1 transaksi
                setTimeout(() => {
                    const t = multipleTransactions[0];
                    const typeLabel = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
                    appendMessage('bot', `✅ Siap! Saya sudah mencatat ${typeLabel} "<b>${t.desc}</b>" sebesar Rp ${t.amount.toLocaleString('id-ID')}.<br><br>💡 <b>Rekomendasi:</b> Pantau terus riwayat di dashboard agar arus kas Anda terkontrol.`);
                }, 500);
            }
        }

        // Kirim ke Backend (Tetap kirim pesan utuh agar AI bisa merespons konteks "ingin beli mobil")
        conversationHistory.push({ role: 'user', text: message });
        saveChatHistory();

        const loadingMsg = appendMessage('bot', '⏳ <i>SENA sedang berpikir...</i>');

        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: conversationHistory })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            const botReply = data.output;

            loadingMsg.remove();
            appendMessage('bot', botReply);

            conversationHistory.push({ role: 'model', text: botReply });
            saveChatHistory();

            if (conversationHistory.length > 20) {
                conversationHistory = conversationHistory.slice(-20);
                saveChatHistory();
            }
        } catch (error) {
            console.error('Error:', error);
            loadingMsg.remove();
            appendMessage('bot', '⚠️ <b>Terjadi kesalahan koneksi.</b><br>Tidak dapat terhubung ke server SENA.');
        }
    });

    // ================= CORE FUNCTIONS =================
    function getCurrentBalance() {
        let totalIncome = 0;
        let totalExpense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });
        return totalIncome - totalExpense;
    }

    function addTransaction(desc, amount, type) {
        const lastTrans = transactions[0];
        if (lastTrans && lastTrans.desc === desc && lastTrans.amount === amount && lastTrans.type === type) return;

        const newTransaction = {
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            desc: desc, type: type, amount: amount
        };
        transactions.unshift(newTransaction);
        saveAndRender();
    }

    function deleteTransaction(index) {
        if (confirm('Hapus transaksi ini?')) {
            transactions.splice(index, 1);
            saveAndRender();
        }
    }

    function saveAndRender() {
        localStorage.setItem('sena_transactions', JSON.stringify(transactions));
        renderTransactions();
    }

    function renderTransactions() {
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });

        const balance = totalIncome - totalExpense;

        totalPemasukanEl.textContent = `Rp ${totalIncome.toLocaleString('id-ID')}`;
        totalPengeluaranEl.textContent = `Rp ${totalExpense.toLocaleString('id-ID')}`;
        sisaSaldoEl.textContent = `Rp ${balance.toLocaleString('id-ID')}`;

        if (balance < 0) {
            garisSaldoEl.className = 'absolute top-0 left-0 w-2 h-full bg-rose-600';
            sisaSaldoEl.className = 'text-xl sm:text-2xl lg:text-3xl font-extrabold text-rose-600 mt-2 truncate';
            boxIkonSaldoEl.textContent = '⚠️';
        } else {
            garisSaldoEl.className = 'absolute top-0 left-0 w-2 h-full bg-indigo-600';
            sisaSaldoEl.className = 'text-xl sm:text-2xl lg:text-3xl font-extrabold text-indigo-600 mt-2 truncate';
            boxIkonSaldoEl.textContent = '⚖️';
        }

        if (transactions.length === 0) {
            tabelTransaksi.innerHTML = '';
            cardTransaksi.innerHTML = '';
            pesanKosong.classList.remove('hidden');
            return;
        }

        pesanKosong.classList.add('hidden');

        // Render Tabel (Desktop)
        tabelTransaksi.innerHTML = transactions.map((t, index) => {
            const typeLabel = t.type === 'income' ? '<span class="text-emerald-600 font-semibold">Masuk</span>' : '<span class="text-rose-600 font-semibold">Keluar</span>';
            const amountLabel = t.type === 'income' ? `<span class="text-emerald-600 font-bold">+ Rp ${t.amount.toLocaleString('id-ID')}</span>` : `<span class="text-rose-600 font-bold">- Rp ${t.amount.toLocaleString('id-ID')}</span>`;
            
            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-3 sm:px-4 py-3 text-slate-600">${t.date}</td>
                    <td class="px-3 sm:px-4 py-3 text-slate-800 font-medium">${t.desc}</td>
                    <td class="px-3 sm:px-4 py-3 text-center">${typeLabel}</td>
                    <td class="px-3 sm:px-4 py-3 text-right">${amountLabel}</td>
                    <td class="px-3 sm:px-4 py-3 text-center">
                        <button onclick="window.deleteItem(${index})" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors">Hapus</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Card (Mobile)
        cardTransaksi.innerHTML = transactions.map((t, index) => {
            const typeLabel = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
            const typeColor = t.type === 'income' ? 'text-emerald-600' : 'text-rose-600';
            const amountLabel = t.type === 'income' ? `+ Rp ${t.amount.toLocaleString('id-ID')}` : `- Rp ${t.amount.toLocaleString('id-ID')}`;
            
            return `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1 min-w-0 mr-3">
                            <p class="text-xs text-slate-400 font-medium mb-0.5">${t.date}</p>
                            <p class="text-sm font-bold text-slate-800 truncate">${t.desc}</p>
                        </div>
                        <p class="text-sm font-bold ${typeColor} whitespace-nowrap">${amountLabel}</p>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs px-2 py-1 rounded-md ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} font-semibold">${typeLabel}</span>
                        <button onclick="window.deleteItem(${index})" class="text-rose-500 hover:text-rose-700 text-xs font-semibold px-2 py-1">Hapus</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.deleteItem = (index) => deleteTransaction(index);

    // ================= CHAT LOGIC =================
    function renderChatHistory() {
        conversationHistory.forEach(msg => {
            const senderClass = msg.role === 'user' ? 'user' : 'bot';
            appendMessage(senderClass, msg.text);
        });
    }

    function saveChatHistory() {
        localStorage.setItem('sena_chat_history', JSON.stringify(conversationHistory));
    }

    window.clearChat = function() {
        if (confirm('Hapus semua riwayat chat?')) {
            conversationHistory = [];
            saveChatHistory();
            chatBox.innerHTML = '';
        }
    }
    
    function appendMessage(sender, text) {
        const msg = document.createElement('div');
        msg.classList.add('message', sender);
        msg.innerHTML = text; 
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
        return msg;
    }

    // ================= PARSING LOGIC (FIXED FOR MIXED INTENTS) =================
    
    function isFutureIntent(text) {
        const lowerText = text.toLowerCase();
        const futureKeywords = ['ingin', 'mau', 'akan', 'nanti', 'berencana', 'berniat', 'pengen', 'bakal', 'berharap', 'bermaksud'];
        return futureKeywords.some(keyword => lowerText.includes(keyword));
    }

    function parseMultipleTransactions(text) {
        const results = [];
        
        // 1. Potong kalimat berdasarkan kata pemisah
        const chunks = text.split(/\b(?:dan|serta|lalu|kemudian|plus|sama)\b|,|;/i)
                           .map(c => c.trim())
                           .filter(c => c.length > 0);

        if (chunks.length === 0) chunks.push(text);

        // 2. Evaluasi SETIAP CHUNK secara terpisah
        chunks.forEach(chunk => {
            // ✅ PERBAIKAN: Cek future intent PER CHUNK, bukan per kalimat utuh
            if (isFutureIntent(chunk)) {
                console.log(`🚫 Skipping future intent chunk: "${chunk}"`);
                return; // Lewati chunk ini, jangan catat
            }

            let parsed = parseTransactionIntent(chunk);
            
            if (parsed) {
                results.push(parsed);
            } else {
                // Fallback untuk fragmen tanpa kata kerja
                const amount = parseIndonesianNumber(chunk);
                if (amount && amount > 0) {
                    const isIncomeChunk = /\b(gaji|gajian|masuk|income|pemasukan|dapat|terima|bonus|jual|dividen|beasiswa|thr)\b/i.test(chunk);
                    const type = isIncomeChunk ? 'income' : 'expense';
                    const desc = extractCleanDescription(chunk, amount, type);
                    results.push({ desc, amount, type });
                }
            }
        });

        // Hapus duplikat
        return results.filter((t, index, self) => 
            index === self.findIndex((t2) => t2.desc === t.desc && t2.amount === t.amount && t2.type === t.type)
        );
    }

    function parseTransactionIntent(text) {
        const amount = parseIndonesianNumber(text);
        if (!amount || amount <= 0) return null;

        const lowerText = text.toLowerCase();
        const incomeKeywords = /\b(gajian|gaji|gajihan|masuk|income|pemasukan|dapat|terima|bonus|jual|dividen|dikasih|diberi|beasiswa|thr)\b/i;
        const expenseKeywords = /\b(belanja|makan|beli|bayar|keluar|expense|pengeluaran|jajan|minum|habis|tarik|transfer|kasih|pinjam|atca|ngetca|beliatca|belu)\b/i;
        
        let type = null;
        if (incomeKeywords.test(lowerText)) type = 'income';
        else if (expenseKeywords.test(lowerText)) type = 'expense';
        else return null; 

        return { desc: extractCleanDescription(text, amount, type), amount, type };
    }

    function extractCleanDescription(text, amount, type) {
        const lowerText = text.toLowerCase();
        const keywordMap = {
            'income': [
                { words: ['gaji', 'gajian', 'gajihan', 'thr'], desc: 'Gaji' },
                { words: ['beasiswa'], desc: 'Beasiswa' },
                { words: ['bonus'], desc: 'Bonus' },
                { words: ['jual', 'jualan'], desc: 'Penjualan' },
                { words: ['investasi', 'saham', 'dividen'], desc: 'Investasi' }
            ],
            'expense': [
                { words: ['makan', 'minum', 'kopi', 'teh', 'jajan', 'snack', 'matcha', 'boba', 'coklat', 'cokelat'], desc: 'Makan & Minum' },
                { words: ['belanja', 'atca', 'ngetca', 'beliatca', 'belu', 'supermarket', 'minimarket', 'swalayan'], desc: 'Belanja' },
                { words: ['bensin', 'motor', 'mobil', 'parkir', 'tol', 'gojek', 'grab'], desc: 'Transportasi' },
                { words: ['listrik', 'air', 'internet', 'pulsa', 'tagihan', 'bayar'], desc: 'Tagihan' },
                { words: ['sewa', 'kontrakan', 'kos', 'kost'], desc: 'Sewa & Hunian' },
                { words: ['obat', 'dokter', 'klinik', 'rs', 'rumah sakit'], desc: 'Kesehatan' },
                { words: ['beli', 'baju', 'sepatu', 'barang', 'laptop', 'hp'], desc: 'Pembelian' }
            ]
        };

        const categoryKeywords = keywordMap[type] || [];
        for (const item of categoryKeywords) {
            for (const word of item.words) {
                if (lowerText.includes(word)) return item.desc;
            }
        }

        let cleanText = text
            .replace(/[\d.,]+/g, '') 
            .replace(/\s*\b(rb|ribu|jt|juta|m|mil|miliar|milgar)\b/gi, '') 
            .replace(/\b(catat|tolong|mohon|saya|aku|habis|uang|rupiah|rp|untuk|sebesar|sebanyak|dengan|yang|lagi|sedang|mau|ingin|dapat|terima|mendapatkan|dikasih|diberi|akan|nanti|berencana|berniat|pengen|bakal|dan|serta|plus|sama)\b/gi, '') 
            .replace(/[^a-zA-Z0-9\s]/g, ' ') 
            .replace(/\s+/g, ' ') 
            .trim();

        if (cleanText && cleanText.length > 2) {
            return cleanText.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
                .substring(0, 40);
        }
        return type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    }

    function parseNumericString(str) {
        let hasDot = str.includes('.');
        let hasComma = str.includes(',');
        if (hasDot && hasComma) {
            if (str.lastIndexOf('.') < str.lastIndexOf(',')) str = str.replace(/\./g, '').replace(',', '.');
            else str = str.replace(/,/g, '');
        } else if (hasDot) {
            if (/\.\d{3,}/.test(str)) str = str.replace(/\./g, '');
        } else if (hasComma) {
            if (/,\d{3,}/.test(str)) str = str.replace(/,/g, '');
            else str = str.replace(',', '.');
        }
        return parseFloat(str);
    }

    function parseIndonesianNumber(text) {
        const multiplierMatch = text.match(/([\d.,]+)\s*\b(rb|ribu|jt|juta|m|mil|miliar|milgar)\b/i);
        if (multiplierMatch) {
            let num = parseNumericString(multiplierMatch[1]);
            if (isNaN(num)) return null;
            let mult = multiplierMatch[2].toLowerCase();
            let factor = 1;
            if (mult.startsWith('r')) factor = 1000;
            else if (mult.startsWith('j')) factor = 1000000;
            else if (mult.startsWith('m')) factor = 1000000000;
            
            return Math.round(num * factor);
        }
        const numMatch = text.match(/[\d.,]+/);
        if (!numMatch) return null;
        let val = parseNumericString(numMatch[0]);
        return isNaN(val) ? null : Math.round(val);
    }
});