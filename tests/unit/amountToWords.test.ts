import { describe, it, expect } from 'vitest';
import { amountToWords } from '../../src/shared/utils/amountToWords.js';
import { ValidationError } from '../../src/shared/errors.js';

describe('amountToWords', () => {
  it('convierte 0 y 1 con la concordancia de género y número correcta', () => {
    expect(amountToWords(0)).toBe('Cero pesos M/CTE');
    expect(amountToWords(1)).toBe('Un peso M/CTE');
    expect(amountToWords(1, { suffix: '' })).toBe('Un peso');
  });

  it('convierte números del 2 al 29 correctamente con tildes ortográficas', () => {
    expect(amountToWords(5)).toBe('Cinco pesos M/CTE');
    expect(amountToWords(10)).toBe('Diez pesos M/CTE');
    expect(amountToWords(15)).toBe('Quince pesos M/CTE');
    expect(amountToWords(16)).toBe('Dieciséis pesos M/CTE');
    expect(amountToWords(20)).toBe('Veinte pesos M/CTE');
    expect(amountToWords(21)).toBe('Veintiún pesos M/CTE');
    expect(amountToWords(22)).toBe('Veintidós pesos M/CTE');
    expect(amountToWords(23)).toBe('Veintitrés pesos M/CTE');
    expect(amountToWords(26)).toBe('Veintiséis pesos M/CTE');
  });

  it('convierte decenas compuestas', () => {
    expect(amountToWords(30)).toBe('Treinta pesos M/CTE');
    expect(amountToWords(35)).toBe('Treinta y cinco pesos M/CTE');
    expect(amountToWords(99)).toBe('Noventa y nueve pesos M/CTE');
  });

  it('convierte centenas incluyendo casos especiales (cien, quinientos, setecientos, novecientos)', () => {
    expect(amountToWords(100)).toBe('Cien pesos M/CTE');
    expect(amountToWords(101)).toBe('Ciento un pesos M/CTE');
    expect(amountToWords(200)).toBe('Doscientos pesos M/CTE');
    expect(amountToWords(500)).toBe('Quinientos pesos M/CTE');
    expect(amountToWords(700)).toBe('Setecientos pesos M/CTE');
    expect(amountToWords(900)).toBe('Novecientos pesos M/CTE');
  });

  it('convierte miles simples y compuestos', () => {
    expect(amountToWords(1_000)).toBe('Mil pesos M/CTE');
    expect(amountToWords(2_000)).toBe('Dos mil pesos M/CTE');
    expect(amountToWords(21_000)).toBe('Veintiún mil pesos M/CTE');
  });

  it('convierte los valores de tarifas de ejemplo del seed (§13 de SPEC)', () => {
    expect(amountToWords(250_000)).toBe('Doscientos cincuenta mil pesos M/CTE');
    expect(amountToWords(450_000)).toBe('Cuatrocientos cincuenta mil pesos M/CTE');
    expect(amountToWords(1_800_000)).toBe('Un millón ochocientos mil pesos M/CTE');
    expect(amountToWords(3_200_000)).toBe('Tres millones doscientos mil pesos M/CTE');
  });

  it('aplica la regla gramatical de la RAE de "de pesos" para millones redondos', () => {
    expect(amountToWords(1_000_000)).toBe('Un millón de pesos M/CTE');
    expect(amountToWords(2_000_000)).toBe('Dos millones de pesos M/CTE');
    expect(amountToWords(10_000_000)).toBe('Diez millones de pesos M/CTE');
    expect(amountToWords(100_000_000)).toBe('Cien millones de pesos M/CTE');
  });

  it('no añade "de" cuando los millones van acompañados de miles o unidades', () => {
    expect(amountToWords(1_000_001)).toBe('Un millón un pesos M/CTE');
    expect(amountToWords(5_000_500)).toBe('Cinco millones quinientos pesos M/CTE');
  });

  it('permite sufijos personalizados o sin sufijo', () => {
    expect(amountToWords(500_000, { suffix: '' })).toBe('Quinientos mil pesos');
    expect(amountToWords(500_000, { suffix: 'COP' })).toBe('Quinientos mil pesos COP');
  });

  it('rechaza montos negativos o con decimales con ValidationError', () => {
    expect(() => amountToWords(-100)).toThrow(ValidationError);
    expect(() => amountToWords(10.5)).toThrow(ValidationError);
    expect(() => amountToWords(NaN)).toThrow(ValidationError);
    expect(() => amountToWords(Infinity)).toThrow(ValidationError);
  });
});
