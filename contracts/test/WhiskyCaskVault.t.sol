// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiskyCaskVault} from "../src/WhiskyCaskVault.sol";
import {IWhiskyCaskVault} from "../src/interfaces/IWhiskyCaskVault.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract VaultCaller {
    function callSetReporter(address vault, address reporter, bool allowed) external {
        WhiskyCaskVault(vault).setReporter(reporter, allowed);
    }

    function callTransferOwnership(address vault, address newOwner) external {
        WhiskyCaskVault(vault).transferOwnership(newOwner);
    }

    function callSetKeystoneForwarder(address vault, address forwarder) external {
        WhiskyCaskVault(vault).setKeystoneForwarder(forwarder);
    }

    function callSetPaused(address vault, bool isPaused) external {
        WhiskyCaskVault(vault).setPaused(isPaused);
    }

    function callSetTotalMinted(address vault, uint256 totalMintedUnits) external {
        WhiskyCaskVault(vault).setTotalMinted(totalMintedUnits);
    }

    function callSetReserveAttestationPublic(
        address vault,
        IWhiskyCaskVault.ReserveAttestationPublic calldata attestation
    ) external {
        WhiskyCaskVault(vault).setReserveAttestationPublic(attestation);
    }

    function callOnReport(address vault, bytes calldata report) external {
        IWhiskyCaskVault(vault).onReport(report);
    }

    function callOnReportWithMetadata(
        address vault,
        bytes calldata metadata,
        bytes calldata report
    ) external {
        IWhiskyCaskVault(vault).onReport(metadata, report);
    }
}

