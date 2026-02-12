// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWhiskyCaskVault {
    enum CaskType {
        BOURBON_BARREL,
        SHERRY_BUTT,
        HOGSHEAD,
        PORT_PIPE
    }

    enum SpiritType {
        BOURBON,
        RYE,
        MALT,
        WHEAT
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

    enum ReportType {
        RESERVE_PUBLIC,
        RESERVE_PRIVATE,
        CASK_BATCH,
        LIFECYCLE
    }

    struct CaskAttributes {
        CaskType caskType;
        SpiritType spiritType;
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
        bytes16 warehouseCode;
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

    struct LifecycleReport {
        uint256 caskId;
        CaskState toState;
        uint256 timestamp;
        uint256 gaugeProofGallons;
        uint256 gaugeWineGallons;
        uint16 gaugeProof;
    }

    function onReport(bytes calldata report) external;

    function onReport(bytes calldata metadata, bytes calldata report) external;

    function setPaused(bool isPaused) external;

    function getCaskAttributes(uint256 caskId) external view returns (CaskAttributes memory);

    function caskExists(uint256 caskId) external view returns (bool);

    function lastLifecycleTimestamp(uint256 caskId) external view returns (uint256);

    function lastLifecycleTimestamps(uint256[] calldata caskIds)
        external
        view
        returns (uint256[] memory);

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
