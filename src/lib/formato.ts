/** Formatação compartilhada (servidor e navegador), sempre no fuso de Brasília. */
const DIA_MS = 86_400_000;

export const reais = (centavos: number, semCentavos = false) =>
  (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: semCentavos ? 0 : 2,
    maximumFractionDigits: semCentavos ? 0 : 2,
  });

export const hoje = (agora = Date.now()) => new Date(agora - 3 * 3_600_000).toISOString().slice(0, 10);

export const dataBr = (dia: string | null) => (dia ? dia.split('-').reverse().join('/') : '—');

export function dataCurta(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');
}

export const diasAte = (dia: string, referencia = hoje()) => Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${referencia}T12:00:00Z`)) / DIA_MS);

export type Tom = 'perigo' | 'alerta' | 'ok' | 'neutro';

export function prazo(dia: string | null, referencia = hoje()): { texto: string; tom: Tom } {
  if (!dia) return { texto: 'sem vencimento', tom: 'neutro' };
  const d = diasAte(dia, referencia);
  if (d < 0) return { texto: d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`, tom: 'perigo' };
  if (d === 0) return { texto: 'vence hoje', tom: 'perigo' };
  if (d === 1) return { texto: 'vence amanhã', tom: 'alerta' };
  if (d <= 7) return { texto: `em ${d} dias`, tom: 'alerta' };
  return { texto: `em ${d} dias`, tom: 'ok' };
}

export const TOM: Record<Tom, string> = {
  perigo: 'bg-perigo-100 text-perigo-700',
  alerta: 'bg-alerta-100 text-alerta-700',
  ok: 'bg-floresta-50 text-floresta-700',
  neutro: 'bg-tinta-100 text-tinta-600',
};

export function formatarLinha(l: string): string {
  if (l.length === 47) return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
  if (l.length === 48) return (l.match(/.{12}/g) ?? []).map((b) => `${b.slice(0, 11)}-${b[11]}`).join(' ');
  return l;
}

/** A mensagem do bot usa só <b>: escapamos todo o resto antes de renderizar. */
export function htmlSeguro(texto: string): string {
  return texto
    .replace(/&(?!(amp|lt|gt);)/g, '&amp;')
    .replace(/<(?!\/?b>)/g, '&lt;')
    .replace(/\n/g, '<br/>');
}

export const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
