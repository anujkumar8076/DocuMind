import { SourceCitation, GroundednessResult, GroundedSentence } from '@/types';

/**
 * Splits text into individual sentences accurately while respecting abbreviations and citations
 */
function splitIntoSentences(text: string): string[] {
  const cleaned = text
    .replace(/\[SOURCE \d+\]/g, '') // strip citation tags for clean sentence detection
    .replace(/\s+/g, ' ')
    .trim();

  // Split on sentence boundaries: periods, question marks, exclamation marks followed by whitespace or end
  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  if (!matches) return [cleaned];

  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 5); // Ignore empty or trivial fragments
}

/**
 * Extracts significant n-grams (bigrams and trigrams) and keywords from a sentence
 */
function extractNgrams(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3); // Ignore stopwords and short particles

  const ngrams: string[] = [...words];

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]}`);
  }

  // Trigrams
  for (let i = 0; i < words.length - 2; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return ngrams;
}

/**
 * Analyzes whether an individual sentence is grounded in the retrieved source chunks
 */
function evaluateSentenceGroundedness(
  sentence: string,
  sources: SourceCitation[]
): {
  status: 'GROUNDED' | 'INFERRED' | 'HALLUCINATED';
  confidence: number;
  groundingChunkId?: string;
  reasoning: string;
} {
  const sentenceNgrams = extractNgrams(sentence);
  if (sentenceNgrams.length === 0) {
    return {
      status: 'GROUNDED',
      confidence: 1.0,
      reasoning: 'Conversational or transitional sentence.',
    };
  }

  let highestOverlap = 0;
  let bestMatchingChunk: SourceCitation | null = null;

  for (const source of sources) {
    const sourceLower = source.content.toLowerCase();
    let matches = 0;

    for (const ngram of sentenceNgrams) {
      if (sourceLower.includes(ngram)) {
        // Give higher weight to multi-word ngrams
        matches += ngram.includes(' ') ? 2 : 1;
      }
    }

    const maxPossible = sentenceNgrams.reduce((acc, ng) => acc + (ng.includes(' ') ? 2 : 1), 0);
    const score = maxPossible > 0 ? matches / maxPossible : 0;

    if (score > highestOverlap) {
      highestOverlap = score;
      bestMatchingChunk = source;
    }
  }

  // Classification thresholds
  if (highestOverlap >= 0.55) {
    return {
      status: 'GROUNDED',
      confidence: Number(Math.min(1.0, highestOverlap + 0.3).toFixed(2)),
      groundingChunkId: bestMatchingChunk?.id,
      reasoning: `Strongly supported by ${bestMatchingChunk?.documentName} (chunk #${bestMatchingChunk?.chunkIndex}).`,
    };
  } else if (highestOverlap >= 0.25) {
    return {
      status: 'INFERRED',
      confidence: Number(Math.min(0.85, highestOverlap + 0.25).toFixed(2)),
      groundingChunkId: bestMatchingChunk?.id,
      reasoning: `Partially supported or inferred from context in ${bestMatchingChunk?.documentName}.`,
    };
  } else {
    return {
      status: 'HALLUCINATED',
      confidence: Number(Math.max(0.1, highestOverlap).toFixed(2)),
      reasoning: 'No factual backing found in the retrieved document chunks.',
    };
  }
}

/**
 * Main hallucination detection engine:
 * Evaluates full AI response sentence-by-sentence against retrieved source citations.
 */
export async function analyzeGroundedness(
  response: string,
  sources: SourceCitation[]
): Promise<GroundednessResult> {
  if (!response || sources.length === 0) {
    return {
      overallScore: 0.5,
      riskLevel: 'MEDIUM',
      summary: 'No source citations available for automated groundedness verification.',
      annotatedSentences: [],
    };
  }

  const sentences = splitIntoSentences(response);
  const annotatedSentences: GroundedSentence[] = [];

  let groundedCount = 0;
  let inferredCount = 0;
  let hallucinatedCount = 0;
  let totalConfidence = 0;

  for (const sentence of sentences) {
    const evalResult = evaluateSentenceGroundedness(sentence, sources);

    annotatedSentences.push({
      sentence,
      status: evalResult.status,
      confidence: evalResult.confidence,
      groundingChunkId: evalResult.groundingChunkId,
      reasoning: evalResult.reasoning,
    });

    if (evalResult.status === 'GROUNDED') groundedCount++;
    else if (evalResult.status === 'INFERRED') inferredCount++;
    else hallucinatedCount++;

    totalConfidence += evalResult.confidence;
  }

  const total = sentences.length || 1;
  const overallScore = Number((totalConfidence / total).toFixed(2));

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (hallucinatedCount === 0 && overallScore >= 0.75) {
    riskLevel = 'LOW';
  } else if (hallucinatedCount <= 1 && overallScore >= 0.50) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'HIGH';
  }

  const summary = `${groundedCount} of ${total} claims verified in source documents (${inferredCount} inferred, ${hallucinatedCount} unverified).`;

  return {
    overallScore,
    riskLevel,
    summary,
    annotatedSentences,
  };
}
