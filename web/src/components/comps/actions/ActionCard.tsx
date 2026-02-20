const btnPrimSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-xs font-medium bg-[#ea0e2b] text-white hover:bg-[#c80b24] transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecSm =
  "inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg text-xs font-medium border border-[#e5e7eb] bg-white text-[#1a1a2e] hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

export interface ActionCardDef {
  id: string;
  label: string;
  title: string;
  desc: string;
  primary?: boolean;
}

interface Props {
  card: ActionCardDef;
  running: string | null;
  onTrigger: (id: string, label: string) => void;
}

export default function ActionCard({ card, running, onTrigger }: Props) {
  const isRunning = running === card.id;
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-lg p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
          {card.label}
        </div>
        <div className="text-[15px] font-semibold text-[#1a1a2e] mb-2">
          {isRunning ? "Running…" : card.title}
        </div>
        <div className="text-xs text-gray-500 leading-relaxed">{card.desc}</div>
      </div>
      <button
        className={card.primary ? btnPrimSm : btnSecSm}
        disabled={!!running}
        onClick={() => !running && onTrigger(card.id, card.label)}
      >
        {isRunning ? "⏳ Running…" : `▶ Run ${card.label}`}
      </button>
    </div>
  );
}
