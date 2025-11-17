// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import type React from 'react';
import type { TemplateOption } from '../types.js';
import { createAppointmentStrings } from '../strings.js';

type TemplateOptionCardProps = {
  option: TemplateOption;
  selected: boolean;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
};

export function TemplateOptionCard({ option, selected, onSelect, onUnavailable }: TemplateOptionCardProps) {
  const handleActivate = () => {
    if (option.disabled) {
      onUnavailable();
      return;
    }
    onSelect(option.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  const descriptionId = `template-desc-${option.id}`;
  const labelId = `template-label-${option.id}`;

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={option.disabled}
      tabIndex={option.disabled ? -1 : 0}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={`flex flex-col gap-2 border ${
        selected ? 'border-primary shadow-[0_12px_24px_rgba(42,111,151,0.18)]' : 'border-border'
      } rounded-[16px] p-5 bg-surface transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer ${
        option.disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-center justify-between" id={labelId}>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-slate-900">{option.title}</span>
          <span id={descriptionId} className="text-sm text-slate-600">
            {option.description}
          </span>
        </div>
        {option.badge && (
          <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
            {option.badge}
          </span>
        )}
      </div>
      {selected && <span className="text-sm text-primary">{createAppointmentStrings.form.templateSelectedLabel}</span>}
      {option.disabled && <span className="text-sm text-secondary">{createAppointmentStrings.form.templateDisabledLabel}</span>}
    </div>
  );
}
