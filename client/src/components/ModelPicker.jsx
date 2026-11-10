// Model dropdown, grouped (Local / Cloud). Unavailable models are shown but disabled.
export default function ModelPicker({ models, value, onChange, disabled }) {
  if (!models.length) return null;
  const groups = [...new Set(models.map((m) => m.group))];
  return (
    <select className="model-picker" aria-label="Model" value={value || ""} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {models.filter((m) => m.group === g).map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available}>
              {m.label}{m.note ? ` — ${m.note}` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