contract WhiskyCaskVaultTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant REPORTER_UPDATED_SIG = keccak256("ReporterUpdated(address,bool)");
    bytes32 private constant OWNERSHIP_TRANSFERRED_SIG =
        keccak256("OwnershipTransferred(address,address)");
    bytes32 private constant PAUSED_SIG = keccak256("Paused(address)");
    bytes32 private constant UNPAUSED_SIG = keccak256("Unpaused(address)");
    bytes32 private constant LIFECYCLE_TRANSITION_SIG =
        keccak256("LifecycleTransition(uint256,uint8,uint8,uint256,uint256,uint256,uint16)");

    WhiskyCaskVault private vault;
    VaultCaller private reporter;
    VaultCaller private outsider;
    VaultCaller private forwarder;

    function assertEventEmitted(bytes32 signature, address expectedEmitter) internal {
        Vm.Log[] memory logs = VM.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == expectedEmitter
                    && logs[i].topics.length > 0
                    && logs[i].topics[0] == signature
            ) {
                return;
            }
        }
        revert("expected event not emitted");
    }

    function setUp() public {
        vault = new WhiskyCaskVault();
        reporter = new VaultCaller();
        outsider = new VaultCaller();
        forwarder = new VaultCaller();
    }

    function testOwnerCanSetReporterAndReporterCanMutateState() public {
        VM.recordLogs();
        vault.setReporter(address(reporter), true);
        assertEventEmitted(REPORTER_UPDATED_SIG, address(vault));
        reporter.callSetTotalMinted(address(vault), 47_000);
        require(vault.totalMinted() == 47_000, "totalMinted not updated");
    }

    function testNonReporterCannotMutateReporterGatedState() public {
        bool success;

        (success,) = address(outsider).call(
            abi.encodeWithSelector(
                VaultCaller.callSetTotalMinted.selector,
                address(vault),
                1
            )
        );
        require(!success, "outsider setTotalMinted should revert");

        IWhiskyCaskVault.ReserveAttestationPublic memory publicAttestation =
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 47,
                totalTokenSupply: 47_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_000,
                attestationHash: keccak256("pub-attestation")
            });

        (success,) = address(outsider).call(
            abi.encodeWithSelector(
                VaultCaller.callSetReserveAttestationPublic.selector,
                address(vault),
                publicAttestation
            )
        );
        require(!success, "outsider setReserveAttestationPublic should revert");
    }

    function testOnReportRoutesReservePublicAndPrivatePayloads() public {
        bytes32 publicHash = keccak256("public");
        bytes memory publicPayload = abi.encode(
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 47,
                totalTokenSupply: 47_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_001,
                attestationHash: publicHash
            })
        );
        bytes memory publicReport = abi.encode(
            uint8(IWhiskyCaskVault.ReportType.RESERVE_PUBLIC),
            publicPayload
        );

        vault.onReport(publicReport);

        IWhiskyCaskVault.ReserveAttestationPublic memory publicAttestation =
            vault.latestPublicReserveAttestation();
        require(publicAttestation.attestationHash == publicHash, "public hash mismatch");
        require(publicAttestation.physicalCaskCount == 47, "public cask count mismatch");

        vault.setKeystoneForwarder(address(forwarder));
        bytes32 privateHash = keccak256("private");
        bytes memory privatePayload = abi.encode(
            IWhiskyCaskVault.ReserveAttestationPrivate({
                isFullyReserved: true,
                timestamp: 1_735_360_002,
                attestationHash: privateHash
            })
        );
        bytes memory privateReport = abi.encode(
            uint8(IWhiskyCaskVault.ReportType.RESERVE_PRIVATE),
            privatePayload
        );

        forwarder.callOnReportWithMetadata(address(vault), hex"deadbeef", privateReport);

        IWhiskyCaskVault.ReserveAttestationPrivate memory privateAttestation =
            vault.latestPrivateReserveAttestation();
        require(privateAttestation.isFullyReserved, "private reservation mismatch");
        require(privateAttestation.attestationHash == privateHash, "private hash mismatch");
    }

    function testOnReportRoutesCaskBatchAndLifecycle() public {
        uint256 caskId = 101;
        IWhiskyCaskVault.CaskAttributesInput[] memory updates = new IWhiskyCaskVault.CaskAttributesInput[](
            1
        );
        updates[0] = IWhiskyCaskVault.CaskAttributesInput({
            caskId: caskId,
            attributes: IWhiskyCaskVault.CaskAttributes({
                caskType: IWhiskyCaskVault.CaskType.BOURBON_BARREL,
                spiritType: IWhiskyCaskVault.SpiritType.BOURBON,
                fillDate: 1_672_531_200,
                entryProofGallons: 512e2,
                entryWineGallons: 270e2,
                entryProof: 1100,
                lastGaugeProofGallons: 490e2,
                lastGaugeWineGallons: 258e2,
                lastGaugeProof: 1090,
                lastGaugeDate: 1_704_067_200,
                lastGaugeMethod: IWhiskyCaskVault.GaugeMethod.WET_DIP,
                estimatedProofGallons: 474e2,
                state: IWhiskyCaskVault.CaskState.MATURATION,
                warehouseCode: bytes16("WH-OR-001")
            })
        });

        bytes memory batchPayload = abi.encode(updates);
        bytes memory batchReport = abi.encode(uint8(IWhiskyCaskVault.ReportType.CASK_BATCH), batchPayload);
        vault.onReport(batchReport);

        IWhiskyCaskVault.CaskAttributes memory stored = vault.getCaskAttributes(caskId);
        require(stored.state == IWhiskyCaskVault.CaskState.MATURATION, "batch state mismatch");
        require(stored.lastGaugeProofGallons == 490e2, "batch gauge mismatch");
        require(stored.warehouseCode == bytes16("WH-OR-001"), "warehouse code mismatch");

        bytes memory lifecyclePayload = abi.encode(
            IWhiskyCaskVault.LifecycleReport({
                caskId: caskId,
                toState: IWhiskyCaskVault.CaskState.REGAUGED,
                timestamp: 1_736_000_000,
                gaugeProofGallons: 460e2,
                gaugeWineGallons: 242e2,
                gaugeProof: 1085
            })
        );
        bytes memory lifecycleReport = abi.encode(
            uint8(IWhiskyCaskVault.ReportType.LIFECYCLE),
            lifecyclePayload
        );

        vault.onReport(lifecycleReport);

        IWhiskyCaskVault.CaskAttributes memory regauged = vault.getCaskAttributes(caskId);
        require(regauged.state == IWhiskyCaskVault.CaskState.REGAUGED, "lifecycle state mismatch");
        require(regauged.lastGaugeProofGallons == 460e2, "lifecycle proof gallons mismatch");
        require(regauged.lastGaugeWineGallons == 242e2, "lifecycle wine gallons mismatch");
        require(regauged.lastGaugeProof == 1085, "lifecycle proof mismatch");
        require(regauged.lastGaugeDate == 1_736_000_000, "lifecycle date mismatch");
    }

    function testLifecycleZeroGaugeDoesNotOverwriteLastGaugeData() public {
        uint256 caskId = 202;
        IWhiskyCaskVault.CaskAttributesInput[] memory updates = new IWhiskyCaskVault.CaskAttributesInput[](
            1
        );
        updates[0] = IWhiskyCaskVault.CaskAttributesInput({
            caskId: caskId,
            attributes: IWhiskyCaskVault.CaskAttributes({
                caskType: IWhiskyCaskVault.CaskType.HOGSHEAD,
                spiritType: IWhiskyCaskVault.SpiritType.RYE,
                fillDate: 1_640_995_200,
                entryProofGallons: 500e2,
                entryWineGallons: 265e2,
                entryProof: 1120,
                lastGaugeProofGallons: 455e2,
                lastGaugeWineGallons: 241e2,
                lastGaugeProof: 1090,
                lastGaugeDate: 1_725_811_200,
                lastGaugeMethod: IWhiskyCaskVault.GaugeMethod.WET_DIP,
                estimatedProofGallons: 449e2,
                state: IWhiskyCaskVault.CaskState.REGAUGED,
                warehouseCode: bytes16("WH-TN-003")
            })
        });

        vault.upsertCaskAttributesBatch(updates);
        vault.recordLifecycleTransition(
            caskId,
            IWhiskyCaskVault.CaskState.TRANSFER,
            1_736_000_100,
            0,
            0,
            0
        );

        IWhiskyCaskVault.CaskAttributes memory afterTransition = vault.getCaskAttributes(caskId);
        require(afterTransition.state == IWhiskyCaskVault.CaskState.TRANSFER, "state not updated");
        require(
            afterTransition.lastGaugeProofGallons == 455e2,
            "proof gallons should be unchanged"
        );
        require(
            afterTransition.lastGaugeWineGallons == 241e2,
            "wine gallons should be unchanged"
        );
        require(afterTransition.lastGaugeProof == 1090, "proof should be unchanged");
        require(afterTransition.lastGaugeDate == 1_725_811_200, "gauge date should be unchanged");
    }

    function testLifecycleTransitionEmitsEvent() public {
        uint256 caskId = 222;
        IWhiskyCaskVault.CaskAttributesInput[] memory updates = new IWhiskyCaskVault.CaskAttributesInput[](
            1
        );
        updates[0] = IWhiskyCaskVault.CaskAttributesInput({
            caskId: caskId,
            attributes: IWhiskyCaskVault.CaskAttributes({
                caskType: IWhiskyCaskVault.CaskType.BOURBON_BARREL,
                spiritType: IWhiskyCaskVault.SpiritType.BOURBON,
                fillDate: 1_672_531_200,
                entryProofGallons: 512e2,
                entryWineGallons: 270e2,
                entryProof: 1100,
                lastGaugeProofGallons: 490e2,
                lastGaugeWineGallons: 258e2,
                lastGaugeProof: 1090,
                lastGaugeDate: 1_704_067_200,
                lastGaugeMethod: IWhiskyCaskVault.GaugeMethod.WET_DIP,
                estimatedProofGallons: 474e2,
                state: IWhiskyCaskVault.CaskState.MATURATION,
                warehouseCode: bytes16("WH-OR-006")
            })
        });

        vault.upsertCaskAttributesBatch(updates);
        VM.recordLogs();
        vault.recordLifecycleTransition(
            caskId,
            IWhiskyCaskVault.CaskState.REGAUGED,
            1_736_002_000,
            488e2,
            257e2,
            1089
        );
        assertEventEmitted(LIFECYCLE_TRANSITION_SIG, address(vault));
    }

    function testPauseBlocksMutationAndEmitsEvents() public {
        vault.setReporter(address(reporter), true);
        bytes memory publicPayload = abi.encode(
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 47,
                totalTokenSupply: 47_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_301,
                attestationHash: keccak256("paused-report")
            })
        );
        bytes memory report = abi.encode(uint8(IWhiskyCaskVault.ReportType.RESERVE_PUBLIC), publicPayload);

        VM.recordLogs();
        vault.setPaused(true);
        assertEventEmitted(PAUSED_SIG, address(vault));

        bool success;
        (success,) = address(reporter).call(
            abi.encodeWithSelector(
                VaultCaller.callSetTotalMinted.selector,
                address(vault),
                77_000
            )
        );
        require(!success, "paused should block reporter mutation");

        (success,) = address(vault).call(
            abi.encodeWithSelector(
                bytes4(keccak256("onReport(bytes)")),
                report
            )
        );
        require(!success, "paused should block report ingestion");

        VM.recordLogs();
        vault.setPaused(false);
        assertEventEmitted(UNPAUSED_SIG, address(vault));

        reporter.callSetTotalMinted(address(vault), 77_000);
        require(vault.totalMinted() == 77_000, "unpaused mutation should succeed");
    }

    function testOnReportRejectsUnauthorizedSource() public {
        bytes memory publicPayload = abi.encode(
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 10,
                totalTokenSupply: 10_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_100,
                attestationHash: keccak256("unauthorized")
            })
        );
        bytes memory report = abi.encode(uint8(IWhiskyCaskVault.ReportType.RESERVE_PUBLIC), publicPayload);

        bool success;
        (success,) = address(outsider).call(
            abi.encodeWithSelector(
                VaultCaller.callOnReport.selector,
                address(vault),
                report
            )
        );
        require(!success, "outsider onReport should revert");
    }

    function testOnReportRejectsInvalidReportType() public {
        bytes memory report = abi.encode(uint8(99), bytes(""));
        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                bytes4(keccak256("onReport(bytes)")),
                report
            )
        );
        require(!success, "invalid report type should revert");
    }

    function testReserveAttestationRejectsStaleTimestamp() public {
        IWhiskyCaskVault.ReserveAttestationPublic memory attestation =
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 47,
                totalTokenSupply: 47_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_200,
                attestationHash: keccak256("public-fresh")
            });

        vault.setReserveAttestationPublic(attestation);

        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.setReserveAttestationPublic.selector,
                attestation
            )
        );
        require(!success, "stale public attestation should revert");
    }

    function testLifecycleRejectsUnknownCask() public {
        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.recordLifecycleTransition.selector,
                999,
                IWhiskyCaskVault.CaskState.MATURATION,
                1_736_000_400,
                0,
                0,
                0
            )
        );
        require(!success, "unknown cask lifecycle transition should revert");
    }

    function testLifecycleRejectsStaleTimestampAndInvalidTransition() public {
        uint256 caskId = 303;
        IWhiskyCaskVault.CaskAttributesInput[] memory updates = new IWhiskyCaskVault.CaskAttributesInput[](
            1
        );
        updates[0] = IWhiskyCaskVault.CaskAttributesInput({
            caskId: caskId,
            attributes: IWhiskyCaskVault.CaskAttributes({
                caskType: IWhiskyCaskVault.CaskType.BOURBON_BARREL,
                spiritType: IWhiskyCaskVault.SpiritType.MALT,
                fillDate: 1_670_000_000,
                entryProofGallons: 500e2,
                entryWineGallons: 260e2,
                entryProof: 1120,
                lastGaugeProofGallons: 480e2,
                lastGaugeWineGallons: 250e2,
                lastGaugeProof: 1110,
                lastGaugeDate: 1_735_000_000,
                lastGaugeMethod: IWhiskyCaskVault.GaugeMethod.WET_DIP,
                estimatedProofGallons: 470e2,
                state: IWhiskyCaskVault.CaskState.MATURATION,
                warehouseCode: bytes16("WH-OR-004")
            })
        });

        vault.upsertCaskAttributesBatch(updates);
        vault.recordLifecycleTransition(
            caskId,
            IWhiskyCaskVault.CaskState.REGAUGED,
            1_736_000_500,
            479e2,
            249e2,
            1108
        );

        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.recordLifecycleTransition.selector,
                caskId,
                IWhiskyCaskVault.CaskState.TRANSFER,
                1_736_000_500,
                0,
                0,
                0
            )
        );
        require(!success, "stale lifecycle timestamp should revert");

        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.recordLifecycleTransition.selector,
                caskId,
                IWhiskyCaskVault.CaskState.FILLED,
                1_736_000_600,
                0,
                0,
                0
            )
        );
        require(!success, "invalid lifecycle transition should revert");
    }

    function testGetCaskAttributesUnknownRevertsAndExistsFlagIsFalse() public view {
        require(!vault.caskExists(999), "unknown cask should not exist");
    }

    function testGetCaskAttributesUnknownCallReverts() public {
        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.getCaskAttributes.selector,
                999
            )
        );
        require(!success, "unknown cask attributes read should revert");
    }

    function testBottledSelfTransitionRejected() public {
        uint256 caskId = 404;
        IWhiskyCaskVault.CaskAttributesInput[] memory updates = new IWhiskyCaskVault.CaskAttributesInput[](
            1
        );
        updates[0] = IWhiskyCaskVault.CaskAttributesInput({
            caskId: caskId,
            attributes: IWhiskyCaskVault.CaskAttributes({
                caskType: IWhiskyCaskVault.CaskType.PORT_PIPE,
                spiritType: IWhiskyCaskVault.SpiritType.WHEAT,
                fillDate: 1_640_000_000,
                entryProofGallons: 520e2,
                entryWineGallons: 270e2,
                entryProof: 1140,
                lastGaugeProofGallons: 480e2,
                lastGaugeWineGallons: 250e2,
                lastGaugeProof: 1120,
                lastGaugeDate: 1_735_000_000,
                lastGaugeMethod: IWhiskyCaskVault.GaugeMethod.WET_DIP,
                estimatedProofGallons: 470e2,
                state: IWhiskyCaskVault.CaskState.BOTTLING_READY,
                warehouseCode: bytes16("WH-OR-005")
            })
        });

        vault.upsertCaskAttributesBatch(updates);
        vault.recordLifecycleTransition(
            caskId,
            IWhiskyCaskVault.CaskState.BOTTLED,
            1_736_100_000,
            0,
            0,
            0
        );

        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.recordLifecycleTransition.selector,
                caskId,
                IWhiskyCaskVault.CaskState.BOTTLED,
                1_736_100_100,
                0,
                0,
                0
            )
        );
        require(!success, "bottled self transition should revert");
    }

    function testTransferOwnershipUpdatesOwnerPermissions() public {
        bool success;
        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.transferOwnership.selector,
                address(0)
            )
        );
        require(!success, "zero owner transfer should revert");

        VM.recordLogs();
        vault.transferOwnership(address(reporter));
        assertEventEmitted(OWNERSHIP_TRANSFERRED_SIG, address(vault));
        require(vault.owner() == address(reporter), "owner should be reporter");

        (success,) = address(vault).call(
            abi.encodeWithSelector(
                WhiskyCaskVault.setReporter.selector,
                address(outsider),
                true
            )
        );
        require(!success, "old owner should not set reporter");

        reporter.callSetReporter(address(vault), address(outsider), true);
        outsider.callSetTotalMinted(address(vault), 123_000);
        require(vault.totalMinted() == 123_000, "new owner permissions not applied");
    }

    function testZeroForwarderDisablesForwarderReportPath() public {
        bytes memory payload = abi.encode(
            IWhiskyCaskVault.ReserveAttestationPublic({
                physicalCaskCount: 11,
                totalTokenSupply: 11_000,
                tokensPerCask: 1_000,
                reserveRatio: 1e18,
                timestamp: 1_735_360_123,
                attestationHash: keccak256("forwarder-enabled")
            })
        );
        bytes memory report = abi.encode(uint8(IWhiskyCaskVault.ReportType.RESERVE_PUBLIC), payload);

        vault.setKeystoneForwarder(address(forwarder));
        forwarder.callOnReportWithMetadata(address(vault), hex"00", report);

        IWhiskyCaskVault.ReserveAttestationPublic memory attestation =
            vault.latestPublicReserveAttestation();
        require(attestation.physicalCaskCount == 11, "forwarder should be enabled");

        vault.setKeystoneForwarder(address(0));

        bool success;
        (success,) = address(forwarder).call(
            abi.encodeWithSelector(
                VaultCaller.callOnReportWithMetadata.selector,
                address(vault),
                hex"00",
                report
            )
        );
        require(!success, "zero forwarder should disable forwarder report path");
    }
}
