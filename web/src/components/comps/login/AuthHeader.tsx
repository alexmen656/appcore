interface Props {
  mode: "login" | "register";
}

export default function AuthHeader({ mode }: Props) {
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        {/*<img
          src="/app/logo.png"
          alt="AppCore"
          className="h-10 w-10 rounded-xl object-cover"
        />*/}
        <div>
          <div className="text-3xl font-bold text-[#ea0e2b] leading-tight">
            marteso
          </div>
          {/*<<div className="text-xs text-[#9ca3af] dark:text-[#5c6478]">
            ASO Engine by Fringelo
          </div>*/}
        </div>
      </div>
      <h2 className="text-[22px] font-bold text-[#111827] dark:text-[#e8eaf0] mb-6 tracking-tight">
        {mode === "login" ? "Sign in to your account" : "Create an account"}
      </h2>
    </>
  );
}
