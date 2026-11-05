import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from 'react';

function documentNodes(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? documentNodes(child.props.children)
      : [child],
  );
}

export function InfoDocument({
  title,
  context,
  children,
}: {
  title: string;
  context?: string;
  children: ReactNode;
}) {
  const sections: { id: string; title: string }[] = [];
  const content = documentNodes(children).map((child) => {
    if (!isValidElement<{ children?: ReactNode; id?: string }>(child) || child.type !== 'section')
      return child;
    const heading = Children.toArray(child.props.children).find(
      (node) => isValidElement(node) && node.type === 'h2',
    );
    if (!isValidElement<{ children: string }>(heading) || typeof heading.props.children !== 'string')
      return child;
    const title = heading.props.children;
    const id = `info-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
    sections.push({ id, title });
    return cloneElement(child, { id });
  });
  const links = sections.map((section) => (
    <a key={section.id} href={`#${section.id}`}>
      {section.title}
    </a>
  ));
  return (
    <div className="info-document">
      <header className="info-title">
        <h1>{title}</h1>
        {context && <p>{context}</p>}
      </header>
      {!!sections.length && (
        <details className="info-contents">
          <summary>On this page</summary>
          <nav aria-label={`${title.replace(/\.$/, '')} sections`}>{links}</nav>
        </details>
      )}
      <article className="info-content">{content}</article>
    </div>
  );
}
