// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * CertificateVerifier — Ethereum Sepolia Testnet
 *
 * CARA DEPLOY (Langkah 6-7):
 * 1. Buka https://remix.ethereum.org
 * 2. Buat file baru → paste semua isi file ini
 * 3. Tab "Solidity Compiler" → pilih versi 0.8.0+ → klik Compile
 * 4. Tab "Deploy & Run Transactions"
 *    - Environment: Injected Provider - MetaMask
 *    - Pastikan MetaMask di network Sepolia
 * 5. Klik Deploy → Confirm di MetaMask
 * 6. Copy CONTRACT ADDRESS yang muncul → paste ke script.js dan verify.html
 */

contract CertificateVerifier {

    address public owner;

    mapping(bytes32 => bool) private certificates;
    mapping(bytes32 => uint256) private timestamps;
    mapping(bytes32 => string) private certIds;

    event CertificateStored(
        bytes32 indexed hash,
        string certId,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can store certificates");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function storeCertificate(
        bytes32 hash,
        string calldata certId
    ) external onlyOwner {
        require(!certificates[hash], "Hash sudah tersimpan");
        certificates[hash] = true;
        timestamps[hash] = block.timestamp;
        certIds[hash] = certId;
        emit CertificateStored(hash, certId, block.timestamp);
    }

    // Batch — hemat gas untuk 200+ sertifikat
    function storeBatch(
        bytes32[] calldata hashes,
        string[] calldata ids
    ) external onlyOwner {
        require(hashes.length == ids.length, "Length tidak sama");
        for (uint i = 0; i < hashes.length; i++) {
            if (!certificates[hashes[i]]) {
                certificates[hashes[i]] = true;
                timestamps[hashes[i]] = block.timestamp;
                certIds[hashes[i]] = ids[i];
                emit CertificateStored(hashes[i], ids[i], block.timestamp);
            }
        }
    }

    function verifyCertificate(
        bytes32 hash
    ) external view returns (
        bool isValid,
        uint256 issuedAt,
        string memory certId
    ) {
        return (
            certificates[hash],
            timestamps[hash],
            certIds[hash]
        );
    }
}
