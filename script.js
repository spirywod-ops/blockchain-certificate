/*
|--------------------------------------------------------------------------
| GLOBAL STATE
|--------------------------------------------------------------------------
*/

let allStudents = [];
let currentStudentIndex = 0;
let signer;
let contract;

const CONTRACT_ADDRESS = "0x97FD52D4aeeF99D423799EDa0Bc53312351d0144";

const ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "hash", "type": "bytes32" },
            { "indexed": false, "internalType": "string", "name": "certId", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "CertificateStored",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32[]", "name": "hashes", "type": "bytes32[]" },
            { "internalType": "string[]", "name": "ids", "type": "string[]" }
        ],
        "name": "storeBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "hash", "type": "bytes32" },
            { "internalType": "string", "name": "certId", "type": "string" }
        ],
        "name": "storeCertificate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "hash", "type": "bytes32" }],
        "name": "verifyCertificate",
        "outputs": [
            { "internalType": "bool", "name": "isValid", "type": "bool" },
            { "internalType": "uint256", "name": "issuedAt", "type": "uint256" },
            { "internalType": "string", "name": "certId", "type": "string" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

/*
|--------------------------------------------------------------------------
| WALLET CONNECTION
|--------------------------------------------------------------------------
*/

async function connectWallet() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }]
        });

        await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();

        console.log("network =", network);

        alert(
            "Network: " + network.name +
            "\nChain ID: " + network.chainId
        );

        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        console.log("signer =", signer);
        console.log("contract =", contract);

        document.getElementById("status").textContent = "Wallet Connected";
        alert("Wallet Connected");

    } catch (err) {
        console.error("CONNECT ERROR:", err);
        alert(err.message);
    }
}

/*
|--------------------------------------------------------------------------
| BUILD CERTIFICATE DATA / HASH
|--------------------------------------------------------------------------
*/

function buildCertificateData(mahasiswa) {
    return {
        certificate_id: mahasiswa.certificate_id,
        nama: mahasiswa.nama,
        nim: mahasiswa.nim,
        prodi: mahasiswa.prodi,
        angkatan: mahasiswa.angkatan,
        kegiatan: mahasiswa.kegiatan,
        tanggal: mahasiswa.tanggal
    };
}

function hashCertificateData(certificateData) {
    return CryptoJS.SHA256(JSON.stringify(certificateData)).toString();
}

/*
|--------------------------------------------------------------------------
| SAVE CURRENT CERTIFICATE TO BLOCKCHAIN
|--------------------------------------------------------------------------
*/

async function saveCurrentCertificate() {

    if (!contract) {
        alert("Connect Wallet terlebih dahulu");
        return;
    }

    try {
        const mahasiswa = allStudents[currentStudentIndex];
        const certificateData = buildCertificateData(mahasiswa);
        const hashBytes32 = "0x" + hashCertificateData(certificateData);

        document.getElementById("status").textContent = "Mengirim transaksi...";

        const tx = await contract.storeCertificate(
            hashBytes32,
            mahasiswa.certificate_id
        );

        await tx.wait();

        document.getElementById("status").textContent = "Saved To Blockchain";
        alert("Berhasil disimpan\n\nTX HASH:\n" + tx.hash);

    } catch (err) {
        console.error(err);

        if (err.message.includes("Hash sudah tersimpan")) {
            alert("Sertifikat ini sudah tersimpan di blockchain");
        } else {
            alert("Gagal menyimpan ke blockchain\n\n" + err.message);
        }
    }
}

/*
|--------------------------------------------------------------------------
| SAVE ALL CERTIFICATES TO BLOCKCHAIN (BATCH)
|--------------------------------------------------------------------------
*/

const BATCH_CHUNK_SIZE = 100;

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

