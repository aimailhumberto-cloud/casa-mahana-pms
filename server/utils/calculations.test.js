import { describe, it, expect, vi, beforeEach } from 'vitest';

// Require the database module first
const database = require('../db/database');

// Create a smart mock for prep statements based on SQL queries
const mockPrepare = vi.fn((sql) => {
  return {
    get: vi.fn((...args) => {
      // 1. Holiday queries (dias_festivos)
      if (sql.includes('dias_festivos')) {
        const dateStr = args[0];
        if (dateStr === '2026-11-03') {
          return { id: 1, nombre: 'Separación de Colombia' };
        }
        return null;
      }
      // 2. Tariff rules queries (reglas_tarifa)
      if (sql.includes('reglas_tarifa')) {
        const planId = args[0];
        const tipoDia = args[1];
        if (tipoDia === 'fin_de_semana') {
          return { precio_adulto: 120, precio_menor: 60, precio_mascota: 25, activo: 1 };
        }
        if (tipoDia === 'festivo') {
          return { precio_adulto: 150, precio_menor: 75, precio_mascota: 30, activo: 1 };
        }
        return { precio_adulto: 100, precio_menor: 50, precio_mascota: 20, activo: 1 };
      }
      // 3. Configuration queries (config_hotel)
      if (sql.includes('config_hotel')) {
        const key = args[0];
        if (key === 'impuesto_turismo_pct') return { valor: '10' };
        if (key === 'deposito_sugerido_pct') return { valor: '50' };
        return null;
      }
      return null;
    }),
    all: vi.fn(() => [])
  };
});

const mockDb = {
  prepare: mockPrepare
};

// Spy on getDb and findById
const spyGetDb = vi.spyOn(database, 'getDb').mockImplementation(() => mockDb);
const spyFindById = vi.spyOn(database, 'findById').mockImplementation(() => ({
  id: 1,
  codigo: 'todo_incluido',
  precio_adulto_noche: 100,
  precio_menor_noche: 50,
  precio_mascota_noche: 20
}));

// Now require calculations (it will get the spied database operations)
const { calcNoches, calcReservation, getDayType, getRateForDay, calcReservationWithRates } = require('./calculations');

describe('Cálculos de Noches (calcNoches)', () => {
  it('debe calcular las noches correctas entre dos fechas', () => {
    expect(calcNoches('2026-05-20', '2026-05-23')).toBe(3);
    expect(calcNoches('2026-06-01', '2026-06-15')).toBe(14);
  });

  it('debe retornar mínimo 1 noche si las fechas son iguales o inversas', () => {
    expect(calcNoches('2026-05-20', '2026-05-20')).toBe(1);
    expect(calcNoches('2026-05-20', '2026-05-18')).toBe(1);
  });
});

describe('Motor de Cotización Estándar (calcReservation)', () => {
  it('debe calcular el desglose correcto con adultos y tarifas base', () => {
    const data = {
      adultos: 2,
      menores: 1,
      mascotas: 1,
      noches: 2,
      precio_adulto_noche: 100,
      precio_menor_noche: 50,
      precio_mascota_noche: 20,
      impuesto_pct: 10,
    };

    const res = calcReservation(data);
    
    // Subtotal esperado: ((2 * 100) + (1 * 50) + (1 * 20)) * 2 = 270 * 2 = 540
    expect(res.subtotal).toBe(540);
    // Impuesto esperado: 540 * 0.10 = 54
    expect(res.impuesto_monto).toBe(54);
    // Total esperado: 540 + 54 = 594
    expect(res.monto_total).toBe(594);
    // Depósito esperado: 594 * 0.50 = 297
    expect(res.deposito_sugerido).toBe(297);
    // Saldo pendiente esperado: 594 - 0 = 594
    expect(res.saldo_pendiente).toBe(594);
  });

  it('debe añadir correctamente los productos adicionales (extras)', () => {
    const data = {
      adultos: 1,
      noches: 1,
      precio_adulto_noche: 100,
      productos_adicionales: 50, // Extras
      impuesto_pct: 10,
    };

    const res = calcReservation(data);
    
    // Subtotal esperado: (1 * 100) * 1 = 100
    expect(res.subtotal).toBe(100);
    expect(res.productos_adicionales).toBe(50);
    // Impuesto esperado: (100 + 50) * 0.10 = 15
    expect(res.impuesto_monto).toBe(15);
    // Total esperado: 100 + 50 + 15 = 165
    expect(res.monto_total).toBe(165);
  });
});

describe('Determinación de Tipo de Día (getDayType)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar "festivo" si la fecha está registrada como festivo', () => {
    expect(getDayType('2026-11-03')).toBe('festivo');
  });

  it('debe retornar "fin_de_semana" los viernes y sábados', () => {
    // 2026-05-22 es Viernes
    expect(getDayType('2026-05-22')).toBe('fin_de_semana');
  });

  it('debe retornar "entre_semana" los domingos a jueves', () => {
    // 2026-05-19 es Martes
    expect(getDayType('2026-05-19')).toBe('entre_semana');
  });
});

describe('Cotización Dinámica por Noche (calcReservationWithRates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe calcular noches dinámicas consultando reglas y devolviendo desglose', () => {
    // Noches: 2 (2026-05-22 Viernes y 2026-05-23 Sábado)
    const res = calcReservationWithRates(1, '2026-05-22', '2026-05-24', 2, 0, 0);

    // Cada noche de fin de semana: (2 * 120) = 240. Dos noches: 480
    expect(res.subtotal).toBe(480);
    expect(res.impuesto_monto).toBe(48); // 10% de 480
    expect(res.monto_total).toBe(528);
    expect(res.desglose.length).toBe(2);
    expect(res.desglose[0].tipo_dia).toBe('fin_de_semana');
    expect(res.desglose[0].precio_adulto).toBe(120);
    expect(res.desglose[0].total_noche).toBe(240);
  });
});
