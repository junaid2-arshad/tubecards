// GRE-style practice questions, written for this app. They are NOT official ETS questions.
// Formats mirror the Verbal Reasoning section:
//   tc1  Text completion, one blank, five choices
//   tc2  Text completion, two blanks, three choices each
//   se   Sentence equivalence, six choices, pick the TWO that give the sentence the same meaning
// Blanks are written [[1]] and [[2]]. Answers are stored as indexes into each blank's option list.

import { shuffle } from './srs.js';

const tc1 = (id, stem, options, answer, why, words) => ({ id, type: 'tc1', stem, blanks: [options], answer: [options.indexOf(answer)], why, words });
const se = (id, stem, options, answers, why, words) => ({ id, type: 'se', stem, blanks: [options], answer: answers.map((a) => options.indexOf(a)).sort((x, y) => x - y), why, words });
const tc2 = (id, stem, b1, b2, a1, a2, why, words) => ({ id, type: 'tc2', stem, blanks: [b1, b2], answer: [b1.indexOf(a1), b2.indexOf(a2)], why, words });

export const QUESTIONS = [
  // ---------- text completion, one blank ----------
  tc1('t01', 'Critics complained that the report was so [[1]] that even specialists struggled to follow its argument.', ['lucid', 'convoluted', 'gregarious', 'candid', 'frugal'], 'convoluted', 'Convoluted means extremely complicated. The clue is that specialists could not follow it. Lucid means clear, the opposite.', ['convoluted', 'lucid']),
  tc1('t02', 'The novelist\'s early success proved [[1]]: within two years her books were out of print and her name was forgotten.', ['ephemeral', 'durable', 'copious', 'eloquent', 'ardent'], 'ephemeral', 'Forgotten within two years means the success lasted a very short time, which is ephemeral.', ['ephemeral']),
  tc1('t03', 'Rather than [[1]] the dispute, the mediator\'s clumsy remarks inflamed it further.', ['mitigate', 'exacerbate', 'obfuscate', 'debunk', 'flout'], 'mitigate', '"Rather than" sets up a contrast with "inflamed it", so the blank must mean to calm or lessen: mitigate. Exacerbate would repeat the inflaming instead of contrasting with it.', ['mitigate', 'exacerbate']),
  tc1('t04', 'The scientist\'s findings were [[1]]: they could be read as supporting either theory, so neither camp could claim victory.', ['equivocal', 'cogent', 'candid', 'ardent', 'banal'], 'equivocal', 'Open to two readings is the definition of equivocal.', ['equivocal', 'cogent']),
  tc1('t05', 'Having lived on a small allowance for years, she had become so [[1]] that she still packed a lunch from home even after she became wealthy.', ['ostentatious', 'frugal', 'capricious', 'garrulous', 'impetuous'], 'frugal', 'Packing a lunch despite wealth shows careful spending habits, which is frugal. Ostentatious (showy) is the opposite.', ['frugal', 'ostentatious']),
  tc1('t06', 'Because the chief executive\'s warnings were deliberately [[1]], shareholders could not tell whether the company was in danger.', ['cryptic', 'candid', 'lucid', 'cogent', 'explicit'], 'cryptic', 'If shareholders could not tell, the warnings were puzzling or hidden in meaning: cryptic. The other choices would make the message clear.', ['cryptic', 'candid']),
  tc1('t07', 'The professor was known for his [[1]] lectures, so full of moral lessons that students felt they were being scolded.', ['didactic', 'eclectic', 'dormant', 'ebullient', 'mundane'], 'didactic', 'Didactic means meant to teach, often in a preachy way. "Moral lessons" and "scolded" are the clues.', ['didactic']),
  tc1('t08', 'Unlike his [[1]] brother, who loved crowds and parties, Tom preferred a quiet evening alone.', ['gregarious', 'ascetic', 'haughty', 'indolent', 'erudite'], 'gregarious', '"Unlike" and "loved crowds and parties" point to sociable: gregarious.', ['gregarious']),
  tc1('t09', 'Her [[1]] manner, bowing and flattering anyone with authority, earned her little respect from colleagues.', ['obsequious', 'magnanimous', 'dispassionate', 'intransigent', 'fastidious'], 'obsequious', 'Bowing and flattering the powerful is obsequious: excessively eager to please.', ['obsequious']),
  tc1('t10', 'The committee\'s decision seemed [[1]]: no clear principle explained why one proposal was funded and another rejected.', ['arbitrary', 'exemplary', 'cogent', 'benevolent', 'lucid'], 'arbitrary', 'No clear principle behind the choice means it was arbitrary. Cogent and lucid would suggest a clear reason.', ['arbitrary', 'cogent']),
  tc1('t11', 'The minister admitted that the new tax was no [[1]] for the budget deficit, since no single measure could solve it.', ['panacea', 'diatribe', 'anachronism', 'aberration', 'eulogy'], 'panacea', 'A panacea is a cure for all problems. "No single measure could solve it" is the clue.', ['panacea']),
  tc1('t12', 'Years of broken promises had bred such [[1]] that few residents bothered to vote.', ['apathy', 'alacrity', 'acumen', 'clemency', 'chicanery'], 'apathy', 'Not bothering to vote shows lack of interest: apathy. Alacrity is eager readiness, the opposite.', ['apathy', 'alacrity']),
  tc1('t13', 'Moved by the young offender\'s remorse, the judge showed unusual [[1]] and suspended the sentence.', ['clemency', 'acrimony', 'antipathy', 'diatribe', 'censure'], 'clemency', 'Suspending a sentence is an act of mercy: clemency. The other nouns are all negative.', ['clemency', 'acrimony', 'antipathy', 'censure']),
  tc1('t14', 'Her [[1]] for numbers, sharpened over thirty years in finance, allowed her to spot the flaw in the forecast within seconds.', ['acumen', 'apathy', 'deference', 'idiosyncrasy', 'antipathy'], 'acumen', 'Acumen is keen insight, here sharpened by experience.', ['acumen', 'apathy']),
  tc1('t15', 'Critics dismissed the film\'s [[1]] dialogue, full of phrases audiences had heard a thousand times before.', ['hackneyed', 'cogent', 'magnanimous', 'ebullient', 'lucid'], 'hackneyed', 'Phrases heard a thousand times are overused and unoriginal: hackneyed.', ['hackneyed']),
  tc1('t16', 'The volcano, [[1]] for three centuries, suddenly began to rumble, alarming the nearby villages.', ['dormant', 'burgeoning', 'ardent', 'fervent', 'copious'], 'dormant', 'Quiet for centuries and then suddenly active means it had been inactive: dormant.', ['dormant']),

  // ---------- sentence equivalence, pick two ----------
  se('s01', 'The mayor\'s [[1]] response to the crisis, a single curt sentence, disappointed residents who had hoped for reassurance.', ['laconic', 'terse', 'verbose', 'lucid', 'ardent', 'garrulous'], ['laconic', 'terse'], 'A single curt sentence is very brief. Laconic and terse both mean using few words. Verbose and garrulous mean the opposite.', ['laconic', 'garrulous']),
  se('s02', 'The critic\'s review was so [[1]] that the author, who had expected praise, was left wounded for weeks.', ['caustic', 'scathing', 'benevolent', 'ebullient', 'effusive', 'magnanimous'], ['caustic', 'scathing'], 'A review that wounds is harshly critical. Caustic and scathing are close synonyms. The other four are positive.', ['caustic']),
  se('s03', 'The mayor\'s attempts to [[1]] the angry crowd with promises of lower taxes only made things worse.', ['appease', 'placate', 'exacerbate', 'castigate', 'scrutinise', 'ratify'], ['appease', 'placate'], 'Calming someone with promises is appeasing or placating. Exacerbate and castigate do not fit "with promises".', ['appease', 'exacerbate', 'castigate']),
  se('s04', 'The elders were shocked by the [[1]] remarks of the newcomer, who openly mocked the village\'s most cherished customs.', ['derisive', 'scornful', 'reverent', 'deferential', 'benevolent', 'circumspect'], ['derisive', 'scornful'], 'Openly mocking means showing contempt: derisive and scornful. Reverent and deferential are opposites.', ['deride']),
  se('s05', 'Despite the [[1]] evidence against him, the suspect refused to confess.', ['cogent', 'compelling', 'equivocal', 'dubious', 'flimsy', 'ambiguous'], ['cogent', 'compelling'], '"Despite" signals that strong evidence did not make him confess. Cogent and compelling mean convincing. The other four describe weak or unclear evidence, which would not need "despite".', ['cogent', 'equivocal']),
  se('s06', 'The [[1]] monk renounced all comfort, sleeping on a bare floor and eating only bread.', ['ascetic', 'austere', 'hedonistic', 'indulgent', 'gregarious', 'ebullient'], ['ascetic', 'austere'], 'Giving up comfort describes severe self-discipline: ascetic and austere. Hedonistic and indulgent are opposites.', ['ascetic', 'austere']),
  se('s07', 'Her [[1]] reply gave nothing away; it could be read as either acceptance or refusal.', ['equivocal', 'ambiguous', 'forthright', 'candid', 'categorical', 'curt'], ['equivocal', 'ambiguous'], 'Open to two readings: equivocal and ambiguous. Forthright and candid mean direct and honest.', ['equivocal', 'candid']),
  se('s08', 'The senator was criticised for [[1]] the very rules that applied to everyone else.', ['flouting', 'defying', 'observing', 'upholding', 'drafting', 'citing'], ['flouting', 'defying'], 'Criticism fits openly disregarding the rules: flouting and defying. Observing and upholding would not be criticised.', ['flout']),
  se('s09', 'A [[1]] shopper, she compared prices in three stores before buying a pencil.', ['frugal', 'thrifty', 'extravagant', 'lavish', 'impulsive', 'ostentatious'], ['frugal', 'thrifty'], 'Comparing prices for a pencil shows careful spending: frugal and thrifty. Extravagant and lavish are opposites.', ['frugal']),
  se('s10', 'The [[1]] student never opened a book, spending his afternoons asleep on the sofa.', ['indolent', 'idle', 'diligent', 'assiduous', 'ardent', 'fastidious'], ['indolent', 'idle'], 'Never opening a book and sleeping all afternoon is laziness: indolent and idle. Diligent and assiduous mean hard-working.', ['indolent']),
  se('s11', 'Because the instructions were so [[1]], even experienced technicians could not understand them.', ['abstruse', 'arcane', 'lucid', 'straightforward', 'concise', 'candid'], ['abstruse', 'arcane'], 'Hard even for experts to understand: abstruse and arcane. Lucid and straightforward would make them easy.', ['abstruse', 'arcane', 'lucid']),
  se('s12', 'Her [[1]] speech, filled with grand but empty phrases, impressed no one.', ['bombastic', 'pompous', 'laconic', 'candid', 'cogent', 'pragmatic'], ['bombastic', 'pompous'], 'Grand but empty phrases are bombastic or pompous. Laconic is the opposite: using few words.', ['bombastic']),
  se('s13', 'Adopting a [[1]] approach to the budget, the manager focused on what could actually be achieved with the money available.', ['pragmatic', 'practical', 'idealistic', 'utopian', 'capricious', 'impetuous'], ['pragmatic', 'practical'], 'Focusing on what can actually be achieved is realistic: pragmatic and practical. Idealistic and utopian are the opposite.', ['pragmatic']),
  se('s14', 'The prince was [[1]] in victory, forgiving his enemies and sparing their lands.', ['magnanimous', 'generous', 'vindictive', 'spiteful', 'haughty', 'arrogant'], ['magnanimous', 'generous'], 'Forgiving and sparing enemies is generous in spirit: magnanimous and generous. Vindictive and spiteful are opposites.', ['magnanimous']),
  se('s15', 'The [[1]] economy of the 1990s saw new companies spring up in every city.', ['burgeoning', 'flourishing', 'stagnant', 'declining', 'dormant', 'moribund'], ['burgeoning', 'flourishing'], 'New companies springing up means rapid growth: burgeoning and flourishing.', ['burgeon', 'dormant']),
  se('s16', 'His [[1]] nature led him to quit the job on a whim, without a thought for the consequences.', ['impetuous', 'rash', 'deliberate', 'cautious', 'circumspect', 'prudent'], ['impetuous', 'rash'], 'Acting on a whim without thinking is impetuous or rash. Circumspect, cautious and prudent mean careful.', ['impetuous', 'circumspect']),

  // ---------- text completion, two blanks ----------
  tc2('d01', 'The new director was widely expected to be [[1]], quick to punish mistakes, but she proved surprisingly [[2]], forgiving the interns\' errors and encouraging them to try again.', ['austere', 'effusive', 'garrulous'], ['obsequious', 'magnanimous', 'dormant'], 'austere', 'magnanimous', 'Quick to punish suggests austere (strict). "But ... forgiving" points to magnanimous (generous in forgiving).', ['austere', 'magnanimous']),
  tc2('d02', 'Although the lecture was meant to be [[1]], aimed at beginners, the speaker kept drifting into [[2]] details that only a handful of experts could follow.', ['accessible', 'esoteric', 'cursory'], ['arcane', 'mundane', 'lucid'], 'accessible', 'arcane', '"Aimed at beginners" gives accessible. Details that only experts could follow are arcane.', ['arcane', 'esoteric']),
  tc2('d03', 'The company\'s [[1]] attitude toward safety, ignoring warnings and cutting corners, eventually led to a [[2]] accident.', ['complacent', 'fastidious', 'benevolent'], ['fortuitous', 'catastrophic', 'ephemeral'], 'complacent', 'catastrophic', 'Ignoring warnings shows smug carelessness: complacent. That leads to a disastrous accident, not a lucky one.', ['complacent', 'fastidious']),
  tc2('d04', 'Far from being [[1]], the diplomat\'s remarks were deliberately [[2]], designed to leave listeners unsure of his true position.', ['candid', 'cryptic', 'caustic'], ['equivocal', 'forthright', 'effusive'], 'candid', 'equivocal', 'Designed to leave listeners unsure means deliberately vague: equivocal. "Far from being" then needs the opposite, candid (frank).', ['candid', 'equivocal']),
  tc2('d05', 'The critics, once [[1]] in their praise of the author, grew [[2]] after her third novel, which they dismissed as repetitive and dull.', ['ardent', 'dormant', 'insipid'], ['caustic', 'magnanimous', 'ebullient'], 'ardent', 'caustic', 'A contrast: passionate praise first (ardent), then sharp criticism (caustic).', ['ardent', 'caustic']),
  tc2('d06', 'Because the evidence was [[1]], the jury struggled to reach a verdict; each side offered a [[2]] account, and neither seemed more credible than the other.', ['conclusive', 'equivocal', 'banal'], ['plausible', 'preposterous', 'perfunctory'], 'equivocal', 'plausible', 'The jury struggled, so the evidence did not settle things: equivocal. If neither account seemed more credible, both were believable: plausible.', ['equivocal']),
];

