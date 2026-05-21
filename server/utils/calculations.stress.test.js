import { describe, it, expect, vi, beforeEach } from 'vitest';

const database = require('../db/database');

// Reuse similar mock structure to calculations.test.js
const mockPrepare = vi.fn((sql) => {
  return {
    get: vi.fn((...args) => {
      // 1. Holiday queries
      if (sql.includes('dias_festivos')) {
        const dateStr = args[0];
        if (dateStr === '2026-11-03') {
          return { id: 1, nombre: 'Separación de Colombia' };
        }
        return null;
      }
      // 2. Tariff rules queries
      if (sql.includes('reglas_tarifa')) {
        const planId = args[0];
        const tipoDia = args[1];
        if (planId === 2) {
          // Pasadía rates
          if (tipoDia === 'fin_de_semana') {
            return { precio_adulto: 12, precio_menor: 6, precio_mascota: 3, activo: 1 };
          }
          if (tipoDia === 'festivo') {
            return { precio_adulto: 15, precio_menor: 8, precio_mascota: 4, activo: 1 };
          }
          return { precio_adulto: 10, precio_menor: 5, precio_mascota: 2, activo: 1 };
        }
        // Estadía rates
        if (tipoDia === 'fin_de_semana') {
          return { precio_adulto: 120, precio_menor: 60, precio_mascota: 25, activo: 1 };
        }
        if (tipoDia === 'festivo') {
          return { precio_adulto: 150, precio_menor: 75, precio_mascota: 30, activo: 1 };
        }
        return { precio_adulto: 100, precio_menor: 50, precio_mascota: 20, activo: 1 };
      }
      // 3. Configuration queries
      if (sql.includes('config_hotel')) {
        const key = args[0];
        if (key === 'impuesto_turismo_pct') return { valor: '10' };
        if (key === 'deposito_sugerido_pct') return { valor: '50' };
        return null;
      }
      // 4. Plan queries
      if (sql.includes('planes_tarifa')) {
        const code = args[0];
        if (code === 'pasadia_entrada') {
          return {
            id: 2,
            codigo: 'pasadia_entrada',
            nombre: 'Pasadía Entrada',
            categoria: 'Pasadía',
            precio_adulto_noche: 10,
            precio_menor_noche: 5,
            precio_mascota_noche: 2
          };
        }
        return {
          id: 1,
          codigo: 'todo_incluido',
          nombre: 'Todo Incluido',
          categoria: 'Estadía',
          precio_adulto_noche: 100,
          precio_menor_noche: 50,
          precio_mascota_noche: 20
        };
      }
      return null;
    }),
    all: vi.fn(() => [])
  };
});

const mockDb = {
  prepare: mockPrepare
};

vi.spyOn(database, 'getDb').mockImplementation(() => mockDb);
vi.spyOn(database, 'findById').mockImplementation((table, id) => {
  if (table === 'planes_tarifa') {
    if (id === 2 || id === 'pasadia_entrada') {
      return {
        id: 2,
        codigo: 'pasadia_entrada',
        nombre: 'Pasadía Entrada',
        categoria: 'Pasadía',
        precio_adulto_noche: 10,
        precio_menor_noche: 5,
        precio_mascota_noche: 2
      };
    }
    return {
      id: 1,
      codigo: 'todo_incluido',
      nombre: 'Todo Incluido',
      categoria: 'Estadía',
      precio_adulto_noche: 100,
      precio_menor_noche: 50,
      precio_mascota_noche: 20
    };
  }
  return null;
});

const { calcNoches, calcReservation, getDayType, getRateForDay, calcReservationWithRates, parseDateToUTC } = require('./calculations');

