// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWhiskyCaskVault {
    enum CaskType {
        BOURBON_BARREL,
        SHERRY_BUTT,
        HOGSHEAD,
        PORT_PIPE,
        OTHER
    }

    enum CaskState {
        FILLED,
        MATURATION,
        REGAUGED,
        TRANSFER,
        BOTTLING_READY,
        BOTTLED
    }

    enum GaugeMethod {
        ENTRY,
        WET_DIP,
        DISGORGE,
        TRANSFER
    }

    struct CaskAttributes {
        CaskType caskType;
        uint8 spiritType;
        uint256 fillDate;
        uint256 entryProofGallons;
        uint256 entryWineGallons;
        uint16 entryProof;
        uint256 lastGaugeProofGallons;
        uint256 lastGaugeWineGallons;
        uint16 lastGaugeProof;
        uint256 lastGaugeDate;
        GaugeMethod lastGaugeMethod;
        uint256 estimatedProofGallons;
        CaskState state;
        string warehouseId;
    }

    struct ReserveAttestationPublic {
        uint256 physicalCaskCount;
        uint256 totalTokenSupply;
        uint256 tokensPerCask;
        uint256 reserveRatio;
        uint256 timestamp;
        bytes32 attestationHash;
    }

    struct ReserveAttestationPrivate {
        bool isFullyReserved;
        uint256 timestamp;
        bytes32 attestationHash;
    }

    struct CaskAttributesInput {
        uint256 caskId;
        CaskAttributes attributes;
    }

    function getCaskAttributes(uint256 caskId) external view returns (CaskAttributes memory);

    function latestPublicReserveAttestation()
        external
        view
        returns (ReserveAttestationPublic memory);

    function latestPrivateReserveAttestation()
        external
        view
        returns (ReserveAttestationPrivate memory);

    function totalMinted() external view returns (uint256);
}
