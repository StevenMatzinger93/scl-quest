// Textdiät (docs/AUFTRAG_FEEDBACK1.md Paket 1.3): Geschichte max. 2 Sätze, Auftrag max. ca. 3 Zeilen.
// Die Validatoren rufen check(C.tasks, warn) auf; ohne --diet steht nur eine Sammelwarnung, mit --diet jede Aufgabe einzeln.
const plain = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, 'x');
const sentences = h => plain(h).split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"«])/).filter(Boolean).length;
const LIMIT = { storySentences: 2, storyChars: 280, briefChars: 300 };
function check(tasks, warn){
  const long = [], big = [];
  tasks.forEach(t => {
    if(t.story && (sentences(t.story) > LIMIT.storySentences || plain(t.story).length > LIMIT.storyChars)) long.push(t.id);
    if(t.briefing && plain(t.briefing).length > LIMIT.briefChars) big.push(t.id);
  });
  if(process.argv.includes('--diet')){
    long.forEach(id => warn(id, 'Textdiät: Geschichte länger als ' + LIMIT.storySentences + ' Sätze bzw. ' + LIMIT.storyChars + ' Zeichen'));
    big.forEach(id => warn(id, 'Textdiät: Auftrag länger als ' + LIMIT.briefChars + ' Zeichen (ca. 3 Zeilen)'));
  } else if(long.length || big.length){
    warn('textdiet', long.length + ' Geschichten > ' + LIMIT.storySentences + ' Sätze, ' + big.length + ' Aufträge > ' + LIMIT.briefChars + ' Zeichen (Einzelheiten: --diet)');
  }
  return { long, big };
}
module.exports = { check, LIMIT, plain, sentences };
