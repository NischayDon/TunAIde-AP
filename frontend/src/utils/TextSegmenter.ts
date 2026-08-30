export interface TextSegment {
  text: string;
  isBlank: boolean;
}

export const segmentText = (text: string): TextSegment[] => {
  if (!text) return [];

  // Split by newlines to preserve paragraphs.
  const paragraphs = text.split(/\n/);
  const segments: TextSegment[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      if (segments.length === 0 || !segments[segments.length - 1].isBlank) {
        segments.push({ text: " ", isBlank: true });
      }
      continue;
    }

    // Split sentences by punctuation
    const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [paragraph];

    for (let sentence of sentences) {
      sentence = sentence.trim();
      if (!sentence) continue;

      const words = sentence.split(/\s+/);
      const TARGET_WORDS = 15;

      if (words.length <= TARGET_WORDS + 5) { // Allowing slightly longer sentences
        segments.push({ text: sentence, isBlank: false });
      } else {
        // Split sentence at natural boundaries (comma, colon, semicolon, hyphens)
        let chunk = "";
        let chunkWords = 0;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          chunk += (chunk ? " " : "") + word;
          chunkWords++;

          const isNaturalBoundary = word.endsWith(',') || word.endsWith(';') || word.endsWith(':') || word.endsWith('-');
          const isAtTarget = chunkWords >= TARGET_WORDS;
          
          if ((isNaturalBoundary && chunkWords > 5) || (isAtTarget && !isNaturalBoundary) || i === words.length - 1) {
            segments.push({ text: chunk.trim(), isBlank: false });
            chunk = "";
            chunkWords = 0;
          }
        }
      }
    }
  }
  return segments;
};
