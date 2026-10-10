import type { ReactNode } from 'react';
import { BlankSlips } from './BlankSlips';

export function CabinetEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="cabinet-quiet-state">
      <BlankSlips />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </section>
  );
}
