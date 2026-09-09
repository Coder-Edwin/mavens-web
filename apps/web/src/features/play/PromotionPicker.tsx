export type PromotionChoice = 'q' | 'r' | 'b' | 'n';

const GLYPH: Record<'w' | 'b', Record<PromotionChoice, string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' }
};
const NAME: Record<PromotionChoice, string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight'
};
const ORDER: PromotionChoice[] = ['q', 'r', 'b', 'n'];

/** Lichess-style promotion chooser: a row of the four heavy pieces. */
export function PromotionPicker({
  color,
  onPick,
  onCancel
}: {
  color: 'w' | 'b';
  onPick: (choice: PromotionChoice) => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Choose promotion piece"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,20,20,0.55)',
        borderRadius: 8,
        zIndex: 20
      }}
      onClick={onCancel}
    >
      <div
        style={{ display: 'flex', gap: 6, background: 'var(--panel)', padding: 8, borderRadius: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        {ORDER.map((c) => (
          <button
            key={c}
            aria-label={`Promote to ${NAME[c]}`}
            onClick={() => onPick(c)}
            style={{
              width: 56,
              height: 56,
              fontSize: 38,
              lineHeight: '56px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--panel-alt)',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            {GLYPH[color][c]}
          </button>
        ))}
      </div>
    </div>
  );
}
