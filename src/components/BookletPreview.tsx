import type { BookletData } from '../shared/booklet';
import '../publishing.css';
export function BookletPreview({ data, print = false }: { data: BookletData; print?: boolean }) {
  const CoverHeading = print ? 'h1' : 'h3';
  const RecordHeading = print ? 'h2' : 'h3';
  return (
    <div
      className="booklet-preview"
      role="region"
      aria-label={data.format === 'guide' ? 'Field guide preview' : 'Booklet preview'}
    >
      <article className="booklet-paper booklet-cover">
        <p className="publishing-eyebrow">
          {data.format === 'guide' ? 'A FIELD GUIDE FROM WORTH' : 'A COLLECTION FROM WORTH'}
        </p>
        <svg className="booklet-cover-mark" viewBox="0 0 80 64" fill="none" aria-hidden="true">
          <path
            d="m17 16 39-6 7 40-39 6zM24 8l40 5-5 42-40-5z"
            fill="#eae5d5"
            stroke="#737566"
            strokeWidth="2"
          />
          <path d="m32 24 20 2m-21 8 13 1" stroke="#737566" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <CoverHeading className="booklet-title">{data.title}</CoverHeading>
        {data.dedication && <p className="publishing-caption">{data.dedication}</p>}
        <p>
          {data.entries.length} {data.entries.length === 1 ? 'record' : 'records'}
        </p>
        <footer>{data.format === 'guide' ? 'worth · Field guide' : 'worth · A small collection.'}</footer>
      </article>
      {data.entries.map((entry, index) => (
        <article className="booklet-paper" key={entry.id}>
          <p className="publishing-eyebrow">
            RECORD {String(index + 1).padStart(2, '0')}
            {entry.rank === undefined
              ? ''
              : entry.rank === null
                ? ' · UNRANKED'
                : ` · COLLECTION RANK ${entry.rank}`}
          </p>
          <RecordHeading className="booklet-title">{entry.title}</RecordHeading>
          {entry.type && <p>{entry.type}</p>}
          {entry.photo && <img src={entry.photo} alt={`Selected photo for ${entry.title}`} />}
          {entry.call && <p className="booklet-call">{entry.call}</p>}
          {entry.caption && <p className="publishing-caption">{entry.caption}</p>}
          {entry.note && (
            <section className="booklet-note">
              <h4>Private note</h4>
              <p>{entry.note}</p>
            </section>
          )}
          <footer>worth</footer>
        </article>
      ))}
    </div>
  );
}
