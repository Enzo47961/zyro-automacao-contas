/**
 * Testes da leitura de códigos de pagamento (a parte que não pode errar).
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dataParaFator,
  encontrarCodigos,
  fatorParaData,
  formatarLinhaDigitavel,
  gerarArrecadacao,
  gerarChaveNfe,
  gerarLinhaDigitavel,
  lerArrecadacao,
  lerBoleto,
  lerChaveNfe,
  modulo10,
} from '../src/lib/codigos';
import { categorizar } from '../src/lib/classificar';

const REF = Date.parse('2026-09-22T12:00:00Z');

describe('módulos', () => {
  it('módulo 10 do exemplo clássico da Febraban', () => {
    assert.equal(modulo10('001900000'), 9);
    assert.equal(modulo10('0'), 0);
  });
});

describe('fator de vencimento', () => {
  it('antes e depois do reinício de 22/02/2025', () => {
    assert.equal(dataParaFator('2000-07-03'), 1000);
    assert.equal(dataParaFator('2025-02-21'), 9999);
    assert.equal(dataParaFator('2025-02-22'), 1000);
    assert.equal(fatorParaData(1000, REF), '2025-02-22', 'hoje, fator 1000 é a data nova, não 2000');
    assert.equal(fatorParaData(1000, Date.parse('2001-01-01')), '2000-07-03');
    assert.equal(fatorParaData(0, REF), null);
  });
});

describe('boleto bancário', () => {
  const linha = gerarLinhaDigitavel({ banco: '341', valorCentavos: 123456, vencimento: '2026-10-10', campoLivre: '1790010104351004791020150' });

  it('lê banco, valor e vencimento da própria linha', () => {
    const r = lerBoleto(linha, REF);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.boleto.banco, '341');
    assert.equal(r.boleto.bancoNome, 'Itaú');
    assert.equal(r.boleto.valorCentavos, 123456);
    assert.equal(r.boleto.vencimento, '2026-10-10');
    assert.equal(r.boleto.codigoBarras.length, 44);
  });

  it('recusa qualquer dígito trocado', () => {
    for (const posicao of [2, 15, 25, 32, 40]) {
      const trocado = linha.slice(0, posicao) + ((Number(linha[posicao]) + 1) % 10) + linha.slice(posicao + 1);
      assert.equal(lerBoleto(trocado, REF).ok, false, `troca na posição ${posicao} deveria falhar`);
    }
  });
});

describe('arrecadação (contas de consumo e tributos)', () => {
  it('lê segmento, valor e vencimento embutido', () => {
    const codigo = gerarArrecadacao({ segmento: '3', valorCentavos: 28790, empresa: '0048', vencimento: '2026-10-15', complemento: '123' });
    const r = lerArrecadacao(codigo, REF);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.conta.categoria, 'Energia');
    assert.equal(r.conta.valorCentavos, 28790);
    assert.equal(r.conta.vencimento, '2026-10-15');
    assert.equal(lerArrecadacao(codigo.slice(0, 20) + (Number(codigo[20]) + 1) % 10 + codigo.slice(21), REF).ok, false);
  });
});

describe('chave da NF-e', () => {
  it('valida o DV e extrai o CNPJ do emitente', () => {
    const chave = gerarChaveNfe({ uf: '35', aamm: '2609', cnpj: '12345678000195', serie: 1, numero: 1234, codigo: '10000123' });
    const r = lerChaveNfe(chave);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.nfe.uf, 'SP');
    assert.equal(r.nfe.cnpjEmitente, '12345678000195');
    assert.equal(r.nfe.numero, '1234');
    assert.equal(lerChaveNfe(`${chave.slice(0, 43)}${(Number(chave[43]) + 1) % 10}`).ok, false);
  });
});

describe('busca em texto livre', () => {
  it('acha códigos impressos com pontos e espaços, sem falsos positivos', () => {
    const boleto = gerarLinhaDigitavel({ banco: '237', valorCentavos: 50000, vencimento: '2026-10-01', campoLivre: '987654321' });
    const texto = `Beneficiário: Teste Ltda\nCNPJ 12.345.678/0001-95\n${formatarLinhaDigitavel(boleto)}\nPedido 2026 000123 total 500,00`;
    const achados = encontrarCodigos(texto, REF);
    assert.equal(achados.boletos.length, 1);
    assert.equal(achados.contas.length + achados.chaves.length, 0);
  });

  it('não confunde 2.000 boletos aleatórios com outros códigos', () => {
    let erros = 0;
    for (let i = 0; i < 2000; i += 1) {
      const l = gerarLinhaDigitavel({ banco: '001', valorCentavos: i * 137, vencimento: '2026-11-01', campoLivre: String(i * 7919).padStart(25, '3') });
      const r = encontrarCodigos(formatarLinhaDigitavel(l), REF);
      if (r.boletos.length !== 1 || r.contas.length || r.chaves.length) erros += 1;
    }
    assert.equal(erros, 0);
  });
});

describe('categorias', () => {
  it('classifica por palavras-chave sem pegar preposições', () => {
    assert.equal(categorizar('Energia Paulista Distribuidora S.A.'), 'Energia');
    assert.equal(categorizar('Imobiliária Centro Imóveis Ltda', 'aluguel do ponto'), 'Aluguel e condomínio');
    assert.equal(categorizar('Moinho Bom Trigo Ltda', 'farinha das melhores'), 'Fornecedores');
  });
});
