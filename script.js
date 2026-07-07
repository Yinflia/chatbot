document.addEventListener('DOMContentLoaded', () => {
    // ================= CONFIGURATION =================
    const BACKEND_URL = 'http://localhost:3000/api/chat'; 

    // ================= STATE MANAGEMENT =================
    let transactions = JSON.parse(localStorage.getItem('sena_transactions')) || [];
    let conversationHistory = JSON.parse(localStorage.getItem('sena_chat_history')) || [];

    // ================= DOM ELEMENTS =================
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const balanceEl = document.getElementById('balance');
    const transactionForm = document.getElementById('transaction-form');
    const descInput = document.getElementById('desc');
    const amountInput = document.getElementById('amount');
    const typeSelect = document.getElementById('type');
    const tableBody = document.getElementById('transaction-table');

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
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const desc = descInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const type = typeSelect.value;
        
        if (desc && amount > 0) {
            addTransaction(desc, amount, type);
            transactionForm.reset();
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

        // 1. Deteksi dan proses multiple transactions
        const multipleTransactions = parseMultipleTransactions(message);
        
        if (multipleTransactions.length > 0) {
            multipleTransactions.forEach(t => {
                addTransaction(t.desc, t.amount, t.type);
            });
            
            // Tampilkan ringkasan jika ada lebih dari 1 transaksi
            if (multipleTransactions.length > 1) {
                setTimeout(() => {
                    const summary = multipleTransactions.map((t, i) => {
                        const typeLabel = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
                        return `${i+1}. ${typeLabel} - ${t.desc}: Rp ${t.amount.toLocaleString('id-ID')}`;
                    }).join('<br>');
                    
                    appendMessage('bot', `✅ Berhasil mencatat <b>${multipleTransactions.length} transaksi</b>!<br><br>${summary}<br><br>💡 <b>Rekomendasi:</b> Pantau terus riwayat di dashboard agar arus kas Anda terkontrol.`);
                }, 500);
            }
        }

        // 2. Kirim ke Backend (Gemini API)
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
            console.error('Error communicating with backend:', error);
            loadingMsg.remove();
            appendMessage('bot', '⚠️ <b>Terjadi kesalahan koneksi.</b><br>Tidak dapat terhubung ke server SENA.<br><br>💡 <b>Rekomendasi:</b> Periksa koneksi internet Anda atau hubungi tim dukungan SENA.');
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

        if (transactions.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">📭 Belum ada catatan transaksi masuk/keluar.</td></tr>`;
        } else {
            tableBody.innerHTML = transactions.map((t, index) => {
                if (t.type === 'income') totalIncome += t.amount;
                else totalExpense += t.amount;

                const typeLabel = t.type === 'income' ? '<span style="color:green;">📈 Masuk</span>' : '<span style="color:red;">📉 Keluar</span>';
                const amountLabel = t.type === 'income' ? `+ Rp ${t.amount.toLocaleString('id-ID')}` : `- Rp ${t.amount.toLocaleString('id-ID')}`;
                const color = t.type === 'income' ? 'green' : 'red';

                return `
                    <tr>
                        <td>${t.date}</td>
                        <td>${t.desc}</td>
                        <td>${typeLabel}</td>
                        <td style="color:${color}; font-weight:bold;">${amountLabel}</td>
                        <td><button onclick="window.deleteItem(${index})" style="background:#dc3545; padding:5px 10px; font-size:12px; border-radius:4px; color:white; border:none; cursor:pointer;">Hapus</button></td>
                    </tr>
                `;
            }).join('');
        }

        const balance = totalIncome - totalExpense;
        totalIncomeEl.textContent = `Rp ${totalIncome.toLocaleString('id-ID')}`;
        totalExpenseEl.textContent = `Rp ${totalExpense.toLocaleString('id-ID')}`;
        balanceEl.textContent = `Rp ${balance.toLocaleString('id-ID')}`;
        balanceEl.style.color = balance < 0 ? '#dc3545' : '#28a745';
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

    // ================= MULTI-TRANSACTION PARSING (FIXED) =================
    
    function parseMultipleTransactions(text) {
        const results = [];
        if (isFutureIntent(text)) return [];

        // 1. Potong kalimat berdasarkan kata pemisah: dan, serta, lalu, koma, dll.
        const chunks = text.split(/\b(?:dan|serta|lalu|kemudian|plus|sama)\b|,|;/i)
                           .map(c => c.trim())
                           .filter(c => c.length > 0);

        if (chunks.length === 0) chunks.push(text);

        // 2. Proses setiap bagian secara INDEPENDEN (Tidak digabung lagi!)
        chunks.forEach(chunk => {
            let parsed = parseTransactionIntent(chunk);
            
            if (parsed) {
                results.push(parsed);
            } else {
                // Fallback untuk fragmen tanpa kata kerja (contoh: "coklat 12.000")
                const amount = parseIndonesianNumber(chunk);
                if (amount && amount > 0) {
                    const isIncomeChunk = /\b(gaji|gajian|masuk|income|pemasukan|dapat|terima|bonus|jual|dividen|beasiswa|thr)\b/i.test(chunk);
                    const type = isIncomeChunk ? 'income' : 'expense'; // Default ke expense
                    
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

    // ================= LOCAL PARSING HELPERS =================
    function isFutureIntent(text) {
        return /\b(mau|ingin|akan|nanti|berencana|berniat|pengen|bakal)\b/i.test(text.toLowerCase());
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
        // PERBAIKAN KRITIS: Tambahkan \b (word boundary) agar 'm' tidak terbaca dari 'membeli'/'makan'
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