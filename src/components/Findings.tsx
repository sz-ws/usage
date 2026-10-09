import type { MetricId } from "../../shared/catalog";
import type { Finding } from "../../shared/insights";
import { useMessages } from "../locale";
import "./findings.css";

interface Props {
  findings: readonly Finding[];
  onOpen: (id: MetricId) => void;
}

export function Findings({ findings, onOpen }: Props) {
  const m = useMessages();
  if (findings.length === 0) return null;

  return (
    <section className="findings" aria-labelledby="findings-heading">
      <h2 id="findings-heading">{m.findings.heading}</h2>
      <ul>
        {findings.map((finding) => {
          const { metric } = finding;
          const body = (
            <>
              <span className="finding-mark" aria-hidden="true" />
              <span className="visually-hidden">{m.findings.tone[finding.tone]}</span>
              {finding.text}
            </>
          );
          return (
            <li key={finding.id} data-tone={finding.tone}>
              {metric ? (
                <button type="button" onClick={() => onOpen(metric)}>
                  {body}
                </button>
              ) : (
                <p>{body}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
