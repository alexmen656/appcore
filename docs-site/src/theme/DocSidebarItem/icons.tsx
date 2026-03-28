import React from 'react';
import {
  BookOpen,
  Server,
  GitBranch,
  Smartphone,
  KeyRound,
  type LucideProps,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  intro: BookOpen,
  Infrastructure: Server,
  'fastlane-worker': GitBranch,
  iOS: Smartphone,
  'code-signing': KeyRound,
};

export function SidebarIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon size={15} strokeWidth={1.75} {...props} />;
}
