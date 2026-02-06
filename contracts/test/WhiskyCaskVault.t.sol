// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiskyCaskVault} from "../src/WhiskyCaskVault.sol";
import {IWhiskyCaskVault} from "../src/interfaces/IWhiskyCaskVault.sol";

contract VaultCaller {
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
    WhiskyCaskVault private vault;
    VaultCaller private reporter;
    VaultCaller private outsider;
    VaultCaller private forwarder;

    function setUp() public {
        vault = new WhiskyCaskVault();
        reporter = new VaultCaller();
        outsider = new VaultCaller();
        forwarder = new VaultCaller();
    }

    function testOwnerCanSetReporterAndReporterCanMutateState() public {
        vault.setReporter(address(reporter), true);
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
}
