import { useEffect, useState } from "react";
import { ArcPicker, type ArcPickerSide } from "@/components/motion/arc-picker";
import { cn } from "@/lib/utils";

const SIDES = ["top", "bottom", "left", "right"] as const;

const OPTIONS = [
  { value: "subuh", label: "Subuh" },
  { value: "fajar", label: "Fajar" },
  { value: "matahari-terbit", label: "Matahari terbit" },
  { value: "pagi-buta", label: "Pagi buta" },
  { value: "pagi", label: "Pagi" },
  { value: "menjelang-siang", label: "Menjelang siang" },
  { value: "tengah-hari", label: "Tengah hari" },
  { value: "siang", label: "Siang" },
  { value: "sore", label: "Sore" },
  { value: "golden-hour", label: "Golden hour" },
  { value: "senja", label: "Senja" },
  { value: "magrib", label: "Magrib" },
  { value: "petang", label: "Petang" },
  { value: "malam", label: "Malam" },
  { value: "larut-malam", label: "Larut malam" },
  { value: "tengah-malam", label: "Tengah malam" },
  { value: "dini-hari", label: "Dini hari" },
];

export function App() {
  const [value, setValue] = useState("golden-hour");
  const [side, setSide] = useState<ArcPickerSide>("right");
  const [dark, setDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const label = OPTIONS.find((o) => o.value === value)?.label;
  const horizontal = side === "top" || side === "bottom";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center px-4 py-10">
      <header className="flex w-full items-center justify-between">
        <h1 className="text-lg font-medium">Arc Picker</h1>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="rounded-full bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {dark ? "Terang" : "Gelap"}
        </button>
      </header>

      <fieldset className="mt-8 flex flex-wrap items-center justify-center gap-1">
        <legend className="sr-only">Arah lengkungan</legend>
        {SIDES.map((direction) => (
          <button
            key={direction}
            type="button"
            aria-pressed={side === direction}
            onClick={() => setSide(direction)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm capitalize transition-colors",
              side === direction
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {direction}
          </button>
        ))}
      </fieldset>

      <div className="my-8 flex min-h-108 w-full items-center">
        <ArcPicker
          options={OPTIONS}
          value={value}
          onValueChange={setValue}
          aria-label="Waktu"
          side={side}
          radius={260}
          visibleCount={9}
          itemHeight={48}
          labels={{
            instructionsHorizontal:
              "Geser ke samping atau scroll untuk memilih. Tombol panah untuk pindah, Home dan End untuk lompat.",
            instructionsVertical:
              "Geser ke atas-bawah atau scroll untuk memilih. Tombol panah untuk pindah, Home dan End untuk lompat.",
          }}
        />
      </div>

      <p className="text-sm">
        Terpilih: <span className="font-medium text-primary">{label}</span>
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Geser {horizontal ? "ke samping" : "ke atas atau bawah"}, scroll, atau pakai
        tombol panah.
      </p>
    </main>
  );
}
