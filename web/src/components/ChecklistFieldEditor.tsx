import { Plus, X } from 'lucide-react';

export type ChecklistStep = { key: string; id?: string; title: string };

export function ChecklistFieldEditor({ steps, onChange }: { steps: ChecklistStep[]; onChange: (steps: ChecklistStep[]) => void }) {
  function updateTitle(index: number, title: string) {
    onChange(steps.map((s, i) => (i === index ? { ...s, title } : s)));
  }
  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }
  function addStep() {
    onChange([...steps, { key: crypto.randomUUID(), title: '' }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={step.title}
            onChange={(e) => updateTitle(i, e.target.value)}
            placeholder={`Etapa ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => removeStep(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
            aria-label="Remover etapa"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ gap: 6, fontSize: '0.8rem', alignSelf: 'flex-start' }}
        onClick={addStep}
      >
        <Plus size={14} strokeWidth={2} />
        Adicionar etapa
      </button>
    </div>
  );
}
