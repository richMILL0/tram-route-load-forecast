import { LOAD_LEVEL_VALUES } from "../types/route";
import { LOAD_COLORS, LOAD_LABELS } from "../theme/load";

export function LoadLegend() {
  return (
    <div className="legend">
      {LOAD_LEVEL_VALUES.map((level) => (
        <div className="legend__item" key={level}>
          <span className="legend__swatch" style={{ backgroundColor: LOAD_COLORS[level] }} aria-hidden="true" />
          <span>{LOAD_LABELS[level]}</span>
        </div>
      ))}
    </div>
  );
}
