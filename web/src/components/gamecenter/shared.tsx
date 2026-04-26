import { Trophy } from "lucide-react";
import { textMuted, textSecondary } from "../../styles";

export const COMMON_LOCALES = [
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "ja-JP",
  "zh-Hans",
  "zh-Hant",
  "ko-KR",
  "pt-BR",
  "ru-RU",
  "nl-NL",
  "sv-SE",
  "no-NO",
  "da-DA",
  "fi-FI",
  "pl-PL",
  "tr-TR",
  "ar-SA",
];

export function GcNotEnabled() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Trophy className="w-10 h-10 text-[#9ca3af] dark:text-[#5c6478]" />
      <p className={`text-sm font-medium ${textSecondary}`}>Game Center is not enabled for this app.</p>
      <p className={`text-xs ${textMuted} text-center max-w-sm`}>
        Enable Game Center in App Store Connect under your app&apos;s Features tab, then refresh.
      </p>
    </div>
  );
}
