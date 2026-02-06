// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWhiskyCaskVault} from "./interfaces/IWhiskyCaskVault.sol";

contract WhiskyCaskVault is IWhiskyCaskVault {
    address public owner;
    mapping(address => bool) public reporters;

    uint256 public override totalMinted;

    mapping(uint256 => CaskAttributes) private caskAttributesById;
    ReserveAttestationPublic private publicReserveAttestation;
    ReserveAttestationPrivate private privateReserveAttestation;

    event ReporterUpdated(address indexed reporter, bool allowed);
    event TotalMintedUpdated(uint256 totalMintedUnits);
    event CaskAttributesUpdated(uint256 indexed caskId, uint256 timestamp);
    event ReserveAttestationPublicUpdated(
        uint256 physicalCaskCount,
        uint256 totalTokenSupply,
        uint256 tokensPerCask,
        uint256 reserveRatio,
        uint256 timestamp,
        bytes32 attestationHash
    );
    event ReserveAttestationPrivateUpdated(
        bool isFullyReserved,
        uint256 timestamp,
        bytes32 attestationHash
    );

    event LifecycleTransition(
        uint256 indexed caskId,
        CaskState fromState,
        CaskState toState,
        uint256 timestamp,
        uint256 gaugeProofGallons,
        uint256 gaugeWineGallons,
        uint16 gaugeProof
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyReporter() {
        require(msg.sender == owner || reporters[msg.sender], "not reporter");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        reporters[reporter] = allowed;
        emit ReporterUpdated(reporter, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    function setTotalMinted(uint256 totalMintedUnits) external onlyReporter {
        totalMinted = totalMintedUnits;
        emit TotalMintedUpdated(totalMintedUnits);
    }

    function upsertCaskAttributesBatch(CaskAttributesInput[] calldata updates) external onlyReporter {
        uint256 length = updates.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 caskId = updates[i].caskId;
            caskAttributesById[caskId] = updates[i].attributes;
            emit CaskAttributesUpdated(caskId, block.timestamp);
        }
    }

    function setReserveAttestationPublic(ReserveAttestationPublic calldata attestation)
        external
        onlyReporter
    {
        publicReserveAttestation = attestation;
        emit ReserveAttestationPublicUpdated(
            attestation.physicalCaskCount,
            attestation.totalTokenSupply,
            attestation.tokensPerCask,
            attestation.reserveRatio,
            attestation.timestamp,
            attestation.attestationHash
        );
    }

    function setReserveAttestationPrivate(ReserveAttestationPrivate calldata attestation)
        external
        onlyReporter
    {
        privateReserveAttestation = attestation;
        emit ReserveAttestationPrivateUpdated(
            attestation.isFullyReserved,
            attestation.timestamp,
            attestation.attestationHash
        );
    }

    function recordLifecycleTransition(
        uint256 caskId,
        CaskState toState,
        uint256 timestamp,
        uint256 gaugeProofGallons,
        uint256 gaugeWineGallons,
        uint16 gaugeProof
    ) external onlyReporter {
        CaskAttributes storage current = caskAttributesById[caskId];
        CaskState fromState = current.state;

        current.state = toState;

        if (gaugeProofGallons > 0 || gaugeWineGallons > 0 || gaugeProof > 0) {
            current.lastGaugeProofGallons = gaugeProofGallons;
            current.lastGaugeWineGallons = gaugeWineGallons;
            current.lastGaugeProof = gaugeProof;
            current.lastGaugeDate = timestamp;
        }

        emit LifecycleTransition(
            caskId,
            fromState,
            toState,
            timestamp,
            gaugeProofGallons,
            gaugeWineGallons,
            gaugeProof
        );
    }

    function getCaskAttributes(uint256 caskId)
        external
        view
        override
        returns (CaskAttributes memory)
    {
        return caskAttributesById[caskId];
    }

    function latestPublicReserveAttestation()
        external
        view
        override
        returns (ReserveAttestationPublic memory)
    {
        return publicReserveAttestation;
    }

    function latestPrivateReserveAttestation()
        external
        view
        override
        returns (ReserveAttestationPrivate memory)
    {
        return privateReserveAttestation;
    }
}
