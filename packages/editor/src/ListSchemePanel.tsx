import {
  BULLET_STYLES,
  BULLET_STYLE_LABELS,
  LIST_SCHEME_PRESETS,
  NUMBER_STYLES,
  NUMBER_STYLE_LABELS,
  formatListLabel,
  presetScheme,
  sanitizeListScheme,
  type ListScheme,
  type NumberStyle,
} from "@kemiaodoc/core"

export function ListSchemePanel({
  scheme,
  onChange,
}: {
  scheme: ListScheme
  onChange: (next: ListScheme) => void
}) {
  const preview = [formatListLabel(scheme, [1]), formatListLabel(scheme, [1, 1]), formatListLabel(scheme, [1, 1, 1])]
  const updateLevel = (index: number, patch: Partial<ListScheme["levels"][number]>) => {
    const levels = scheme.levels.map((level, current) => (current === index ? { ...level, ...patch } : level))
    onChange(sanitizeListScheme({ ...scheme, presetId: "custom", levels }))
  }

  return (
    <section className="border-t p-3 sm:p-4" style={{ borderColor: "var(--kd-line)", background: "color-mix(in srgb, var(--kd-bg) 50%, transparent)" }}>
      <h3 className="text-sm font-medium">多级项目编号</h3>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--kd-muted)" }}>
        先选一套预设，再改每一级。预览：{preview.join(" / ")}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LIST_SCHEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`kd-btn min-h-11 px-2 text-left text-xs sm:text-sm ${scheme.presetId === preset.id ? "kd-btn-primary" : "kd-btn-secondary"}`}
            onClick={() => onChange(presetScheme(preset.id))}
          >
            <span className="block font-medium">{preset.label}</span>
            <span className="mt-0.5 block text-[10px] opacity-80">{preset.hint}</span>
          </button>
        ))}
      </div>
      <fieldset className="mt-4">
        <legend className="text-xs" style={{ color: "var(--kd-muted)" }}>
          项目符号
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BULLET_STYLES.map((bullet) => (
            <button
              key={bullet}
              type="button"
              className={`kd-btn min-h-11 px-2 text-sm ${scheme.bullet === bullet ? "kd-btn-primary" : "kd-btn-secondary"}`}
              onClick={() => onChange(sanitizeListScheme({ ...scheme, presetId: "custom", bullet }))}
            >
              {BULLET_STYLE_LABELS[bullet]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3">
        {scheme.levels.slice(0, 6).map((level, index) => (
          <fieldset key={index} className="rounded-2xl border bg-white/70 p-3" style={{ borderColor: "var(--kd-line)" }}>
            <legend className="px-1 text-sm font-medium">
              第 {index + 1} 级
              <span className="ml-2 font-normal" style={{ color: "var(--kd-muted)" }}>
                {formatListLabel(scheme, Array.from({ length: index + 1 }, () => 1))}
              </span>
            </legend>
            <label className="block text-xs" style={{ color: "var(--kd-muted)" }}>
              编号样式
              <select
                className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                value={level.style}
                onChange={(event) => updateLevel(index, { style: event.target.value as NumberStyle })}
              >
                {NUMBER_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {NUMBER_STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs" style={{ color: "var(--kd-muted)" }}>
                前缀
                <input
                  className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                  value={level.prefix}
                  maxLength={8}
                  onChange={(event) => updateLevel(index, { prefix: event.target.value })}
                  placeholder="如 第 或 ("
                />
              </label>
              <label className="block text-xs" style={{ color: "var(--kd-muted)" }}>
                后缀
                <input
                  className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
                  value={level.suffix}
                  maxLength={8}
                  onChange={(event) => updateLevel(index, { suffix: event.target.value })}
                  placeholder="如 .  、  章"
                />
              </label>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={level.includeParents}
                onChange={(event) => updateLevel(index, { includeParents: event.target.checked })}
              />
              带上上级编号（如 1.1.1）
            </label>
          </fieldset>
        ))}
      </div>
    </section>
  )
}
