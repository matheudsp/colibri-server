import { format, parseISO, isDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateTime } from 'luxon';

export class DateUtils {
  private static readonly DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
  private static readonly DEFAULT_DATETIME_FORMAT = 'dd/MM/yyyy HH:mm:ss';

  static formatDate(date: Date | string, pattern?: string): string {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    if (!this.isValidDate(parsedDate)) throw new Error('Invalid date');

    return format(parsedDate, pattern || this.DEFAULT_DATE_FORMAT, {
      locale: ptBR,
    });
  }

  static formatDateTime(datetime: Date | string, pattern?: string): string {
    const parsedDate =
      typeof datetime === 'string' ? parseISO(datetime) : datetime;
    if (!this.isValidDate(parsedDate)) throw new Error('Invalid datetime');

    return format(parsedDate, pattern || this.DEFAULT_DATETIME_FORMAT, {
      locale: ptBR,
    });
  }

  static formatForDisplay(date: Date | string, pattern = 'MMMM, yyyy'): string {
    try {
      const dt =
        typeof date === 'string'
          ? DateTime.fromSQL(date) || DateTime.fromISO(date)
          : DateTime.fromJSDate(date);

      return format(dt.toJSDate(), pattern, { locale: ptBR });
    } catch {
      return '';
    }
  }

  static nowInTimezone(timezone = 'America/Sao_Paulo'): DateTime {
    return DateTime.now().setZone(timezone);
  }

  static toLuxon(date: Date | string, timezone?: string): DateTime {
    if (typeof date === 'string') {
      return DateTime.fromISO(date, { zone: timezone || 'utc' });
    }
    return DateTime.fromJSDate(date, { zone: timezone || 'utc' });
  }

  static fromLuxon(luxonDate: DateTime): Date {
    return luxonDate.toJSDate();
  }

  static addDays(date: Date | string, days: number, timezone?: string): Date {
    return this.toLuxon(date, timezone).plus({ days }).toJSDate();
  }

  static subtractDays(
    date: Date | string,
    days: number,
    timezone?: string,
  ): Date {
    return this.toLuxon(date, timezone).minus({ days }).toJSDate();
  }

  static isBefore(date1: Date | string, date2: Date | string): boolean {
    return this.toLuxon(date1) < this.toLuxon(date2);
  }

  static isAfter(date1: Date | string, date2: Date | string): boolean {
    return this.toLuxon(date1) > this.toLuxon(date2);
  }

  static isSameDay(date1: Date | string, date2: Date | string): boolean {
    return this.toLuxon(date1).hasSame(this.toLuxon(date2), 'day');
  }

  static diffInDays(startDate: Date | string, endDate: Date | string): number {
    return this.toLuxon(endDate).diff(this.toLuxon(startDate), 'days').days;
  }

  static startOfDay(date: Date | string, timezone?: string): Date {
    return this.toLuxon(date, timezone).startOf('day').toJSDate();
  }

  static endOfDay(date: Date | string, timezone?: string): Date {
    return this.toLuxon(date, timezone).endOf('day').toJSDate();
  }

  static now(): Date {
    return new Date();
  }

  static parseDate(dateString: string): Date {
    return parseISO(dateString);
  }

  static isValidDate(value: unknown): boolean {
    if (isDate(value)) return !isNaN(value.getTime());
    if (typeof value === 'string') return DateTime.fromISO(value).isValid;
    return false;
  }
}
