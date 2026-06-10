/** Retorna a data LOCAL no formato YYYY-MM-DD (nunca usa UTC). */
export function localISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Segunda-feira da semana que contém `d` (semana começa na segunda). */
export function mondayOf(d: Date = new Date()): Date {
  const day = d.getDay();           // 0=dom … 6=sáb
  const diff = (day + 6) % 7;      // dias desde segunda
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  return mon;
}

/** Domingo da semana que contém `d` (semana começa no domingo). */
export function sundayOf(d: Date = new Date()): Date {
  const day = d.getDay(); // 0=dom
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  return sun;
}

/** Início da semana respeitando a preferência salva no localStorage. */
export function weekStartOf(d: Date = new Date()): Date {
  return localStorage.getItem('weekStartsSunday') === '1' ? sundayOf(d) : mondayOf(d);
}

/** Adiciona `n` dias a uma data (retorna nova instância). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
