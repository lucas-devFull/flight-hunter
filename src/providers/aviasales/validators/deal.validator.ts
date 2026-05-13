import type { AviasalesDeal } from '../types/deal.types';

/** Regras de validação para descartar deals inválidos */
export function validateDeal(deal: AviasalesDeal): boolean {
  // Preço irrealista (muito baixo ou muito alto)
  if (deal.price < 100 || deal.price > 30_000) return false;

  // Data de partida no passado
  const departure = new Date(deal.departureAt);
  if (departure.getTime() < Date.now()) return false;

  // Muitas escalas (3+)
  if (deal.transfers !== undefined && deal.transfers >= 3) return false;

  // Viagem muito curta (menos de 1 dia) ou muito longa (mais de 60 dias)
  if (deal.tripDays !== undefined) {
    if (deal.tripDays < 1 || deal.tripDays > 60) return false;
  }

  return true;
}
