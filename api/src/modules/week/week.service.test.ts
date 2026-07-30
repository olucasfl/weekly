import { describe, expect, it, vi } from 'vitest';
import { getWeekOccurrences } from './week.service.js';

// Mock the DB calls so the test doesn't need a real database
vi.mock('../completions/completions.service.js', () => ({
  getCompletionsForRange: vi.fn().mockResolvedValue([]),
  getStepCompletionsForRange: vi.fn().mockResolvedValue([]),
}));
vi.mock('../tasks/tasks.service.js', () => ({
  getStepsForTaskIds: vi.fn().mockResolvedValue([]),
}));

function mondayOf(d: Date): string {
  const diff = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

describe('getWeekOccurrences', () => {
  it('expande recorrentes e agendados na semana', async () => {
    const tasks = [
      { id: '1', title: 'Trabalho', type: 'RECURRING' as const, weekdays: [1, 2, 3], startTime: '09:00', active: true },
      { id: '2', title: 'Reunião', type: 'SCHEDULED' as const, weekdays: [], date: '2026-06-10', startTime: '14:00', active: true },
    ];

    const occurrences = await getWeekOccurrences('user-1', tasks, '2026-06-08');
    expect(occurrences.some((item) => item.title === 'Trabalho')).toBe(true);
    expect(occurrences.some((item) => item.title === 'Reunião')).toBe(true);
  });

  it('esconde ocorrências futuras de uma rotina pausada, mas mantém as passadas', async () => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const weekStartISO = mondayOf(today);
    const pausedUntil = new Date(today);
    pausedUntil.setDate(pausedUntil.getDate() + 1);
    const pausedUntilISO = pausedUntil.toISOString().slice(0, 10);

    const tasks = [
      {
        id: '1', title: 'Diária', type: 'RECURRING' as const,
        weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '09:00', active: true,
        pausedUntil: pausedUntilISO,
      },
    ];

    const occurrences = await getWeekOccurrences('user-1', tasks, weekStartISO);
    const dates = occurrences.map((o) => o.date);

    expect(dates).not.toContain(todayISO);
    expect(dates).not.toContain(pausedUntilISO);
    if (weekStartISO !== todayISO) {
      expect(dates).toContain(weekStartISO);
    }
  });
});
