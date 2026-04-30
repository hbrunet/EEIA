export function cleanLookupToken(token: string): string {
  return token
    .replace(/^[^a-zA-Z0-9']+/, "")
    .replace(/[^a-zA-Z0-9']+$/, "")
    .trim();
}

const SPANISH_STOPWORDS = new Set([
  "a","al","algo","alguien","algún","alguno","algunos","alguna","algunas",
  "ante","antes","aunque","bien","bueno","cada","como","con","cual",
  "cuando","de","del","donde","durante","él","ella","ellos","ellas",
  "en","entre","eres","es","eso","esos","esta","está","estás","están",
  "este","estos","fue","hay","hacia","hasta","le","les","lo","los",
  "la","las","me","mi","muy","más","ni","no","nos","nosotros",
  "nuestro","nuestra","o","os","para","pero","por","porque","que",
  "quién","se","ser","si","sin","sobre","son","su","sus","también",
  "te","tengo","tiene","tienen","todo","todos","tu","tú","un","una",
  "unas","unos","vos","y","ya","yo",
]);

export function isLikelySpanish(token: string): boolean {
  if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(token)) return true;
  return SPANISH_STOPWORDS.has(token.toLowerCase());
}
