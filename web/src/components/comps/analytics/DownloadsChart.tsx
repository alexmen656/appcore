import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DayData {
  date: string;
  downloads: number;
  updates: number;
  proceeds: number;
}

interface Props {
  data: DayData[];
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DownloadsChart({ data }: Props) {
  const [range, setRange] = useState(30);

  const filtered = data.slice(-range);

  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[15px] font-semibold text-[#111827]">Downloads over time</div>
          <div className="text-[12px] text-[#9ca3af] mt-0.5">Daily installs and updates</div>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                range === r.days
                  ? "bg-[#ea0e2b] text-white"
                  : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[13px] text-[#9ca3af]">
          No data yet — sync to fetch download stats.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                border: "1px solid #eef0f3",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
              labelFormatter={(label) => fmtDate(String(label))}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="downloads"
              name="Downloads"
              stroke="#ea0e2b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="updates"
              name="Updates"
              stroke="#9ca3af"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
