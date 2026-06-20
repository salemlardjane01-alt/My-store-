export const isArabic = (text?: string): boolean => {
  return text ? /[\u0600-\u06FF]/.test(text) : false;
};
