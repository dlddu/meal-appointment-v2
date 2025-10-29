import { useMemo, useState } from 'react';

type Slot = {
  slotInstanceId: string;
  label: string;
};

const slots: Slot[] = [
  { slotInstanceId: '2024-05-01_dinner', label: 'May 1st – Dinner' },
  { slotInstanceId: '2024-05-02_lunch', label: 'May 2nd – Lunch' }
];

export default function AvailabilityMatrix() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => {
    const totalSelected = Object.values(selected).filter(Boolean).length;
    return `${totalSelected} / ${slots.length} slots selected`;
  }, [selected]);

  return (
    <section className="bg-slate-900 rounded-xl p-6 shadow-lg w-full max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Availability Matrix (Demo)</h2>
      <ul className="space-y-3">
        {slots.map((slot) => (
          <li key={slot.slotInstanceId} className="flex items-center justify-between">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected[slot.slotInstanceId] ?? false}
                onChange={(event) =>
                  setSelected((prev) => ({ ...prev, [slot.slotInstanceId]: event.target.checked }))
                }
              />
              <span>{slot.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-slate-300" data-testid="selection-summary">
        {summary}
      </p>
    </section>
  );
}
