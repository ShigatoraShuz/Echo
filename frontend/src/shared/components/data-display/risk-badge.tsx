import { riskBandStyles, type EchoRiskBand } from "@/lib/theme";

export function RiskBadge({ band }: { band: EchoRiskBand }) {
  return <span className={riskBandStyles[band]}>{band}</span>;
}