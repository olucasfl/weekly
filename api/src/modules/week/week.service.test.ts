import { describe, expect, it, vi } from 'vitest';
import { getWeekOccurrences } from './week.service.js';

// Mock the DB call so the test doesn't need a real database
vi.mock('../completions/completions.service.js', () => ({
  getCompletionsForRange: vi.fn().mockResolvedValue([]),
}));

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
});
