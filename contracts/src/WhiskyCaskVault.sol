// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWhiskyCaskVault} from "./interfaces/IWhiskyCaskVault.sol";

contract WhiskyCaskVault is IWhiskyCaskVault {
    uint256 private constant SINGLE_LIFECYCLE_REPORT_BYTES = 32 * 6;

    error NotOwner();
    error NotReporter();
    error NotReportSource();
    error ContractPaused();
    error ZeroOwner();
    error UnsupportedReportType(uint8 reportTypeRaw);
    error StalePublicAttestation(uint256 lastTimestamp, uint256 incomingTimestamp);
    error StalePrivateAttestation(uint256 lastTimestamp, uint256 incomingTimestamp);
    error UnknownCask(uint256 caskId);
    error InvalidLifecycleTransition(CaskState fromState, CaskState toState);
    error StaleLifecycleEvent(uint256 lastTimestamp, uint256 incomingTimestamp);
    error CaskNotFound(uint256 caskId);

    address public owner;
    address public keystoneForwarder;
    mapping(address => bool) public reporters;
    bool public paused;

    uint256 public override totalMinted;

    mapping(uint256 => CaskAttributes) private caskAttributesById;
    mapping(uint256 => bool) private caskExistsById;
    mapping(uint256 => uint256) private lastLifecycleTimestampByCaskId;
    ReserveAttestationPublic private publicReserveAttestation;
    ReserveAttestationPrivate private privateReserveAttestation;

    event ReporterUpdated(address indexed reporter, bool allowed);
    event KeystoneForwarderUpdated(address indexed forwarder);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
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
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlyReporter() {
        if (!(msg.sender == owner || reporters[msg.sender])) {
            revert NotReporter();
        }
        _;
    }

    modifier onlyReportSource() {
        if (
            !(
                msg.sender == owner
                    || reporters[msg.sender]
                    || (keystoneForwarder != address(0) && msg.sender == keystoneForwarder)
            )
        ) {
            revert NotReportSource();
        }
        _;
    }

    modifier whenNotPaused() {
        if (paused) {
            revert ContractPaused();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        reporters[reporter] = allowed;
        emit ReporterUpdated(reporter, allowed);
    }

    function setKeystoneForwarder(address forwarder) external onlyOwner {
        keystoneForwarder = forwarder;
        emit KeystoneForwarderUpdated(forwarder);
    }

    function setPaused(bool isPaused) external onlyOwner {
        if (paused == isPaused) {
            return;
        }

        paused = isPaused;
        if (isPaused) {
            emit Paused(msg.sender);
        } else {
            emit Unpaused(msg.sender);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert ZeroOwner();
        }
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function onReport(bytes calldata report) external override onlyReportSource whenNotPaused {
        _handleReport(report);
    }

    function onReport(bytes calldata, bytes calldata report)
        external
        override
        onlyReportSource
        whenNotPaused
    {
        _handleReport(report);
    }

    function _handleReport(bytes calldata report) internal {
        (uint8 reportTypeRaw, bytes memory payload) = abi.decode(report, (uint8, bytes));
        if (reportTypeRaw > uint8(ReportType.LIFECYCLE)) {
            revert UnsupportedReportType(reportTypeRaw);
        }
        ReportType reportType = ReportType(reportTypeRaw);

        if (reportType == ReportType.RESERVE_PUBLIC) {
            ReserveAttestationPublic memory attestation = abi.decode(payload, (ReserveAttestationPublic));
            _setReserveAttestationPublic(attestation);
            return;
        }

        if (reportType == ReportType.RESERVE_PRIVATE) {
            ReserveAttestationPrivate memory attestation = abi.decode(payload, (ReserveAttestationPrivate));
            _setReserveAttestationPrivate(attestation);
            return;
        }

        if (reportType == ReportType.CASK_BATCH) {
            CaskAttributesInput[] memory updates = abi.decode(payload, (CaskAttributesInput[]));
            _upsertCaskAttributesBatch(updates);
            return;
        }

        if (reportType == ReportType.LIFECYCLE) {
            if (payload.length == SINGLE_LIFECYCLE_REPORT_BYTES) {
                LifecycleReport memory lifecycleReport = abi.decode(payload, (LifecycleReport));
                _recordLifecycleTransition(
                    lifecycleReport.caskId,
                    lifecycleReport.toState,
                    lifecycleReport.timestamp,
                    lifecycleReport.gaugeProofGallons,
                    lifecycleReport.gaugeWineGallons,
                    lifecycleReport.gaugeProof
                );
                return;
            }

            LifecycleReport[] memory lifecycleReports = abi.decode(payload, (LifecycleReport[]));
            _recordLifecycleBatch(lifecycleReports);
            return;
        }

        revert UnsupportedReportType(reportTypeRaw);
    }

    function setTotalMinted(uint256 totalMintedUnits) external onlyReporter whenNotPaused {
        totalMinted = totalMintedUnits;
        emit TotalMintedUpdated(totalMintedUnits);
    }

    function upsertCaskAttributesBatch(CaskAttributesInput[] calldata updates)
        external
        onlyReporter
        whenNotPaused
    {
        _upsertCaskAttributesBatch(updates);
    }

    function _upsertCaskAttributesBatch(CaskAttributesInput[] memory updates) internal {
        uint256 length = updates.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 caskId = updates[i].caskId;
            caskAttributesById[caskId] = updates[i].attributes;
            caskExistsById[caskId] = true;
            if (updates[i].attributes.lastGaugeDate > lastLifecycleTimestampByCaskId[caskId]) {
                lastLifecycleTimestampByCaskId[caskId] = updates[i].attributes.lastGaugeDate;
            }
            emit CaskAttributesUpdated(caskId, block.timestamp);
        }
    }

    function setReserveAttestationPublic(ReserveAttestationPublic calldata attestation)
        external
        onlyReporter
        whenNotPaused
    {
        _setReserveAttestationPublic(attestation);
    }

    function _setReserveAttestationPublic(ReserveAttestationPublic memory attestation) internal {
        if (!(attestation.timestamp > publicReserveAttestation.timestamp)) {
            revert StalePublicAttestation(publicReserveAttestation.timestamp, attestation.timestamp);
        }
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
        whenNotPaused
    {
        _setReserveAttestationPrivate(attestation);
    }

    function _setReserveAttestationPrivate(ReserveAttestationPrivate memory attestation) internal {
        if (!(attestation.timestamp > privateReserveAttestation.timestamp)) {
            revert StalePrivateAttestation(privateReserveAttestation.timestamp, attestation.timestamp);
        }
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
    ) external onlyReporter whenNotPaused {
        _recordLifecycleTransition(
            caskId,
            toState,
            timestamp,
            gaugeProofGallons,
            gaugeWineGallons,
            gaugeProof
        );
    }

    function _recordLifecycleTransition(
        uint256 caskId,
        CaskState toState,
        uint256 timestamp,
        uint256 gaugeProofGallons,
        uint256 gaugeWineGallons,
        uint16 gaugeProof
    ) internal {
        if (!caskExistsById[caskId]) {
            revert UnknownCask(caskId);
        }
        CaskAttributes storage current = caskAttributesById[caskId];
        CaskState fromState = current.state;
        if (!_isValidLifecycleTransition(fromState, toState)) {
            revert InvalidLifecycleTransition(fromState, toState);
        }
        if (!(timestamp > lastLifecycleTimestampByCaskId[caskId])) {
            revert StaleLifecycleEvent(lastLifecycleTimestampByCaskId[caskId], timestamp);
        }

        current.state = toState;
        lastLifecycleTimestampByCaskId[caskId] = timestamp;

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

    function _recordLifecycleBatch(LifecycleReport[] memory lifecycleReports) internal {
        uint256 length = lifecycleReports.length;
        for (uint256 i = 0; i < length; i++) {
            LifecycleReport memory lifecycleReport = lifecycleReports[i];
            _recordLifecycleTransition(
                lifecycleReport.caskId,
                lifecycleReport.toState,
                lifecycleReport.timestamp,
                lifecycleReport.gaugeProofGallons,
                lifecycleReport.gaugeWineGallons,
                lifecycleReport.gaugeProof
            );
        }
    }

    function _isValidLifecycleTransition(CaskState fromState, CaskState toState)
        internal
        pure
        returns (bool)
    {
        if (fromState == CaskState.BOTTLED) {
            return false;
        }

        if (fromState == toState) {
            return false;
        }

        if (fromState == CaskState.FILLED) {
            return toState == CaskState.MATURATION;
        }

        if (fromState == CaskState.MATURATION) {
            return toState == CaskState.REGAUGED
                || toState == CaskState.TRANSFER
                || toState == CaskState.BOTTLING_READY;
        }

        if (fromState == CaskState.REGAUGED) {
            return toState == CaskState.MATURATION
                || toState == CaskState.TRANSFER
                || toState == CaskState.BOTTLING_READY;
        }

        if (fromState == CaskState.TRANSFER) {
            return toState == CaskState.MATURATION
                || toState == CaskState.REGAUGED
                || toState == CaskState.BOTTLING_READY;
        }

        if (fromState == CaskState.BOTTLING_READY) {
            return toState == CaskState.BOTTLED;
        }

        return false;
    }

    function getCaskAttributes(uint256 caskId)
        external
        view
        override
        returns (CaskAttributes memory)
    {
        if (!caskExistsById[caskId]) {
            revert CaskNotFound(caskId);
        }
        return caskAttributesById[caskId];
    }

    function caskExists(uint256 caskId) external view override returns (bool) {
        return caskExistsById[caskId];
    }

    function lastLifecycleTimestamp(uint256 caskId) external view override returns (uint256) {
        return lastLifecycleTimestampByCaskId[caskId];
    }

    function lastLifecycleTimestamps(uint256[] calldata caskIds)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 length = caskIds.length;
        uint256[] memory timestamps = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            timestamps[i] = lastLifecycleTimestampByCaskId[caskIds[i]];
        }
        return timestamps;
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