// ---------- helpers ----------
export const TYPE_LABEL = {
  tc1: 'Text completion, one blank',
  tc2: 'Text completion, two blanks',
  se: 'Sentence equivalence: pick the two answers that give the sentence the same meaning',
};

// Correct means every blank is right (for 'se', both chosen words are right).
export function isCorrect(q, selection) {
  if (q.type === 'se') {
    const s = [...selection].sort((a, b) => a - b);
    return s.length === q.answer.length && s.every((v, i) => v === q.answer[i]);
  }
  return q.answer.length === selection.length && q.answer.every((v, i) => v === selection[i]);
}

export function questionWords(q) {
  return q.words || [];
}

// history: Map(questionId -> { seen, wrong })  Unseen first, then the ones you got wrong most, then the rest.
export function pickQuestions(bank, history, n, rng = Math.random) {
  const rank = (q) => {
    const h = history.get(q.id);
    if (!h) return 0;
    return h.wrong > 0 ? 1 : 2;
  };
  const buckets = [[], [], []];
  for (const q of shuffle(bank, rng)) buckets[rank(q)].push(q);
  buckets[1].sort((a, b) => history.get(b.id).wrong - history.get(a.id).wrong);
  buckets[2].sort((a, b) => history.get(a.id).seen - history.get(b.id).seen);
  const picked = [...buckets[0], ...buckets[1], ...buckets[2]].slice(0, n);
  return shuffle(picked, rng);
}

// Split a stem on its [[n]] markers: ['text', 1, 'text', 2, 'text']
export function stemParts(stem) {
  return stem.split(/\[\[(\d)\]\]/).map((p, i) => (i % 2 ? Number(p) : p));
}
