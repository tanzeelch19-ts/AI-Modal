
import { Code2, Bug, Sparkles, MessageSquare } from 'lucide-react';

export const MAX_IMG = 8;

// [Icon, title, description, text put in the input box]

export const PROMPTS = [
  [
    Code2,
    'Explain code',
    'Paste code and get a clear walkthrough',
    'Explain this code:\n\n',
  ],
  [
    Bug,
    'Debug my code',
    'Find the bug and get a fix',
    'Debug this code and show the fix:\n\n',
  ],
  [
    Sparkles,
    'Generate code',
    'Describe it and get working code',
    'Write code that ',
  ],
  [
    MessageSquare,
    'Explain a concept',
    'Hooks, async, SQL and more',
    'Explain React useEffect',
  ],
];