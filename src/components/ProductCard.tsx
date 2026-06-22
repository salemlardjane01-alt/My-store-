import React from 'react';
import { Product } from '../types';
import { isArabic } from '../lib/textHelpers';
import { PriceDisplay } from './PriceDisplay';

export interface ProductCardProps extends Product {
  onSelect?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo((props) => {
  const { id, title, name, description, image, price, oldPrice, rating, reviews, badge, bgColor, onSelect } = props;
  const bgClass = bgColor === 'gray' ? 'bg-brand-card-gray' : (bgColor === 'beige' ? 'bg-brand-card-beige' : 'bg-neutral-100');
  
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  
  const displayTitle = name || title || 'Unnamed Product';
  const isTitleArabic = isArabic(displayTitle);

  // IntersectionObserver for prefetching when card enters viewport
  React.useEffect(() => {
    if (typeof window === 'undefined' || !id) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Prefetch component files
          import('../lib/prefetchHelper').then(m => m.prefetchComponent('details')).catch(() => {});
          // Prefetch product Firestore data from cash
          import('../firebase').then(m => m.getProductById(id)).catch(() => {});
          
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '100px' });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, [id]);

  // Interaction Prefetch handlers for Hover and Touch
  const handlePrefetch = React.useCallback(() => {
    if (!id) return;
    import('../lib/prefetchHelper').then(m => m.prefetchComponent('details')).catch(() => {});
    import('../firebase').then(m => m.getProductById(id)).catch(() => {});
  }, [id]);

  const hasDiscount = oldPrice && oldPrice > price;

  return (
    <div 
      ref={cardRef}
      className="flex flex-col group cursor-pointer h-full" 
      onClick={onSelect}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className={`relative aspect-[4/5] rounded-2xl ${image ? 'bg-neutral-100 overflow-hidden' : bgClass} mb-3 p-3 flex flex-col justify-between`}>
        {image && (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-neutral-200 animate-pulse rounded-2xl" />
            )}
            <img 
              src={image} 
              alt={displayTitle} 
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} 
              referrerPolicy="no-referrer" 
            />
          </>
        )}
        <div className="relative z-10 w-full flex justify-between items-start gap-1">
          {badge ? (
            <div className="bg-white/90 backdrop-blur-sm px-3 pt-1.5 pb-1 rounded-full w-fit">
              <span className="text-[9px] font-semibold tracking-[0.05em] uppercase text-brand-text">{badge}</span>
            </div>
          ) : <div />}
          {hasDiscount && (
            <div className="bg-red-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-full shadow-xs tracking-tight select-none">
              -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
            </div>
          )}
        </div>
      </div>
      <div className={`flex justify-between items-start gap-2 mb-1 px-1 ${isTitleArabic ? 'flex-row-reverse' : ''}`}>
        <h3 className={`text-[15px] font-medium leading-snug text-brand-text flex-1 line-clamp-2 ${isTitleArabic ? 'text-right' : 'text-left'}`} dir={isTitleArabic ? 'rtl' : 'ltr'}>{displayTitle}</h3>
        <div className="shrink-0 flex flex-col items-end">
          <PriceDisplay amount={price} className="text-[15px] font-bold text-brand-text inline-flex gap-1" currencyClassName="text-[11px] font-normal opacity-90 mt-0.5" />
          {hasDiscount && (
            <PriceDisplay amount={oldPrice} className="text-[11px] text-neutral-400 line-through inline-flex gap-1 mt-0.5" currencyClassName="text-[9px] mt-0.5" />
          )}
        </div>
      </div>
      {description && (
        <p className={`text-[13px] text-neutral-500 px-1 mb-1 line-clamp-1 ${isArabic(description) ? 'text-right' : 'text-left'}`} dir={isArabic(description) ? 'rtl' : 'ltr'}>{description}</p>
      )}
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
