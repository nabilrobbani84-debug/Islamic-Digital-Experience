import { Minus, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";
import { Segmented } from "@/components/ui/Segmented";
import { ARABIC_FONT_RANGE, TRANSLATION_FONT_RANGE, usePreferences } from "@/stores/preferences";
import { useEditions } from "../api";

function Stepper({ label, value, min, max, step, onChange, unit = "px" }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium" id={`stepper-${label}`}>
        {label}
      </span>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`stepper-${label}`}>
        <IconButton size="sm" label={`Perkecil ${label}`} icon={<Minus className="size-4" />} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} />
        <output className="w-14 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
          {unit}
        </output>
        <IconButton size="sm" label={`Perbesar ${label}`} icon={<Plus className="size-4" />} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} />
      </div>
    </div>
  );
}

export function ReaderSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePreferences();
  const editions = useEditions();
  return (
    <Dialog open={open} onClose={onClose} title="Pengaturan bacaan" description="Disimpan di perangkat ini.">
      <div className="divide-y divide-line">
        <Stepper label="Ukuran teks Arab" value={prefs.arabicFontSize} {...ARABIC_FONT_RANGE} onChange={(v) => prefs.set({ arabicFontSize: v })} />
        <Stepper label="Ukuran terjemahan" value={prefs.translationFontSize} {...TRANSLATION_FONT_RANGE} onChange={(v) => prefs.set({ translationFontSize: v })} />
        <Switch label="Tampilkan terjemahan" checked={prefs.translationEnabled} onChange={(v) => prefs.set({ translationEnabled: v })} />
        <div className="py-3">
          <Select label="Edisi terjemahan" value={prefs.editionId ?? ""} onChange={(e) => prefs.set({ editionId: e.target.value || null })} disabled={!editions.data?.length} hint={editions.isError ? "Daftar edisi tidak dapat dimuat." : undefined}>
            <option value="">Default backend</option>
            {editions.data?.map((ed) => (
              <option key={ed.id} value={ed.id}>
                {ed.name} ({ed.language})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm font-medium">Tema</span>
          <Segmented
            label="Tema"
            size="sm"
            value={prefs.theme}
            onChange={prefs.setTheme}
            options={[
              { value: "dark", label: "Gelap" },
              { value: "light", label: "Terang" },
            ]}
          />
        </div>
        <div className="pt-4">
          <p className="text-xs text-muted">Pratinjau</p>
          <p lang="ar" className="quran-arabic mt-2 text-fg">
            ٱلْقُرْآنُ ٱلْكَرِيمُ
          </p>
        </div>
      </div>
    </Dialog>
  );
}
