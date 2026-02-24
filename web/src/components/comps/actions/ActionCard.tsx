import { btnPrimSm, btnSecSm } from "../../../styles";
import type { ActionCardDef } from "../../../types";
export type { ActionCardDef };

interface Props {
  card: ActionCardDef;
  running: string | null;
  onTrigger: (id: string, label: string) => void;
}

export default function ActionCard({ card, running, onTrigger }: Props) {
  const isRunning = running === card.id;
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af] mb-1.5">
          {card.label}
        </div>
        <div className="text-[15px] font-semibold text-[#111827] mb-2">
          {isRunning ? "Running..." : card.title}
        </div>
        <div className="text-xs text-[#6b7280] leading-relaxed">{card.desc}</div>
      </div>
      <button
        className={card.primary ? btnPrimSm : btnSecSm}
        disabled={!!running}
        onClick={() => !running && onTrigger(card.id, card.label)}
      >
        {isRunning ? "Running..." : `Run ${card.label}`}
      </button>
    </div>
  );
}
