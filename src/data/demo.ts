// DEMO DATA — a fictional student used to explore AdmitIQ. Not a real person, not real results.
import { emptyState, uid } from '../lib/store';
import type { AppState, Course } from '../lib/types';

const course = (name: string, year: number, level: Course['level'], subject: Course['subject'], grade: Course['grade'], term: Course['term'] = 'Full year'): Course =>
  ({ id: uid(), name, year, term, level, subject, grade, credits: term === 'Full year' ? 1 : 0.5 });

const DRAFT1 = `Ever since I was a child, I have always been passionate about computers. In today's society technology is very important and i want to make a difference.

My grandmother runs a small tailoring shop in Durham. Every Saturday I helped her, and every Saturday the same thing happened: customers called, she wrote orders in a spiral notebook, and some of the orders got lost. It was really frustrating for her and also for the customers.

In tenth grade I decided to build her an app. I didnt know how to code very well. I watched tutorials and failed alot. The first version crashed every time she pressed the back button. She was nervous to use it because she thought she would break it.

Additionally, I learned a lot about patience. I had to explain things slowly and I realized that the problem was not the code, it was that I designed it for me and not for her. I rebuilt the screens with big buttons and a single list of orders sorted by pickup date.

In conclusion, this experience was life-changing and it taught me that hard work pays off.`;

const DRAFT2 = `The order for Mr. Okafor's wedding suit was written on the back of a receipt, and by Saturday the receipt was gone.

My grandmother has run a tailoring shop in Durham for twenty-two years. She keeps orders in a spiral notebook, takes calls with a pin between her lips, and remembers almost everything. Almost. When I started helping on Saturdays in ninth grade, I counted three lost orders in a single month, and I watched her apologize for each one as if she had personally failed.

In tenth grade I decided to fix it. I barely knew how to code. My first app crashed every time she pressed the back button, and she stopped touching it. "I'll break it," she said, sliding the notebook back across the counter.

That sentence bothered me for weeks. I had built the app for someone like me: small icons, menus inside menus, settings she would never need. So I sat beside her for two Saturdays and wrote down everything she did instead of everything I wanted to add. She never searched for an order; she looked for whatever was due next. The new version has one screen: a list sorted by pickup date, buttons the size of a thumb, and a "call customer" link beside every name.

She has used it for fourteen months. We have not lost an order since March of last year, and she now tells customers to "check the computer" with a confidence I did not expect.

I still love writing code, but I have stopped thinking of software as the point. The point was the receipt on the floor and the apology she did not owe anyone. Now, before I build anything, I ask who will be holding it, and I watch them first.`;

