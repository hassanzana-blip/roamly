export interface PaxCount {
  adult: number;
  child: number;
  infant_without_seat: number;
}

export interface PaxAges {
  children: number[];
  infants: number[];
}

export function syncAges(pax: PaxCount, ages: PaxAges): PaxAges {
  const grow = (arr: number[], n: number, def: number) => {
    const next = arr.slice(0, n);
    while (next.length < n) next.push(def);
    return next;
  };
  return {
    children: grow(ages.children, pax.child, 8),
    infants: grow(ages.infants, pax.infant_without_seat, 1),
  };
}

export function paxSummary(p: PaxCount): string {
  const total = p.adult + p.child + p.infant_without_seat;
  return `${total} reisende`;
}
