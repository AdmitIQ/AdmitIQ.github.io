// Plain-language glossary of admissions and financial-aid terms (general definitions; specific
// policies vary by college — always check the school's own site).
export interface Term { term: string; aliases?: string[]; short: string; detail?: string; category: 'Applying' | 'Testing' | 'Admissions data' | 'Paying' | 'Loans' | 'Decisions' }

export const GLOSSARY: Term[] = [
  { term: 'Early Decision (ED)', aliases: ['early decision', 'ed'], category: 'Applying', short: 'An early application round that is binding: if you are admitted, you agree to attend and withdraw your other applications.', detail: 'Deadlines are usually in November. You can apply ED to only one college. Because you commit before comparing financial aid offers, run the net price calculator first. Most schools release you from the commitment only if the aid offered makes attending financially impossible.' },
  { term: 'Early Decision II (ED2)', aliases: ['ed2', 'early decision 2', 'early decision two'], category: 'Applying', short: 'A second binding early round with a later deadline (often early January).', detail: 'Useful if you were deferred or denied in ED elsewhere, or decided on a first choice later.' },
  { term: 'Early Action (EA)', aliases: ['early action', 'ea'], category: 'Applying', short: 'An early round that is not binding: you apply early, hear back early, and can still compare offers until May 1.', detail: 'You can usually apply EA to as many colleges as you like.' },
  { term: 'Restrictive Early Action (REA)', aliases: ['restrictive early action', 'single choice early action', 'rea', 'scea'], category: 'Applying', short: 'Non-binding early action that limits applying early to other (usually private) colleges.', detail: 'Used by a few highly selective schools. Read each policy: public universities and binding rules differ.' },
  { term: 'Regular Decision (RD)', aliases: ['regular decision', 'rd'], category: 'Applying', short: 'The standard application round, with deadlines mostly in January and decisions by early April.' },
  { term: 'Rolling admission', aliases: ['rolling', 'rolling admissions'], category: 'Applying', short: 'Applications are reviewed as they arrive, and decisions go out on a continuous basis until the class is full.', detail: 'Applying early in the cycle usually helps, especially for merit scholarships and housing.' },
  { term: 'Common App', aliases: ['common application', 'common app'], category: 'Applying', short: 'A single online application accepted by over a thousand colleges, with one personal essay and an activities list of up to 10 entries.' },
  { term: 'Supplemental essays', aliases: ['supplements', 'supplemental essay', 'supplement'], category: 'Applying', short: 'Extra, college-specific questions — often "Why us?" or "Why this major?" — on top of the main personal statement.' },
  { term: 'Demonstrated interest', aliases: ['demonstrated interest'], category: 'Applying', short: 'Signals that you are genuinely interested in a college (visits, info sessions, opening emails). Some colleges consider it; many say they do not.', detail: 'Each college reports whether it considers this in its Common Data Set, section C7.' },
  { term: 'Holistic review', aliases: ['holistic', 'holistic admissions'], category: 'Admissions data', short: 'Admissions reviews the whole application — grades, rigor, essays, activities, recommendations and context — rather than a formula.' },
  { term: 'Direct admit', aliases: ['direct admission', 'direct admit'], category: 'Admissions data', short: 'Admission straight into a specific major or school within a university. Competitive majors may have separate, lower admit rates.' },
  { term: 'Test-optional', aliases: ['test optional'], category: 'Testing', short: 'You choose whether to send SAT/ACT scores. Applicants without scores are reviewed without penalty, according to the college.' },
  { term: 'Test-free (test-blind)', aliases: ['test blind', 'test-blind', 'test free'], category: 'Testing', short: 'The college does not look at SAT/ACT scores at all, even if you send them. The University of California campuses are an example.' },
  { term: 'Superscore', aliases: ['superscoring', 'super score'], category: 'Testing', short: 'Combining your best section scores from different test dates into one highest total. Policies vary by college.' },
  { term: 'Middle 50%', aliases: ['middle 50', 'middle fifty', '25th percentile', '75th percentile'], category: 'Admissions data', short: 'The range between the 25th and 75th percentile of scores (or GPAs) of admitted or enrolled students. A quarter scored below the range and a quarter above.' },
  { term: 'Acceptance rate', aliases: ['admit rate', 'admission rate', 'acceptance rate'], category: 'Admissions data', short: 'Admitted applicants divided by total applicants. It describes the whole pool, not your individual chance.' },
  { term: 'Yield', aliases: ['yield rate'], category: 'Admissions data', short: 'The share of admitted students who choose to enroll.' },
  { term: 'Common Data Set (CDS)', aliases: ['common data set', 'cds'], category: 'Admissions data', short: 'A standard report many colleges publish each year with admissions, test score, enrollment and aid statistics in the same format.' },
  { term: 'Weighted GPA', aliases: ['weighted gpa'], category: 'Admissions data', short: 'A GPA that adds extra points for honors, AP, IB or dual-enrollment courses. Scales differ by school.' },
  { term: 'Unweighted GPA', aliases: ['unweighted gpa'], category: 'Admissions data', short: 'A GPA on a 4.0 scale that ignores course difficulty.' },
  { term: 'Course rigor', aliases: ['rigor'], category: 'Admissions data', short: 'How challenging your classes are relative to what your high school offers. Your counselor typically describes this in their report.' },
  { term: 'Legacy', aliases: ['legacy admission'], category: 'Admissions data', short: 'Applicants whose parent (or relative) attended the college. Some colleges consider it; a growing number do not.' },
  { term: 'Deferral', aliases: ['deferred', 'deferral'], category: 'Decisions', short: 'An early applicant is neither admitted nor denied and is moved to the regular round for another review.', detail: 'A brief, specific update letter with new achievements (if the college allows one) is the usual next step.' },
  { term: 'Waitlist', aliases: ['waitlisted', 'wait list'], category: 'Decisions', short: 'You may be offered a spot later if space opens. Deposit at another college by May 1 while you wait.' },
  { term: 'May 1 (National Decision Day)', aliases: ['decision day', 'may 1'], category: 'Decisions', short: 'The usual deadline to accept one college\'s offer and pay a deposit.' },
  { term: 'Cost of attendance (COA)', aliases: ['cost of attendance', 'coa', 'sticker price'], category: 'Paying', short: 'A college\'s full estimated yearly cost: tuition and fees, housing, food, books, transportation and personal expenses. Often called the sticker price.' },
  { term: 'Net price', aliases: ['net price', 'net cost'], category: 'Paying', short: 'Cost of attendance minus grants and scholarships (free money). It is what you would actually pay or borrow.' },
  { term: 'Net price calculator', aliases: ['npc', 'net price calculator'], category: 'Paying', short: 'A tool every U.S. college must provide that estimates your net price from your family\'s finances.' },
  { term: 'FAFSA', aliases: ['fafsa', 'free application for federal student aid'], category: 'Paying', short: 'The free federal form used for Pell Grants, federal loans, work-study and most state and college need-based aid.' },
  { term: 'Student Aid Index (SAI)', aliases: ['sai', 'student aid index', 'efc', 'expected family contribution'], category: 'Paying', short: 'The number the FAFSA calculates to measure your family\'s ability to pay. It replaced the Expected Family Contribution (EFC).' },
  { term: 'CSS Profile', aliases: ['css profile', 'css'], category: 'Paying', short: 'An additional financial aid form, run by the College Board, that many private colleges use for their own grants. It usually has a fee, with waivers available.' },
  { term: 'Pell Grant', aliases: ['pell', 'pell grant'], category: 'Paying', short: 'A federal grant for students with financial need. It does not need to be repaid.' },
  { term: 'Need-based aid', aliases: ['need based aid', 'need-based'], category: 'Paying', short: 'Aid based on your family\'s finances, determined from the FAFSA (and sometimes the CSS Profile).' },
  { term: 'Merit aid', aliases: ['merit scholarship', 'merit scholarships', 'merit aid'], category: 'Paying', short: 'Scholarships based on achievement rather than need. Some are automatic; others need a separate application or an early deadline.' },
  { term: 'Meets full need', aliases: ['full need', 'meets 100% of need'], category: 'Paying', short: 'The college says it covers the difference between its cost and what your family is expected to pay — though that may include loans and work-study.' },
  { term: 'Gapping', aliases: ['gap', 'unmet need', 'gapping'], category: 'Paying', short: 'When an aid offer leaves part of your demonstrated need uncovered, so your family must find the difference.' },
  { term: 'Work-study', aliases: ['work study', 'federal work-study'], category: 'Paying', short: 'Money you can earn through a part-time job, usually on campus. It is paid as you work, not subtracted from your bill up front.' },
  { term: 'Award letter', aliases: ['aid offer', 'financial aid offer', 'award letter'], category: 'Paying', short: 'The letter showing a college\'s financial aid offer. Compare offers by separating free money from loans and work-study.' },
  { term: 'Subsidized loan', aliases: ['subsidized loan', 'direct subsidized'], category: 'Loans', short: 'A federal student loan for students with need where the government pays the interest while you are in school at least half-time.' },
  { term: 'Unsubsidized loan', aliases: ['unsubsidized loan', 'direct unsubsidized'], category: 'Loans', short: 'A federal student loan available regardless of need; interest starts accruing right away.' },
  { term: 'Parent PLUS loan', aliases: ['parent plus', 'plus loan'], category: 'Loans', short: 'A federal loan your parent takes out in their own name. It has higher interest and fees than student loans and is not aid in the sense of free money.' },
  { term: 'College Scorecard', aliases: ['scorecard', 'college scorecard'], category: 'Admissions data', short: 'The U.S. Department of Education\'s official site and API with costs, graduation rates, debt and earnings for U.S. colleges.' },
];

export function findTerm(q: string): Term | undefined {
  const s = q.toLowerCase().replace(/[^a-z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();
  let best: { t: Term; len: number } | undefined;
  for (const t of GLOSSARY) {
    for (const a of [t.term.toLowerCase().replace(/\(.*?\)/g, '').trim(), ...(t.aliases || [])]) {
      if (a.length <= 3 ? new RegExp(`\\b${a}\\b`).test(s) : s.includes(a)) if (!best || a.length > best.len) best = { t, len: a.length };
    }
  }
  return best?.t;
}
