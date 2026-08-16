import type {
  Kpi,
  ActivityItem,
  PaymentRow,
  StudentSummary,
  SessionSlot,
  GradingItem,
  PuzzleAssignment,
  Badge,
  ChildProfile,
  StoreItem,
  AlertItem
} from '@/types';

export const adminKpis: Kpi[] = [
  { label: 'Active students', value: '128', delta: '↑ 6 this month', deltaTone: 'up' },
  { label: 'Revenue — August', value: 'KES 320,400', delta: '↑ 12% vs July', deltaTone: 'up' },
  { label: 'Coaches active', value: '6', delta: '2 sessions logged today', deltaTone: 'neutral' },
  { label: 'Overdue accounts', value: '9', delta: '↑ needs follow-up', deltaTone: 'warn' }
];

export const coachActivity: ActivityItem[] = [
  {
    id: 'a1',
    text: '**Coach Wanjiku** logged a session with Group B — Rook endgames, 8 students present',
    time: '2 hours ago'
  },
  {
    id: 'a2',
    text: '**Coach Otieno** graded 12 puzzle submissions for Beginner Group',
    time: '4 hours ago'
  },
  {
    id: 'a3',
    text: '**Amwai** logged a 1:1 session with Zawadi Kimani — Sicilian basics',
    time: 'Yesterday, 5:40 PM'
  },
  {
    id: 'a4',
    text: '**Coach Mutua** assigned a new puzzle set to Intermediate Group',
    time: 'Yesterday, 3:10 PM'
  }
];

export const adminAlerts: AlertItem[] = [
  { id: 'al1', label: 'Low stock', detail: 'Recording Sheets: 12 left' },
  { id: 'al2', label: 'Low stock', detail: 'Club T-Shirt (M): 3 left' },
  { id: 'al3', label: '9 accounts overdue', detail: 'KES 27,000 outstanding' }
];

export const paymentRows: PaymentRow[] = [
  { id: 'p1', studentName: 'Amani Otieno', coachName: 'Coach Wanjiku', amount: 'KES 3,500', status: 'paid' },
  { id: 'p2', studentName: 'Zawadi Kimani', coachName: 'Amwai', amount: 'KES 3,500', status: 'overdue' },
  { id: 'p3', studentName: 'Brian Njoroge', coachName: 'Coach Otieno', amount: 'KES 3,500', status: 'pending' },
  { id: 'p4', studentName: 'Faith Wambui', coachName: 'Coach Mutua', amount: 'KES 3,500', status: 'paid' }
];

export const todaysSessions: SessionSlot[] = [
  { id: 's1', time: '4:00 PM', label: 'Group B — Rook Endgames' },
  { id: 's2', time: '5:30 PM', label: '1:1 — Brian Njoroge' },
  { id: 's3', time: '6:15 PM', label: 'Beginner Group — Pawn structure intro' }
];

export const gradingQueue: GradingItem[] = [
  { id: 'g1', text: '**Group B** — Rook endgame puzzle set — 6 of 8 submitted' },
  { id: 'g2', text: '**Faith Wambui** — Tactics set 4 — awaiting review' },
  { id: 'g3', text: '**Beginner Group** — Knight forks — 3 of 12 submitted' }
];

export const roster: StudentSummary[] = [
  { id: 'r1', name: 'Amani Otieno', initials: 'AO', lastSession: '2 days ago', puzzlesThisMonth: 42, progressPercent: 72 },
  { id: 'r2', name: 'Brian Njoroge', initials: 'BN', lastSession: 'today', puzzlesThisMonth: 18, progressPercent: 40 },
  { id: 'r3', name: 'Faith Wambui', initials: 'FW', lastSession: '1 day ago', puzzlesThisMonth: 55, progressPercent: 88 }
];

export const puzzles: PuzzleAssignment[] = [
  { id: 'pz1', title: 'Knight Fork Basics', tag: 'Set of 6 · due Fri', status: 'new' },
  { id: 'pz2', title: 'Rook Endgame Drill', tag: 'Set of 8 · awaiting review', status: 'review' },
  { id: 'pz3', title: 'Pin & Skewer Set', tag: '"Great eye for tactics — watch your clock" — Coach Wanjiku', status: 'graded' }
];

export const puzzlesSolvedByMonth = [
  { label: 'Mar', value: 38 },
  { label: 'Apr', value: 52 },
  { label: 'May', value: 44 },
  { label: 'Jun', value: 68 },
  { label: 'Jul', value: 80 },
  { label: 'Aug', value: 95 }
];

export const badges: Badge[] = [
  { id: 'b1', icon: '🏅', name: '50 puzzles' },
  { id: 'b2', icon: '🔥', name: '5-day streak' },
  { id: 'b3', icon: '♞', name: 'First tourney' },
  { id: 'b4', icon: '🛡', name: 'Endgame pro' }
];

export const children: ChildProfile[] = [
  {
    id: 'c1',
    name: 'Zawadi',
    age: 9,
    subscriptionAmount: 'KES 3,500',
    dueDate: '15 Aug',
    daysRemaining: 3,
    progressNotes: [
      { id: 'n1', text: 'Attended 3 of 4 sessions this month', time: '' },
      { id: 'n2', text: '42 puzzles solved · 88% accuracy', time: '' },
      { id: 'n3', text: '**Coach note:** "Zawadi is grasping rook endgames quickly — ready for the next set."', time: '' }
    ],
    upcoming: [
      { id: 'u1', text: '**Mavens Junior Open** — Sep 6, registration open', time: '' },
      { id: 'u2', text: 'Next lesson — Fri 4:00 PM, Group B', time: '' }
    ]
  },
  {
    id: 'c2',
    name: 'Malaika',
    age: 12,
    subscriptionAmount: 'KES 3,500',
    dueDate: '15 Aug',
    daysRemaining: 3,
    progressNotes: [
      { id: 'n1', text: 'Attended 4 of 4 sessions this month', time: '' },
      { id: 'n2', text: '61 puzzles solved · 91% accuracy', time: '' },
      { id: 'n3', text: '**Coach note:** "Malaika is ready to start tournament play."', time: '' }
    ],
    upcoming: [
      { id: 'u1', text: '**Mavens Junior Open** — Sep 6, registration open', time: '' },
      { id: 'u2', text: 'Next lesson — Sat 10:00 AM, Group A', time: '' }
    ]
  }
];

export const storeItems: StoreItem[] = [
  { id: 'st1', name: 'Mavens Club T-Shirt', price: 'KES 1,200' },
  { id: 'st2', name: 'Recording Sheet Pad', price: 'KES 350' },
  { id: 'st3', name: 'Tournament Set (Board + Pieces)', price: 'KES 2,800' }
];
