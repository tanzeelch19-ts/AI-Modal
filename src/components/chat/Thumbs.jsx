import attachCard from './attachedCard.jsx';

// Attachments shown inside a sent message.
export default function Thumbs({ att }) {
  if (!att?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {att.map((a, i) => <AttachmentCard key={i} att={a} size="lg" />)}
    </div>
  );
}