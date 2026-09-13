import {
  PAGE_NUMBER_LABELS,
  PAGE_NUMBER_POSITIONS,
  type PageChrome,
  type PageNumberPosition,
} from "@kemiaodoc/core"

const FIELDS: Array<{ key: keyof PageChrome; label: string }> = [
  { key: "headerLeft", label: "页眉左" },
  { key: "headerCenter", label: "页眉中" },
  { key: "headerRight", label: "页眉右" },
  { key: "footerLeft", label: "页脚左" },
  { key: "footerCenter", label: "页脚中" },
  { key: "footerRight", label: "页脚右" },
]

export function PageChromePanel({
  chrome,
  onChange,
}: {
  chrome: PageChrome
  onChange: (next: PageChrome) => void
}) {
  return (
    <section className="border-t p-3 sm:p-4" style={{ borderColor: "var(--kd-line)", background: "color-mix(in srgb, var(--kd-bg) 50%, transparent)" }}>
      <h3 className="text-sm font-medium">页眉、页脚、页码</h3>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--kd-muted)" }}>
        打印预览和另存为 Word / HTML 时会带上。页码占的那一格不再显示文字。
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="block text-xs" style={{ color: "var(--kd-muted)" }}>
            {field.label}
            <input
              className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              maxLength={40}
              value={String(chrome[field.key] || "")}
              onChange={(event) => onChange({ ...chrome, [field.key]: event.target.value.slice(0, 40) })}
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs" style={{ color: "var(--kd-muted)" }}>
        页码位置
        <select
          className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm sm:max-w-xs"
          value={chrome.pageNumber}
          onChange={(event) => onChange({ ...chrome, pageNumber: event.target.value as PageNumberPosition })}
        >
          {PAGE_NUMBER_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {PAGE_NUMBER_LABELS[position]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs sm:max-w-xs" style={{ color: "var(--kd-muted)" }}>
        起始页码
        <input
          type="number"
          min={1}
          max={9999}
          className="kd-field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          value={chrome.startAt}
          onChange={(event) => onChange({ ...chrome, startAt: Number(event.target.value) || 1 })}
        />
      </label>
    </section>
  )
}
