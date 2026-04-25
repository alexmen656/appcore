import { textPrimary } from "../../styles";
interface Props {
  mode: "login" | "register";
}

export default function AuthHeader({ mode }: Props) {
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <img src="/app/logo.svg" alt="Marteso" className="h-7 w-auto" />
        <div>
          <div className="text-3xl font-bold leading-tight bg-gradient-to-br from-[#D94412] to-[#C4001E] bg-clip-text text-transparent">
            marteso
          </div>
        </div>
      </div>
      <h2 className={`text-[22px] font-bold ${textPrimary} mb-6 tracking-tight`}>
        {mode === "login" ? "Sign in to your account" : "Create an account"}
      </h2>
    </>
  );
}