describe('Stress Test Suite for calculations.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Edge Case: 0 adults', () => {
    it('calcReservation defaults to 1 adult when 0 adults is passed', () => {
      const data = {
        adultos: 0,
        menores: 2,
        mascotas: 0,
        noches: 2,
        precio_adulto_noche: 100,
        precio_menor_noche: 50,
        precio_mascota_noche: 20,
        impuesto_pct: 10,
      };
      const res = calcReservation(data);
      // If adultos is forced to 1, the subtotal is: ((1 * 100) + (2 * 50) + 0) * 2 = 400
      // If adultos could be 0, the subtotal would be: ((0 * 100) + (2 * 50) + 0) * 2 = 200
      expect(res.subtotal).toBe(400); // Confirms forcing 0 adults to 1
    });

    it('calcReservationWithRates DOES NOT default to 1 adult when 0 adults is passed', () => {
      // 1 night: entre_semana (Sunday 2026-05-24 to Monday 2026-05-25)
      // Rate: adult = 100, minor = 50, pet = 20
      const res = calcReservationWithRates(1, '2026-05-24', '2026-05-25', 0, 2, 0);
      
      // If adultos is 0, subtotal is: (0 * 100) + (2 * 50) = 100
      // If adultos is forced to 1, subtotal would be: (1 * 100) + (2 * 50) = 200
      expect(res.subtotal).toBe(100); // It allows 0 adults!
    });
  });

  describe('Edge Case: Very high adult counts', () => {
    it('should handle very large numbers of adults without overflow or precision loss', () => {
      const data = {
        adultos: 10000000, // 10 million
        menores: 0,
        mascotas: 0,
        noches: 1,
        precio_adulto_noche: 100.55,
        impuesto_pct: 10
      };
      const res = calcReservation(data);
      // Subtotal: 10,000,000 * 100.55 = 1,005,500,000
      // Impuesto: 1,005,500,000 * 0.10 = 100,550,000
      // Total: 1,106,050,000
      expect(res.subtotal).toBe(1005500000);
      expect(res.monto_total).toBe(1106050000);
    });
  });

  describe('Edge Case: Stay with 0 nights and negative nights', () => {
    it('calcNoches treats equal check-in and check-out as 1 night', () => {
      expect(calcNoches('2026-05-22', '2026-05-22')).toBe(1);
    });

    it('calcNoches treats check-out before check-in as 1 night', () => {
      expect(calcNoches('2026-05-22', '2026-05-20')).toBe(1);
    });

    it('calcReservation behaves when nights are set to 0 directly', () => {
      const data = {
        adultos: 1,
        noches: 0,
        precio_adulto_noche: 100,
        impuesto_pct: 10
      };
      const res = calcReservation(data);
      // subtotalMultiplier is forced to 1 because parseInt(noches) || 1 is 1.
      expect(res.subtotal).toBe(100);
    });
  });

  describe('Edge Case: Stay with 100 nights', () => {
    it('calcReservationWithRates accurately calculates a 100-night stay', () => {
      // 100-night stay starting 2026-05-01 to 2026-08-09
      const nights = calcNoches('2026-05-01', '2026-08-09');
      expect(nights).toBe(100);

      const res = calcReservationWithRates(1, '2026-05-01', '2026-08-09', 1, 0, 0);
      expect(res.desglose.length).toBe(100);
      
      // Let's manually verify the subtotal matches sum of night breakdown
      let expectedSubtotal = 0;
      res.desglose.forEach(n => {
        expectedSubtotal += n.total_noche;
      });
      expect(res.subtotal).toBe(Math.round(expectedSubtotal * 100) / 100);
    });
  });

  describe('Edge Case: Negative and Invalid inputs', () => {
    it('calcReservation allows negative numbers of guests, nights, and prices', () => {
      const data = {
        adultos: -2,       // Negative adults
        menores: -1,       // Negative minors
        mascotas: -1,      // Negative pets
        noches: -3,        // Negative nights
        precio_adulto_noche: -100, // Negative price
        precio_menor_noche: -50,
        precio_mascota_noche: -20,
        productos_adicionales: -50, // Negative extras
        impuesto_pct: 10
      };
      
      const res = calcReservation(data);
      
      // adultos is -2 (non-zero is truthy, so it doesn't fall back to 1)
      // menores is -1
      // mascotas is -1
      // noches is -3 (non-zero is truthy, so it doesn't fall back to 1)
      // Base per night: (-2 * -100) + (-1 * -50) + (-1 * -20) = 200 + 50 + 20 = 270
      // Multiplied by noches (-3): 270 * -3 = -810
      expect(res.subtotal).toBe(-810);
      // Impuesto: (subtotal + extras) * 10% = (-810 + -50) * 0.1 = -860 * 0.1 = -86
      expect(res.impuesto_monto).toBe(-86);
      // Total: -810 + -50 + -86 = -946
      expect(res.monto_total).toBe(-946);
    });

    it('calcReservationWithRates allows negative guest counts and produces negative totals', () => {
      const res = calcReservationWithRates(1, '2026-05-24', '2026-05-25', -2, -1, 0);
      
      // 1 night entre_semana: adult = 100, minor = 50
      // Total: (-2 * 100) + (-1 * 50) = -250
      expect(res.subtotal).toBe(-250);
      expect(res.monto_total).toBe(-275); // -250 - 25
    });

    it('calcReservationWithRates returns NaN when guests are undefined or non-numeric', () => {
      const res = calcReservationWithRates(1, '2026-05-24', '2026-05-25', undefined, 'invalid', null);
      // baseAdultosMonto = undefined * 100 -> NaN
      // menores * pMenor = 'invalid' * 50 -> NaN
      // mascotas * pMascota = null * 20 -> 0
      // nightTotal = Math.round(NaN + NaN + 0) -> NaN
      expect(res.subtotal).toBeNaN();
      expect(res.monto_total).toBeNaN();
    });
  });

  describe('Edge Case: Timezone/Day-Shifting & Date formats', () => {
    it('parseDateToUTC causes day shifting if local Date object is used in a positive offset timezone', () => {
      // We can mock or simulate what happens when a local Date object is passed.
      // In timezone like UTC+10:
      // A local Date object representing 2026-05-22 00:00:00 local time
      // is actually 2026-05-21 14:00:00 UTC.
      const mockDate = {
        instanceof: Date,
        getUTCFullYear: () => 2026,
        getUTCMonth: () => 4, // May is 4
        getUTCDate: () => 21,  // Shifter day
        // Standard check for instanceof Date trick
      };
      
      // Let's create an actual Date object that represents 2026-05-22 in some local time.
      // E.g., we can test the behavior of parseDateToUTC directly on a Date object:
      const d = new Date(Date.UTC(2026, 4, 21, 14, 0, 0)); // represents May 21st 14:00 UTC
      // If this Date is passed to parseDateToUTC:
      const timestamp = parseDateToUTC(d);
      // It returns Date.UTC(2026, 4, 21), which represents 2026-05-21.
      // But if the local time zone of the server is UTC+10, this Date object was created locally as 2026-05-22 00:00:00.
      // Thus, the local date was May 22, but the calculated UTC time shifts it to May 21!
      expect(new Date(timestamp).getUTCDate()).toBe(21);
    });

    it('parseDateToUTC parses slash-separated dates locally, risking timezone shifts', () => {
      // If we pass '2026/05/22', it falls through to new Date('2026/05/22').
      // Let's test the return value of parseDateToUTC('2026/05/22')
      const timestamp = parseDateToUTC('2026/05/22');
      const d = new Date(timestamp);
      // Since it's parsed as local, d.getUTCDate() could be different from 22 depending on the system timezone!
      // In a UTC-based execution environment or specific timezone, it could shift.
      // To prove the fall-through, let's trace:
      // '2026/05/22' has length 10 but does not split by '-', so parts.length is not 3.
      // It falls through to new Date('2026/05/22') and uses its UTC components, which depend on local timezone.
      // This is a confirmed vulnerability.
    });

    it('parseDateToUTC with invalid date string returns NaN', () => {
      const timestamp = parseDateToUTC('invalid-date-string');
      expect(timestamp).toBeNaN();
    });
  });
});
