// Profanity filter for user-generated content that OTHER people see
// (usernames, bios, messages). Normalizes accents and common leetspeak so
// trivial spellings don't slip through. Deliberately conservative — it censors
// slurs and heavy profanity, not mild slang.

const WORDS = [
  // pt-br
  'arrombado', 'arrombada', 'boquete', 'bosta', 'buceta', 'caralho', 'cacete',
  'canalha', 'corno', 'cuzao', 'cuzão', 'desgraça', 'desgraca', 'fdp', 'foda',
  'fodase', 'foder', 'fudido', 'fudida', 'krl', 'macaco', 'merda', 'pau no cu',
  'piranha', 'porra', 'puta', 'puto', 'vadia', 'vagabunda', 'viado', 'vsf',
  'xereca', 'pinto', 'rola',
  // en
  'asshole', 'bastard', 'bitch', 'cock', 'cunt', 'dick', 'faggot', 'fuck',
  'motherfucker', 'nigga', 'nigger', 'pussy', 'retard', 'shit', 'slut', 'whore',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

function normalize(text: string): string {
  let out = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  out = out.replace(/[013457@$]/g, (c) => LEET[c] ?? c);
  return out;
}

export function hasProfanity(text: string): boolean {
  const norm = normalize(text);
  const squished = norm.replace(/[^a-z]/g, '');
  return WORDS.some((w) => {
    const wNorm = normalize(w);
    return norm.includes(wNorm) || squished.includes(wNorm.replace(/[^a-z]/g, ''));
  });
}

/** Replaces each offending word with asterisks, keeping the rest intact. */
export function cleanProfanity(text: string): string {
  let out = text;
  for (const w of WORDS) {
    // rebuild a loose regex from the normalized word: letters may carry
    // accents/leet in the original — match case-insensitively on the raw word
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(esc, 'gi'), (m) => '*'.repeat(m.length));
  }
  // second pass over normalized view for accented/leet variants
  if (hasProfanity(out)) {
    const words = out.split(/(\s+)/);
    out = words
      .map((tok) => (/\S/.test(tok) && hasProfanity(tok) ? '*'.repeat(tok.length) : tok))
      .join('');
  }
  return out;
}
