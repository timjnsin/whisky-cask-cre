import {
  CaskDetail,
} from "@/components/cask-detail";
import {
  caskTypeLabel,
  formatMonthYear,
  formatPg,
  lifecycleStateColor,
  lifecycleStateShortLabel,
  spiritTypeLabel,
} from "@/lib/format";
import { CaskBatchItem } from "@/lib/types";

interface CaskRowProps {
  item: CaskBatchItem;
  expanded: boolean;
  onToggle: (caskId: number) => void;
}

export function CaskRow({ item, expanded, onToggle }: CaskRowProps) {
  const caskId = item.gaugeRecord.caskId;
  const stateColor = lifecycleStateColor(item.gaugeRecord.state);

  return (
    <>
      <tr className="clickable-row" onClick={() => onToggle(caskId)}>
        <td>#{caskId}</td>
        <td>{caskTypeLabel(item.gaugeRecord.caskType)}</td>
        <td className="desktop-only">{spiritTypeLabel(item.gaugeRecord.spiritType)}</td>
        <td className="desktop-only">{formatMonthYear(item.gaugeRecord.fillDate)}</td>
        <td>{formatPg(item.gaugeRecord.lastGaugeProofGallons)}</td>
        <td>
          <span className="inline-status" style={{ color: stateColor }}>
            <span className="status-dot" aria-hidden>
              \u25CF
            </span>
            {lifecycleStateShortLabel(item.gaugeRecord.state)}
          </span>
        </td>
        <td className="expand-cell">{expanded ? "\u25BE" : "\u25B8"}</td>
      </tr>

      {expanded ? (
        <tr className="expanded-row">
          <td colSpan={7}>
            <CaskDetail
              caskId={caskId}
              initialGaugeRecord={item.gaugeRecord}
              initialEstimate={item.estimate}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}