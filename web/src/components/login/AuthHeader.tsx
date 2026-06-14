import { textPrimary } from "../../styles";
interface Props {
  mode: "login" | "signup";
}

export default function AuthHeader({ mode }: Props) {
  return (
    <>
      <div className="flex items-center mb-8">
        <img src="/logo-wordmark.svg" alt="Marteso" className="h-9 w-auto" />
      </div>
      <h2 className={`text-[22px] font-bold ${textPrimary} mb-6 tracking-tight`}>
        {mode === "login" ? "Sign in to your account" : "Create an account"}
      </h2>
    </>
  );
}
