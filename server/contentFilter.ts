// Content filter for blocking slurs and derogatory terms
// Regular swearing is allowed - only hateful/derogatory terms are blocked

const BLOCKED_TERMS = [
  // Racial slurs
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga',
  'spic', 'sp1c', 'wetback', 'beaner',
  'chink', 'ch1nk', 'gook', 'g00k',
  'kike', 'k1ke',
  'towelhead', 'raghead', 'sandnigger',
  'coon', 'c00n', 'darkie',
  'cracker', 'honky',
  'redskin', 'injun',
  
  // Anti-LGBTQ slurs
  'faggot', 'fag', 'f4ggot', 'f4g', 'fagg0t',
  'dyke', 'dyk3',
  'tranny', 'tr4nny', 'shemale',
  
  // Ableist slurs
  'retard', 'retarded', 'r3tard', 'r3t4rd',
  'tard', 't4rd',
  
  // Other derogatory terms
  'nazi', 'n4zi',
  'whore', 'wh0re',
  'slut', 'sl0t',
];

// Check if text contains any blocked terms (case-insensitive)
export function containsBlockedContent(text: string): { blocked: boolean; reason?: string } {
  const lowerText = text.toLowerCase();
  
  // Remove common substitutions to catch evasion attempts
  const normalizedText = lowerText
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');
  
  for (const term of BLOCKED_TERMS) {
    // Check both original and normalized text
    // Use word boundary check to avoid false positives
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lowerText) || regex.test(normalizedText)) {
      return { 
        blocked: true, 
        reason: 'Your quote contains language that violates our community guidelines. Hateful slurs and derogatory terms are not allowed.' 
      };
    }
  }
  
  return { blocked: false };
}
