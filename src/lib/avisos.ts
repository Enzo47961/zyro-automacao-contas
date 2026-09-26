/**
 * Quando cada aviso de uma conta sai (servidor e navegador). Espelha a regra da
 * função contas_avisos_email: o aviso de antecedência sai no primeiro dia dentro
 * da janela — se a conta chega 2 dias antes do vencimento, com antecedência de 3,
 * ele sai no mesmo dia dizendo "vence em 2 dias". Nenhum aviso sai duas vezes.
 */
import { diasAte, somarDias } from './formato';

export type TipoAviso = 'antecedencia' | 'vencimento' | 'atraso';
export type AvisoAgendado = { tipo: TipoAviso; dia: string };

export function agendaDeAvisos(vencimento: string | null, antecedencia: number, chegada: string): AvisoAgendado[] {
  if (!vencimento) return [];
  const avisos: AvisoAgendado[] = [];
  if (antecedencia > 0) {
    const dia = [somarDias(vencimento, -antecedencia), chegada].sort().at(-1)!;
    if (dia < vencimento) avisos.push({ tipo: 'antecedencia', dia });
  }
  if (vencimento >= chegada) avisos.push({ tipo: 'vencimento', dia: vencimento });
  const atraso = somarDias(vencimento, 1);
  if (atraso >= chegada) avisos.push({ tipo: 'atraso', dia: atraso });
  return avisos;
}

export function tituloAviso(tipo: TipoAviso, vencimento: string, dia: string): string {
  if (tipo === 'vencimento') return 'Vence hoje';
  if (tipo === 'atraso') return 'Venceu ontem';
  const d = diasAte(vencimento, dia);
  return d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`;
}

export const ROTULO_AVISO: Record<TipoAviso, string> = {
  antecedencia: 'Antes do vencimento',
  vencimento: 'No dia',
  atraso: 'Dia seguinte',
};
