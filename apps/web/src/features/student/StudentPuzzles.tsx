import { AssignedPuzzlesPanel } from '@/components/AssignedPuzzlesPanel';

/// The student "Puzzles" nav item's own destination — previously it had none
/// (the assigned-puzzles grid only ever lived inline on the dashboard), so
/// clicking it did nothing.
export function StudentPuzzles() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Puzzles</div>
          <div className="page-sub">Solve what your coach has assigned you</div>
        </div>
      </div>
      <AssignedPuzzlesPanel showHeading={false} />
    </>
  );
}
