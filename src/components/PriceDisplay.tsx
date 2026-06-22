import React from 'react';

interface PriceDisplayProps {
  amount: number;
  className?: string;
  currencyClassName?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({ amount, className = '', currencyClassName = '' }) => (
  <span className={className} dir="ltr">
    <span className={currencyClassName}>دج</span>
    <span>{(amount || 0).toFixed(0)}</span>
  </span>
);
