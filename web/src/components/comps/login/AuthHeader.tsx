interface Props {
  mode: "login" | "register";
}

export default function AuthHeader({ mode }: Props) {
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <img
          src="/logo.png"
          alt="AppCore"
          className="h-10 w-10 rounded-xl object-cover"
        />
        <div>
          <div className="text-xl font-bold text-[#ea0e2b] leading-tight">
            AppCore
          </div>
          <div className="text-xs text-gray-400">ASO Engine by Fringelo</div>
        </div>
      </div>
      <h2 className="text-[22px] font-bold text-[#1a1a2e] mb-6 tracking-tight">
        {mode === "login" ? "Sign in to your account" : "Create an account"}
      </h2>
    </>
  );
}
