// Textdiät (Feedback-Auftrag 1.3): Story höchstens 2 Sätze, Auftrag höchstens 3 Zeilen (≈ 210 Zeichen Fliesstext, Codeblöcke zählen nicht).
// Von validate.js, validate_kop.js und validate_awl.js genutzt; Verstösse sind Warnungen, mit --strict-text Fehler.
const STORY_MAX = 2, BRIEF_MAX = 210;
const plain = h => String(h || '').replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
function sentences(h){
  const t = plain(String(h || '').replace(/<code[^>]*>[\s\S]*?<\/code>/g, 'X')).replace(/\b(z|d|u|o|s)\.\s?([BhaAÄ])\./g, '$1$2').replace(/\b(bzw|ca|evtl|inkl|max|min|Nr|usw|etc|vgl|Std|Min|resp|gem|ggf)\./gi, '$1').replace(/(\d)\.(\d)/g, '$1,$2').replace(/\.{3}/g, '…');
  // Satzende: . ! ? … vor Leerraum oder Textende (Punkte in Code wie Z_Achsen.CV oder [1..4] zählen nicht)
  return t.split(/(?<=[.!?…]["“”»«']?)\s+(?=\S)/).filter(s => s.replace(/["“”»«'\s]/g, '').length > 2).length;
}
function check(t){
  const out = [];
  const s = sentences(t.story); if(s > STORY_MAX) out.push('Story hat ' + s + ' Sätze (höchstens ' + STORY_MAX + ')');
  const b = plain(t.briefing).length; if(b > BRIEF_MAX) out.push('Auftrag hat ' + b + ' Zeichen (höchstens ' + BRIEF_MAX + ' ≈ 3 Zeilen)');
  return out;
}
module.exports = { check, sentences, plain, STORY_MAX, BRIEF_MAX };
