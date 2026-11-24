import { z } from 'zod';

export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P'] as const;
export const LEVELS = ['Regular', 'Honors', 'AP', 'IB', 'Dual enrollment'] as const;
export const SUBJECTS = ['English', 'Math', 'Science', 'Social Studies', 'World Language', 'Arts', 'Elective'] as const;
export const APP_STATUSES = ['Researching', 'Planned', 'In progress', 'Ready to submit', 'Submitted', 'Accepted', 'Deferred', 'Waitlisted', 'Rejected'] as const;
export const ITEM_STATUSES = ['Not started', 'In progress', 'Done', 'N/A'] as const;
export const ESSAY_TYPES = ['Common App personal statement', 'Supplemental essay', 'Why This College', 'Why This Major', 'Scholarship essay', 'Additional information', 'Other'] as const;
export const ACTIVITY_CATEGORIES = ['Academic', 'Art', 'Athletics', 'Career-oriented', 'Community service', 'Computer/Technology', 'Cultural', 'Debate/Speech', 'Family responsibilities', 'Journalism/Publication', 'Music', 'Research', 'Robotics', 'Science/Math', 'Student government', 'Work (paid)', 'Other'] as const;

const num = (min: number, max: number) => z.union([z.number().min(min).max(max), z.null()]);

export const AwardSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Award title is required').max(100),
  level: z.enum(['School', 'Regional', 'State', 'National', 'International']),
  grades: z.array(z.number().int().min(9).max(12)),
});
export type Award = z.infer<typeof AwardSchema>;

export const ProfileSchema = z.object({
  name: z.string().max(80),
  highSchool: z.string().max(120),
  city: z.string().max(80),
  state: z.string().max(40),
  gradYear: num(2024, 2035),
  gpaUnweighted: num(0, 5),
  gpaWeighted: num(0, 6),
  gpaScale: z.enum(['4.0', '4.3', '5.0', '100', 'Other']),
  classRank: num(1, 5000),
  classSize: num(1, 5000),
  intendedMajor: z.string().max(80),
  altMajors: z.array(z.string()),
  testingStatus: z.enum(['Not yet tested', 'Planning to test', 'Tested', 'Not submitting scores']),
  sat: z.object({ total: num(400, 1600), rw: num(200, 800), math: num(200, 800), date: z.string() }),
  act: z.object({ composite: num(1, 36), english: num(1, 36), math: num(1, 36), reading: num(1, 36), science: num(1, 36), date: z.string() }),
  plannedTests: z.string().max(200),
  trend: z.enum(['', 'Upward', 'Steady', 'Downward', 'Mixed']),
  awards: z.array(AwardSchema),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PersonalSchema = z.object({
  career: z.string().max(120),
  academicInterests: z.string().max(400),
  personalInterests: z.string().max(400),
  settings: z.array(z.enum(['Urban', 'Suburban', 'Small city', 'Rural'])),
  regions: z.array(z.string()),
  size: z.enum(['Any', 'Small (<5k)', 'Medium (5k–15k)', 'Large (15k+)']),
  maxDistance: num(0, 10000),
  kinds: z.array(z.string()),
  culture: z.string().max(400),
  accessibility: z.string().max(400),
  careerPriorities: z.string().max(400),
  wantsResearch: z.boolean(),
  wantsInternships: z.boolean(),
  learning: z.string().max(400),
});
export type Personal = z.infer<typeof PersonalSchema>;

export const FinancialSchema = z.object({
  shareFinancials: z.boolean(),
  incomeBracket: z.enum(['Prefer not to say', '$0–30k', '$30–48k', '$48–75k', '$75–110k', '$110k+']),
  maxAnnualCost: num(0, 200000),
  expectedContribution: num(0, 200000),
  aidPriority: z.enum(['Not important', 'Somewhat important', 'Very important', 'Essential']),
  meritPreference: z.boolean(),
  loanWillingness: z.enum(['No loans', 'Federal loans only', 'Some loans', 'Comfortable with loans']),
  notes: z.string().max(600),
});
export type Financial = z.infer<typeof FinancialSchema>;

export const CourseSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Course name is required').max(80),
  year: z.number().int().min(9).max(12),
  term: z.enum(['Full year', 'Semester 1', 'Semester 2']),
  level: z.enum(LEVELS),
  subject: z.enum(SUBJECTS),
  grade: z.enum(GRADES),
  credits: z.number().min(0.25).max(2),
});
export type Course = z.infer<typeof CourseSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  category: z.enum(ACTIVITY_CATEGORIES),
  org: z.string().min(1, 'Organization is required').max(100),
  position: z.string().max(50),
  description: z.string().max(1000),
  grades: z.array(z.number().int().min(9).max(12)),
  hrsWeek: z.number().min(0).max(80),
  wksYear: z.number().min(0).max(52),
  achievements: z.string().max(500),
  awards: z.string().max(300),
  leadership: z.string().max(300),
  impact: z.string().max(500),
  reach: num(0, 10000000),
  significance: z.string().max(500),
  skills: z.string().max(300),
  draft: z.string().max(150),
});
export type Activity = z.infer<typeof ActivitySchema>;

