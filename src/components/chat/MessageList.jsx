import Message from './Message.jsx';

export default function MessageList({ msgs, busy, onCopy, onSave, onSpeak, onRegenerate }) {
  return (
    <div className="mx-auto max-w-[760px]">
      {msgs.map((m, i) => (
        <Message
          key={m.id}
          m={m}
          isLast={i === msgs.length - 1}
          busy={busy}
          onCopy={onCopy}
          onSave={onSave}
          onSpeak={onSpeak}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
}