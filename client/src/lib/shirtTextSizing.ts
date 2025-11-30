/**
 * Dynamic text sizing for T-shirt quote overlays
 * Calculates appropriate font size, line height, and letter spacing
 * based on quote character count to ensure quotes always fit on the shirt
 * 
 * The printable chest area on the mockup is approximately 36% of the image width
 * (from ~32% to ~68% horizontally), so font sizes are calibrated for this narrow zone
 */

interface ShirtTextStyles {
  fontSize: string;
  lineHeight: number;
  letterSpacing: string;
  authorFontSize: string;
}

/**
 * Calculate appropriate text styles for a quote based on its length
 * Font sizes are calibrated for a ~36% width printable area on the t-shirt chest
 * @param quoteText - The quote text to size
 * @param isStorePage - Whether this is for the larger Store page display
 * @returns CSS styles for the quote text
 */
export function getShirtQuoteStyles(quoteText: string, isStorePage: boolean = false): ShirtTextStyles {
  const charCount = quoteText.length;
  
  // Base multiplier for store page (larger container) vs archive page (smaller cards)
  // Reduced from 1.5 to 1.2 since we're now using a narrower print area
  const sizeMultiplier = isStorePage ? 1.2 : 1;
  
  // Font sizes reduced by ~50% to fit within the narrower printable chest area
  // Define breakpoints for different quote lengths
  
  // Very short quotes (under 40 chars) - largest font
  if (charCount < 40) {
    return {
      fontSize: `${0.55 * sizeMultiplier}rem`,
      lineHeight: 1.3,
      letterSpacing: '0.01em',
      authorFontSize: `${0.38 * sizeMultiplier}rem`,
    };
  }
  
  // Short quotes (40-80 chars)
  if (charCount < 80) {
    return {
      fontSize: `${0.48 * sizeMultiplier}rem`,
      lineHeight: 1.28,
      letterSpacing: '0.01em',
      authorFontSize: `${0.34 * sizeMultiplier}rem`,
    };
  }
  
  // Medium quotes (80-120 chars)
  if (charCount < 120) {
    return {
      fontSize: `${0.4 * sizeMultiplier}rem`,
      lineHeight: 1.25,
      letterSpacing: '0em',
      authorFontSize: `${0.3 * sizeMultiplier}rem`,
    };
  }
  
  // Long quotes (120-160 chars)
  if (charCount < 160) {
    return {
      fontSize: `${0.34 * sizeMultiplier}rem`,
      lineHeight: 1.22,
      letterSpacing: '0em',
      authorFontSize: `${0.26 * sizeMultiplier}rem`,
    };
  }
  
  // Very long quotes (160-220 chars)
  if (charCount < 220) {
    return {
      fontSize: `${0.28 * sizeMultiplier}rem`,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      authorFontSize: `${0.22 * sizeMultiplier}rem`,
    };
  }
  
  // Extra long quotes (220+ chars) - smallest readable font
  return {
    fontSize: `${0.24 * sizeMultiplier}rem`,
    lineHeight: 1.18,
    letterSpacing: '-0.01em',
    authorFontSize: `${0.2 * sizeMultiplier}rem`,
  };
}

/**
 * Get responsive QR code size based on author font size
 * @param authorFontSize - The author font size in rem
 * @param isStorePage - Whether this is for the larger Store page display
 * @returns Tailwind classes for QR code sizing
 */
export function getQRCodeClasses(isStorePage: boolean = false): string {
  if (isStorePage) {
    return 'h-4 w-4 md:h-5 md:w-5';
  }
  return 'h-2.5 w-2.5 md:h-3 md:w-3';
}
