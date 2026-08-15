/** A generic "are you sure?" dialog for destructive actions — list deletion,
 *  document deletion, anything else that shouldn't be one accidental click
 *  away. Cancel and the backdrop both back out; only the confirm button acts. */
interface Props {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}

export default function ConfirmModal({ title, body, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal narrow-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p className="muted small">{body}</p>
        <footer className="modal-foot">
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
