interface Props {
  url: string | null;
  name: string;
  own?: boolean;
}

export default function AppIcon({ url, name, own }: Props) {
  return url ? (
    <img
      src={url}
      alt=""
      className="w-11 h-11 rounded-xl object-cover shrink-0"
    />
  ) : (
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${own ? "bg-[#ea0e2b] text-white" : "bg-gray-200 text-gray-500"}`}
    >
      {name.charAt(0)}
    </div>
  );
}
