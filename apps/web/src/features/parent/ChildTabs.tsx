import type { StudentRecord } from '@/lib/students';

/// The same child-switcher tab row used across the parent's dashboard and
/// the dedicated Payments/Tournaments/Progress pages.
export function ChildTabs({
  children,
  activeChildId,
  onSelect
}: {
  children: StudentRecord[];
  activeChildId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="child-tabs">
      {children.map((c) => (
        <div
          key={c.id}
          className={`child-tab ${c.id === activeChildId ? 'active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          {c.firstName}
        </div>
      ))}
    </div>
  );
}
