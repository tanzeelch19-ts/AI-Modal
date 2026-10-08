export default function Toast({ note }) {
  if (!note) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(90px+env(safe-area-inset-bottom))] left-1/2 z-[60] max-w-[90%] -translate-x-1/2 rounded-xl border border-line bg-panel px-4 py-2.5"
    >
      {note}
    </div>
  );
}