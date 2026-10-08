import Card from "../ui/Card";

export default function UsageView({ usage, chatCount }) {
  const stats = [
    ['Replies', usage.n],
    ['Input tokens', usage.in],
    ['Output tokens', usage.out],
    ['Conversations', chatCount],
  ];
  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {stats.map(([k, v]) => (
        <Card key={k}>
          <div className="text-[.88rem] text-mute">{k}</div>
          <div className="text-[1.8rem] font-bold text-acc">{v.toLocaleString()}</div>
        </Card>
      ))}
    </div>
  );
}