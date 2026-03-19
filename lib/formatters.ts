export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatPercent(percentOff: number): string {
  return (percentOff * 100).toFixed(1) + '%';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}
