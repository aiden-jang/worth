import type { ReactNode } from 'react';
import { BlankSlips } from './BlankSlips';

export function CabinetEmptyState({
  title,
  description,
  children,
  art,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <section className="cabinet-quiet-state">
      {art ?? <BlankSlips />}
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </section>
  );
}