async function saveAllCertificates() {

    if (!contract) {
        alert("Connect Wallet terlebih dahulu");
        return;
    }

    if (allStudents.length === 0) {
        alert("CSV belum berhasil dimuat");
        return;
    }

    const status = document.getElementById("status");
    const chunks = chunkArray(allStudents, BATCH_CHUNK_SIZE);

    const confirmMsg =
        `Akan mengirim ${allStudents.length} sertifikat dalam ` +
        `${chunks.length} transaksi batch (maks ${BATCH_CHUNK_SIZE} per transaksi).\n\n` +
        `Setiap batch butuh approval wallet terpisah. Lanjutkan?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    let successCount = 0;
    let skippedCount = 0;
    const failedChunks = [];

    for (let c = 0; c < chunks.length; c++) {

        const chunk = chunks[c];
        const hashes = [];
        const ids = [];

        for (const mahasiswa of chunk) {
            const certificateData = buildCertificateData(mahasiswa);
            const hash = "0x" + hashCertificateData(certificateData);

            hashes.push(hash);
            ids.push(mahasiswa.certificate_id);
        }

        status.textContent =
            `Mengirim batch ${c + 1} / ${chunks.length} ` +
            `(${chunk.length} sertifikat)...`;

        try {
            const tx = await contract.storeBatch(hashes, ids);
            await tx.wait();

            successCount += chunk.length;
            console.log(`Batch ${c + 1} berhasil. TX HASH: ${tx.hash}`);

        } catch (err) {
            console.error(`Batch ${c + 1} gagal:`, err);

            if (err.message.includes("Hash sudah tersimpan")) {
                skippedCount += chunk.length;
            } else {
                failedChunks.push(c + 1);
            }
        }
    }

    status.textContent =
        `Selesai. Berhasil: ${successCount}, ` +
        `Sudah tersimpan sebelumnya: ${skippedCount}, ` +
        `Gagal: ${failedChunks.length} batch`;

    let summary =
        `Proses batch selesai.\n\n` +
        `Berhasil disimpan: ${successCount}\n` +
        `Sudah tersimpan sebelumnya: ${skippedCount}\n`;

    if (failedChunks.length > 0) {
        summary += `Batch gagal (cek console untuk detail): ${failedChunks.join(", ")}`;
    }

    alert(summary);
}

/*
|--------------------------------------------------------------------------
| TAMPILKAN SERTIFIKAT
|--------------------------------------------------------------------------
*/

function tampilkanSertifikat(mahasiswa) {

    document.getElementById("nama").textContent = mahasiswa.nama;
    document.getElementById("nim").textContent = mahasiswa.nim;
    document.getElementById("prodi").textContent = mahasiswa.prodi;
    document.getElementById("angkatan").textContent = mahasiswa.angkatan;
    document.getElementById("tanggal").textContent = mahasiswa.tanggal;
    document.getElementById("certificate_id").textContent = mahasiswa.certificate_id;
    document.getElementById("kegiatan").textContent = mahasiswa.kegiatan;

    const certificateData = buildCertificateData(mahasiswa);
    const hash = hashCertificateData(certificateData);

    const qrData = {
        ...certificateData,
        hash: hash
    };

    document.getElementById("qrcode").innerHTML = "";

    new QRCode(document.getElementById("qrcode"), {
        text: JSON.stringify(qrData),
        width: 145,
        height: 145
    });
}

/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFileName(text) {
    return String(text)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-")
        .replace(/[^A-Z0-9-]/g, "");
}

function extractCertNumber(certificateId) {
    const match = String(certificateId).match(/(\d+)\s*$/);
    return match ? match[1] : certificateId;
}

function extractYear(tanggal) {
    const match = String(tanggal).match(/^(\d{4})/);
    return match ? match[1] : tanggal;
}

function buildCertificateFileName(mahasiswa) {
    const kegiatan = sanitizeFileName(mahasiswa.kegiatan);
    const tahun = extractYear(mahasiswa.tanggal);
    const nama = sanitizeFileName(mahasiswa.nama);
    const nomor = extractCertNumber(mahasiswa.certificate_id);

    return `SERTIFIKAT-${kegiatan}-${tahun}-${nama}-${nomor}.png`;
}

/*
|--------------------------------------------------------------------------
| LOAD CSV
|--------------------------------------------------------------------------
*/

Papa.parse("students.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,

    complete: function (results) {

        allStudents = results.data;

        if (allStudents.length === 0) {
            alert("Data mahasiswa tidak ditemukan");
            return;
        }

        currentStudentIndex = 0;
        tampilkanSertifikat(allStudents[currentStudentIndex]);

        document.getElementById("status").textContent =
            `Ready (${allStudents.length} mahasiswa)`;

        console.log(`Berhasil memuat ${allStudents.length} mahasiswa`);
    }
});

/*
|--------------------------------------------------------------------------
| NAVIGASI: NEXT / PREVIOUS
|--------------------------------------------------------------------------
*/

document.getElementById("nextBtn").addEventListener("click", () => {

    if (currentStudentIndex < allStudents.length - 1) {
        currentStudentIndex++;
        tampilkanSertifikat(allStudents[currentStudentIndex]);

        document.getElementById("status").textContent =
            `Data ${currentStudentIndex + 1} / ${allStudents.length}`;
    }
});

document.getElementById("prevBtn").addEventListener("click", () => {

    if (currentStudentIndex > 0) {
        currentStudentIndex--;
        tampilkanSertifikat(allStudents[currentStudentIndex]);

        document.getElementById("status").textContent =
            `Data ${currentStudentIndex + 1} / ${allStudents.length}`;
    }
});

/*
|--------------------------------------------------------------------------
| GENERATE ZIP (SEMUA SERTIFIKAT SEBAGAI PNG)
|--------------------------------------------------------------------------
*/

document.getElementById("generateAllBtn").addEventListener("click", async () => {

    if (allStudents.length === 0) {
        alert("CSV belum berhasil dimuat");
        return;
    }

    const zip = new JSZip();
    const certificateElement = document.querySelector(".certificate");
    const status = document.getElementById("status");

    try {
        for (let i = 0; i < allStudents.length; i++) {

            const mahasiswa = allStudents[i];
            status.textContent = `Generate ${i + 1} / ${allStudents.length}`;

            tampilkanSertifikat(mahasiswa);
            await delay(500);

            const canvas = await html2canvas(certificateElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            });

            const imageData = canvas.toDataURL("image/png");
            const base64 = imageData.split(",")[1];

            zip.file(
                buildCertificateFileName(mahasiswa),
                base64,
                { base64: true }
            );
        }

        status.textContent = "Membuat ZIP...";

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, "certificates.zip");

        status.textContent = `Selesai! ${allStudents.length} sertifikat berhasil dibuat`;
        alert("certificates.zip berhasil dibuat");

        // Kembalikan tampilan ke sertifikat yang sedang aktif sebelum batch generate
        tampilkanSertifikat(allStudents[currentStudentIndex]);

    } catch (error) {
        console.error(error);
        status.textContent = "Terjadi error";
        alert("Gagal membuat ZIP. Lihat Console.");
    }
});

/*
|--------------------------------------------------------------------------
| EVENT LISTENERS LAINNYA
|--------------------------------------------------------------------------
*/

document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
document.getElementById("saveBlockchainBtn").addEventListener("click", saveCurrentCertificate);

// Opsional: hanya aktif jika tombol "saveAllBlockchainBtn" ada di HTML
const saveAllBtn = document.getElementById("saveAllBlockchainBtn");
if (saveAllBtn) {
    saveAllBtn.addEventListener("click", saveAllCertificates);
}