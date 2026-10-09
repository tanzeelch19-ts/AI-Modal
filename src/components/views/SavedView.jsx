import { Copy, X } from 'lucide-react';
import actionButton from '../ui/ActButtons';
import Card from '../ui/Card';
import Markdown from '../markdown/Markdown';

export default function SavedView({ saved, onCopy, onRemove }) {
  return (
    <div className="mx-auto max-w-[760px]">
      {saved.length ? saved.map((s, i) => (
        <Card key={i} className="mb-3">
          <Markdown>{s}</Markdown>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ActionButton onClick={() => onCopy(s)}><Copy size={14} />Copy</ActionButton>
            <ActionButton onClick={() => onRemove(i)}><X size={14} />Remove</ActionButton>
          </div>
        </Card>
      )) : <p className="my-4 text-[.88rem] text-mute">Nothing saved yet. Use Save under a reply to keep it here.</p>}
    </div>
  );
}