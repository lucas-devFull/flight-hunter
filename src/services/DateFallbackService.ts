export interface DateFallbackResult {
  departureDate: string;
  returnDate: string | null;
  departureFallback: boolean; // true if generated
  returnFallback: boolean; // true if generated
}

export class DateFallbackService {
  private readonly _getNow: () => Date;
  private readonly _getRandom: () => number;

  constructor(getNow?: () => Date, getRandom?: () => number) {
    this._getNow = getNow ?? (() => new Date());
    this._getRandom = getRandom ?? (() => Math.random());
  }

  /**
   * Resolve datas para busca.
   * Se data_ida não informada e provider exige: gera entre 30-90 dias à frente.
   * Se data_volta não informada e provider exige: gera 7-14 dias após ida.
   * Preserva datas informadas pelo usuário.
   */
  resolve(params: {
    departureDate?: string | null;
    returnDate?: string | null;
    providerRequiresDate: boolean;
    providerRequiresReturn: boolean;
  }): DateFallbackResult {
    let departureDate: string;
    let departureFallback: boolean;

    if (params.departureDate) {
      departureDate = params.departureDate;
      departureFallback = false;
    } else if (params.providerRequiresDate) {
      departureDate = this.generateFutureDate(30, 90);
      departureFallback = true;
    } else {
      departureDate = '';
      departureFallback = false;
    }

    let returnDate: string | null;
    let returnFallback: boolean;

    if (params.returnDate) {
      returnDate = params.returnDate;
      returnFallback = false;
    } else if (params.providerRequiresReturn) {
      // Generate return date 7-14 days after departure
      const baseDate = departureDate
        ? this.parseDateString(departureDate)
        : this._getNow();
      returnDate = this.generateFutureDateFromBase(baseDate, 7, 14);
      returnFallback = true;
    } else {
      returnDate = null;
      returnFallback = false;
    }

    return {
      departureDate,
      returnDate,
      departureFallback,
      returnFallback,
    };
  }

  /** Gera data futura aleatória entre minDays e maxDays a partir de hoje */
  private generateFutureDate(minDays: number, maxDays: number): string {
    const now = this._getNow();
    return this.generateFutureDateFromBase(now, minDays, maxDays);
  }

  /** Gera data futura aleatória entre minDays e maxDays a partir de uma data base */
  private generateFutureDateFromBase(
    base: Date,
    minDays: number,
    maxDays: number,
  ): string {
    const daysAhead =
      minDays + Math.floor(this._getRandom() * (maxDays - minDays + 1));
    const target = new Date(base);
    target.setDate(target.getDate() + daysAhead);
    return this.formatDate(target);
  }

  /** Formata uma data como YYYY-MM-DD */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Converte string YYYY-MM-DD para Date */
  private parseDateString(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
