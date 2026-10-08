import { cn } from "../../lib/Utils";

export default function Card({ className, ...props }) {
  return <div className={cn('rounded-[14px] border border-line bg-side p-3.5', className)} {...props} />;
}