export function demoState(): AppState {
  const s = emptyState();
  s.meta.demo = true; s.meta.onboarded = true;
  s.profile = {
    ...s.profile, name: 'Jordan Rivera (demo)', highSchool: 'Example Public High School', city: 'Durham', state: 'NC', gradYear: 2027,
    gpaUnweighted: 3.86, gpaWeighted: 4.42, gpaScale: '4.0', classRank: 18, classSize: 410, intendedMajor: 'Computer Science', altMajors: ['Data Science', 'Mathematics'],
    testingStatus: 'Tested', sat: { total: 1480, rw: 720, math: 760, date: '2026-08-23' }, act: { ...s.profile.act },
    plannedTests: 'AP Computer Science A, AP Calculus BC exams (May 2027)', trend: 'Upward',
    awards: [
      { id: uid(), title: 'AP Scholar with Distinction', level: 'National', grades: [11] },
      { id: uid(), title: 'Regional Science Fair — 2nd place, Software category', level: 'Regional', grades: [10] },
    ],
  };
  s.personal = { ...s.personal, career: 'Software engineer building tools for small businesses', academicInterests: 'Human-computer interaction, algorithms, statistics', personalInterests: 'Cooking, cycling, fixing old phones', settings: ['Urban', 'Small city'], regions: ['South', 'Northeast', 'Midwest'], size: 'Large (15k+)', maxDistance: 900, kinds: ['Public', 'Private'], wantsResearch: true, wantsInternships: true, careerPriorities: 'Co-op or internship access; manageable debt', learning: 'Project-based classes, smaller discussion sections' };
  s.financial = { ...s.financial, shareFinancials: true, incomeBracket: '$75–110k', maxAnnualCost: 30000, expectedContribution: 18000, aidPriority: 'Very important', meritPreference: true, loanWillingness: 'Federal loans only' };
  s.courses = [
    course('English 9 Honors', 9, 'Honors', 'English', 'A'), course('Geometry Honors', 9, 'Honors', 'Math', 'A-'), course('Biology Honors', 9, 'Honors', 'Science', 'B+'),
    course('World History', 9, 'Regular', 'Social Studies', 'A'), course('Spanish II', 9, 'Regular', 'World Language', 'B+'), course('Intro to Programming', 9, 'Regular', 'Elective', 'A', 'Semester 1'), course('Digital Art', 9, 'Regular', 'Arts', 'A', 'Semester 2'),
    course('English 10 Honors', 10, 'Honors', 'English', 'A-'), course('Algebra II Honors', 10, 'Honors', 'Math', 'A'), course('Chemistry Honors', 10, 'Honors', 'Science', 'B+'),
    course('AP World History', 10, 'AP', 'Social Studies', 'A-'), course('Spanish III', 10, 'Regular', 'World Language', 'A-'), course('AP Computer Science Principles', 10, 'AP', 'Elective', 'A'),
    course('AP English Language', 11, 'AP', 'English', 'A'), course('AP Precalculus', 11, 'AP', 'Math', 'A'), course('AP Physics 1', 11, 'AP', 'Science', 'A-'),
    course('AP U.S. History', 11, 'AP', 'Social Studies', 'A'), course('Spanish IV Honors', 11, 'Honors', 'World Language', 'A'), course('AP Statistics', 11, 'AP', 'Math', 'A'),
  ];
  s.activities = [
    { id: uid(), category: 'Computer/Technology', org: 'Independent project — order app for family tailoring shop', position: 'Developer', description: 'I was responsible for designing and building an app that tracks customer orders for my grandmother\'s shop and I also trained her to use it every week', grades: [10, 11, 12], hrsWeek: 4, wksYear: 40, achievements: 'Used daily for 14 months; no lost orders since March 2025', awards: 'Regional Science Fair 2nd place (Software)', leadership: 'Sole developer', impact: 'Replaced paper notebook; ~60 orders a month tracked', reach: 300, significance: 'Taught me to design for the person using it', skills: 'Flutter, UX interviews', draft: '' },
    { id: uid(), category: 'Robotics', org: 'Example High School Robotics Team', position: 'Programming Lead', description: 'Lead a 6-person programming subteam writing autonomous routines; mentor new members', grades: [9, 10, 11, 12], hrsWeek: 8, wksYear: 30, achievements: 'Qualified for state championship twice', awards: 'State championship qualifier', leadership: 'Programming lead (11–12)', impact: 'Taught 12 new members Java basics', reach: 40, significance: '', skills: 'Java, teamwork', draft: '' },
    { id: uid(), category: 'Work (paid)', org: 'Grandmother\'s tailoring shop', position: 'Shop assistant', description: 'Answer phones, take measurements, handle pickups on Saturdays', grades: [9, 10, 11, 12], hrsWeek: 7, wksYear: 48, achievements: '', awards: '', leadership: '', impact: '', reach: null, significance: 'Family responsibility', skills: 'Customer service', draft: '' },
    { id: uid(), category: 'Community service', org: 'Durham Public Library Teen Tech Help', position: 'Volunteer', description: 'Help older adults with phones and email during weekly drop-in hours', grades: [11, 12], hrsWeek: 2, wksYear: 35, achievements: 'Helped about 150 visitors', awards: '', leadership: '', impact: '', reach: 150, significance: '', skills: 'Patience', draft: '' },
    { id: uid(), category: 'Athletics', org: 'Durham Junior Cycling Club', position: 'Member', description: 'Weekend group rides and charity ride volunteer', grades: [10, 11], hrsWeek: 3, wksYear: 30, achievements: '', awards: '', leadership: '', impact: '', reach: null, significance: '', skills: '', draft: '' },
  ];
  const ids = ['gatech', 'unc', 'umich', 'uiuc', 'purdue', 'northeastern', 'cmu', 'vanderbilt', 'osu', 'utaustin', 'uw'];
  const cats: Record<string, string> = { gatech: 'Target', unc: 'Target', umich: 'Reach', uiuc: 'Target', purdue: 'Likely', northeastern: 'Reach', cmu: 'Reach', vanderbilt: 'Reach', osu: 'Likely', utaustin: 'Target', uw: 'Target' };
  s.list = ids.map((id, i) => ({ collegeId: id, category: cats[id], favorite: id === 'gatech' || id === 'unc', notes: id === 'gatech' ? 'Visited in July — loved the co-op office presentation.' : '', addedAt: new Date(Date.now() - i * 86400000 * 3).toISOString() }));
  const it = (o: Partial<AppState['apps'][number]['items']> = {}) => ({ essays: 'In progress', recommendations: 'Done', transcript: 'Done', testing: 'Done', financialAid: 'In progress', scholarships: 'Not started', interview: 'N/A', ...o }) as AppState['apps'][number]['items'];
  s.apps = [
    { id: uid(), collegeId: 'unc', round: 'EA', deadline: '2026-10-15', status: 'Submitted', items: it({ essays: 'Done' }), submitted: '2026-10-12', decisionDate: '2027-01-31', result: '', notes: '' },
    { id: uid(), collegeId: 'gatech', round: 'EA', deadline: '2026-10-15', status: 'Submitted', items: it({ essays: 'Done' }), submitted: '2026-10-14', decisionDate: '2027-01-15', result: '', notes: 'Out-of-state EA2 window' },
    { id: uid(), collegeId: 'umich', round: 'EA', deadline: '2026-11-01', status: 'Submitted', items: it({ essays: 'Done' }), submitted: '2026-10-30', decisionDate: '2027-01-31', result: '', notes: '' },
    { id: uid(), collegeId: 'purdue', round: 'EA', deadline: '2026-11-01', status: 'Accepted', items: it({ essays: 'Done', financialAid: 'Done' }), submitted: '2026-10-20', decisionDate: '2026-11-20', result: 'Admitted to Computer Science (demo)', notes: '' },
    { id: uid(), collegeId: 'uw', round: 'RD', deadline: '2026-11-15', status: 'Submitted', items: it({ essays: 'Done' }), submitted: '2026-11-14', decisionDate: '2027-03-15', result: '', notes: '' },
    { id: uid(), collegeId: 'utaustin', round: 'RD', deadline: '2026-12-01', status: 'In progress', items: it({ essays: 'In progress', testing: 'In progress' }), submitted: '', decisionDate: '', result: '', notes: 'Need to send official SAT score' },
    { id: uid(), collegeId: 'northeastern', round: 'RD', deadline: '2027-01-01', status: 'In progress', items: it({ essays: 'Not started', recommendations: 'In progress' }), submitted: '', decisionDate: '', result: '', notes: '' },
    { id: uid(), collegeId: 'cmu', round: 'RD', deadline: '2027-01-03', status: 'Planned', items: it({ essays: 'Not started', recommendations: 'In progress' }), submitted: '', decisionDate: '', result: '', notes: '' },
    { id: uid(), collegeId: 'uiuc', round: 'RD', deadline: '2027-01-05', status: 'Planned', items: it({ essays: 'Not started' }), submitted: '', decisionDate: '', result: '', notes: '' },
    { id: uid(), collegeId: 'vanderbilt', round: 'RD', deadline: '2027-01-01', status: 'Researching', items: it({ essays: 'Not started', recommendations: 'Not started' }), submitted: '', decisionDate: '', result: '', notes: '' },
  ];
  s.tasks = [
    { id: uid(), title: 'Send official SAT score to UT Austin', due: '2026-11-26', done: false, priority: 'High', collegeId: 'utaustin', reminder: true },
    { id: uid(), title: 'Draft Northeastern "Why Northeastern" supplement', due: '2026-12-10', done: false, priority: 'Medium', collegeId: 'northeastern', reminder: true },
    { id: uid(), title: 'Submit CSS Profile for Vanderbilt & CMU', due: '2026-12-15', done: false, priority: 'High', collegeId: '', reminder: true },
    { id: uid(), title: 'Thank-you notes to recommenders', due: '2026-11-30', done: false, priority: 'Low', collegeId: '', reminder: false },
    { id: uid(), title: 'Submit FAFSA', due: '2026-10-20', done: true, priority: 'High', collegeId: '', reminder: false },
  ];
  s.essays = [{
    id: uid(), title: 'Common App personal statement', type: 'Common App personal statement',
    prompt: 'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.',
    limit: 650, collegeId: '', comments: [], updatedAt: new Date().toISOString(),
    drafts: [
      { id: uid(), label: 'Draft 1', text: DRAFT1, createdAt: '2026-08-02T15:00:00.000Z' },
      { id: uid(), label: 'Draft 2', text: DRAFT2, createdAt: '2026-09-14T15:00:00.000Z' },
    ],
    working: DRAFT2,
  }];
  s.savedScholarships = ['cocacola', 'elks'];
  return s;
}

export const LANDING_SAMPLE = `Ever since I was a child, I have always been passionate about helping people. In today's society it is very important to make a difference, and volunteering at the food bank really opened my eyes.`;