export interface ListItem { collegeId: string; category: string; favorite: boolean; notes: string; addedAt: string }
export interface Application {
  id: string; collegeId: string; round: string; deadline: string; status: (typeof APP_STATUSES)[number];
  items: Record<'essays' | 'recommendations' | 'transcript' | 'testing' | 'financialAid' | 'scholarships' | 'interview', (typeof ITEM_STATUSES)[number]>;
  submitted: string; decisionDate: string; result: string; notes: string;
}
export interface Task { id: string; title: string; due: string; done: boolean; priority: 'High' | 'Medium' | 'Low'; collegeId: string; reminder: boolean }
export interface Draft { id: string; text: string; createdAt: string; label: string; scores?: Record<string, number> }
export interface EssayComment { id: string; quote: string; text: string; at: string }
export interface Essay {
  id: string; title: string; type: (typeof ESSAY_TYPES)[number]; prompt: string; limit: number | null;
  collegeId: string; drafts: Draft[]; working: string; comments: EssayComment[]; updatedAt: string;
}
export interface Experience {
  id: string; collegeId: string; relation: 'Current student' | 'Recent graduate' | 'Admitted student' | 'Visitor';
  year: string; ratings: Record<string, number>; positives: string; concerns: string; createdAt: string;
}
export interface SavedSearch { id: string; name: string; filters: Record<string, unknown> }
export interface CustomScholarship { id: string; name: string; amount: string; deadline: string; url: string; notes: string }

export interface InterviewAnswer { q: string; kind: string; transcript: string; seconds: number; score: number }
export interface InterviewSession { id: string; collegeId: string; at: string; answers: InterviewAnswer[] }
export interface AidOffer { id: string; collegeId: string; coa: number | null; grants: number; scholarships: number; workStudy: number; subLoans: number; unsubLoans: number; parentLoans: number; privateLoans: number; renewable: boolean; notes: string }

export interface AppState {
  version: 1;
  meta: { demo: boolean; createdAt: string; onboarded: boolean; lastSaved: string };
  profile: Profile;
  personal: Personal;
  financial: Financial;
  courses: Course[];
  activities: Activity[];
  list: ListItem[];
  customCategories: string[];
  compare: string[];
  apps: Application[];
  tasks: Task[];
  essays: Essay[];
  savedSearches: SavedSearch[];
  savedScholarships: string[];
  customScholarships: CustomScholarship[];
  experiences: Experience[];
  interviews: InterviewSession[];
  customColleges: import('../data/colleges').College[];
  offers: AidOffer[];
  prefs: { theme: 'system' | 'light' | 'dark'; reduceMotion: boolean; essayMode: string; autoSync: boolean; notifications: boolean };
}

// Lightweight import validation: checks the top-level shape and the strictly-typed
// profile sections, so a malformed or foreign JSON file is rejected with a clear message.
export const ImportSchema = z.object({
  version: z.literal(1),
  profile: ProfileSchema,
  personal: PersonalSchema,
  financial: FinancialSchema,
  courses: z.array(CourseSchema),
  activities: z.array(ActivitySchema),
}).passthrough();
