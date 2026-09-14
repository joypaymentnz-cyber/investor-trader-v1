export function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d;
}
export function expectedProfit(amount:number, roiPercent:number){ return amount * roiPercent / 100; }
export function expectedPayout(amount:number, roiPercent:number){ return amount + expectedProfit(amount, roiPercent); }