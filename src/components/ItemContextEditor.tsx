import { SuggestedDetails } from './CollectionFields';
import { useState } from 'react';
import { calendarReminder, emptyItemContext, type ItemContext } from '../shared/item-context';

function downloadReminder(title: string, date: string) {
  const url = URL.createObjectURL(
    new Blob([calendarReminder(title, date)], { type: 'text/calendar;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'worth-return-reminder.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ItemContextEditor({
  value,
  onChange,
  title,
  listId,
}: {
  value: ItemContext | undefined;
  onChange: (context: ItemContext) => void;
  title: string;
  listId?: string;
}) {
  const context = {
    ...emptyItemContext,
    ...value,
    revisit: { ...emptyItemContext.revisit, ...value?.revisit },
    purchase: { ...emptyItemContext.purchase, ...value?.purchase },
    loan: { ...emptyItemContext.loan, ...value?.loan },
  };
  const [labelText, setLabelText] = useState(context.labels.join('\n'));
  const [stampText, setStampText] = useState(context.stamps.join('\n'));
  const list = (text: string) => [
    ...new Map(
      text
        .split('\n')
        .map((word) => word.trim())
        .filter(Boolean)
        .map((word) => [word.toLocaleLowerCase(), word]),
    ).values(),
  ];
  const textFields = [
    ['whySaved', 'Why I saved this', 500, 'Try the pistachio one.'],
    ['recommendedBy', 'Recommended by', 120, 'A name, if you want to remember it'],
    ['recommendation', 'What they recommended', 500, 'Their suggestion, in your words'],
    ['followUp', 'After trying it', 500, 'What you thought, or what to tell them next time'],
    ['location', 'Location', 120, 'A place or neighborhood'],
    ['version', 'Version or edition', 120, 'The specific model, edition or release'],
  ] as const;
  const hasContext = JSON.stringify(context) !== JSON.stringify(emptyItemContext);
  const source = (() => {
    try {
      const url = new URL(context.sourceUrl);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  })();
  return (
    <details className="record-extras item-context">
      <summary>
        A little more context <span>{hasContext ? 'saved details · private' : 'optional · private'}</span>
      </summary>
      <p>Keep what helps you remember. These details are never included in public ranking links.</p>
      <label>
        Source link
        <input
          type="url"
          maxLength={1000}
          value={context.sourceUrl}
          placeholder="https://…"
          onChange={(event) => onChange({ ...context, sourceUrl: event.target.value })}
        />
      </label>
      {source && (
        <a href={source} target="_blank" rel="noopener noreferrer">
          Open source link ↗
        </a>
      )}
      {textFields.map(([key, label, limit, placeholder]) => (
        <label key={key}>
          {label}
          <input
            value={context[key]}
            maxLength={limit}
            placeholder={placeholder}
            onChange={(event) => onChange({ ...context, [key]: event.target.value })}
          />
        </label>
      ))}
      <details className="record-extras">
        <summary>Plan a revisit</summary>
        <p>
          A chosen day, without reminders. This stays separate from your queue, call and actual visits. Save
          this record to keep changes.
        </p>
        <label>
          Revisit on
          <input
            type="date"
            value={context.revisit.on ?? ''}
            onChange={(e) =>
              onChange({ ...context, revisit: { on: e.target.value || null, snoozedUntil: null } })
            }
          />
        </label>
        <label>
          Snooze until (optional)
          <input
            type="date"
            disabled={!context.revisit.on}
            min={context.revisit.on ?? undefined}
            value={context.revisit.snoozedUntil ?? ''}
            onChange={(e) =>
              onChange({ ...context, revisit: { ...context.revisit, snoozedUntil: e.target.value || null } })
            }
          />
        </label>
        {context.revisit.snoozedUntil && (
          <button
            type="button"
            className="button button-outline"
            onClick={() => onChange({ ...context, revisit: { ...context.revisit, snoozedUntil: null } })}
          >
            Clear snooze
          </button>
        )}
        {context.revisit.on && (
          <p>
            Originally {context.revisit.on}
            {context.revisit.snoozedUntil ? `; now ${context.revisit.snoozedUntil}` : ''}. A logged visit does
            not clear this plan automatically.
          </p>
        )}
      </details>
      <details className="record-extras">
        <summary>Labels and stamps</summary>
        <label>
          Personal labels
          <textarea
            rows={3}
            value={labelText}
            maxLength={400}
            placeholder={'comfort watch\nspecial occasion'}
            onChange={(event) => {
              setLabelText(event.target.value);
              onChange({ ...context, labels: list(event.target.value) });
            }}
          />
        </label>
        <p className="muted">One per line. Up to 12 labels, 32 characters each.</p>
        <label>
          Personal stamps
          <textarea
            rows={3}
            value={stampText}
            maxLength={400}
            placeholder={'worth the detour\nbetter in person'}
            onChange={(event) => {
              setStampText(event.target.value);
              onChange({ ...context, stamps: list(event.target.value) });
            }}
          />
        </label>
        <p className="muted">One per line. Up to 8 stamps, 48 characters each.</p>
        <div className="personal-stamps" aria-label="Your stamps">
          {context.stamps.map((stamp) => (
            <span key={stamp}>{stamp}</span>
          ))}
        </div>
      </details>
      <details className="record-extras">
        <summary>Custom details</summary>
        {listId && (
          <SuggestedDetails
            listId={listId}
            fields={context.fields}
            onChange={(fields) => onChange({ ...context, fields })}
          />
        )}
        {context.fields.map((field, index) => (
          <div className="context-field" key={index}>
            <label>
              Detail name {index + 1}
              <input
                value={field.name}
                maxLength={40}
                onChange={(event) =>
                  onChange({
                    ...context,
                    fields: context.fields.map((other, slot) =>
                      slot === index ? { ...other, name: event.target.value } : other,
                    ),
                  })
                }
                placeholder="Director, size, neighborhood…"
              />
            </label>
            <label>
              Detail value {index + 1}
              <input
                value={field.value}
                maxLength={240}
                onChange={(event) =>
                  onChange({
                    ...context,
                    fields: context.fields.map((other, slot) =>
                      slot === index ? { ...other, value: event.target.value } : other,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="button button-outline"
              aria-label={`Remove detail ${index + 1}`}
              onClick={() =>
                onChange({ ...context, fields: context.fields.filter((_, slot) => slot !== index) })
              }
            >
              Remove detail
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-outline"
          disabled={context.fields.length >= 12}
          onClick={() => onChange({ ...context, fields: [...context.fields, { name: '', value: '' }] })}
        >
          Add a custom detail
        </button>
      </details>
      <details className="record-extras">
        <summary>Purchase and ownership</summary>
        <div className="date-pair">
          <label>
            Purchase date
            <input
              type="date"
              value={context.purchase.boughtOn ?? ''}
              onChange={(event) =>
                onChange({
                  ...context,
                  purchase: { ...context.purchase, boughtOn: event.target.value || null },
                })
              }
            />
          </label>
          <label>
            Return deadline
            <input
              type="date"
              min={context.purchase.boughtOn ?? undefined}
              value={context.purchase.returnBy ?? ''}
              onChange={(event) =>
                onChange({
                  ...context,
                  purchase: { ...context.purchase, returnBy: event.target.value || null },
                })
              }
            />
          </label>
        </div>
        <div className="date-pair">
          <label>
            Price paid
            <input
              type="number"
              min="0"
              max="1000000000"
              step="any"
              value={context.purchase.price ?? ''}
              onChange={(event) =>
                onChange({
                  ...context,
                  purchase: {
                    ...context.purchase,
                    price: event.target.value === '' ? null : Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Currency
            <input
              value={context.purchase.currency}
              maxLength={3}
              placeholder="USD"
              onChange={(event) =>
                onChange({
                  ...context,
                  purchase: { ...context.purchase, currency: event.target.value.toUpperCase() },
                })
              }
            />
          </label>
        </div>
        <label>
          Ownership status
          <select
            value={context.purchase.status}
            onChange={(event) =>
              onChange({
                ...context,
                purchase: {
                  ...context.purchase,
                  status: event.target.value as ItemContext['purchase']['status'],
                },
              })
            }
          >
            <option value="unspecified">Not specified</option>
            <option value="using">Still using</option>
            <option value="stored">Stored</option>
            <option value="passed_on">Passed on</option>
            <option value="returned">Returned</option>
          </select>
        </label>
        {context.purchase.returnBy && context.purchase.status !== 'returned' && (
          <Reminder
            title={`Return deadline: ${title.trim() || 'Worth item'}`}
            date={context.purchase.returnBy}
          />
        )}
      </details>
      <details className="record-extras">
        <summary>Borrowed or lent</summary>
        <label>
          Loan direction
          <select
            value={context.loan.direction}
            onChange={(event) =>
              onChange({
                ...context,
                loan: { ...context.loan, direction: event.target.value as ItemContext['loan']['direction'] },
              })
            }
          >
            <option value="none">Not on loan</option>
            <option value="borrowed">Borrowed from someone</option>
            <option value="lent">Lent to someone</option>
          </select>
        </label>
        <label>
          Person
          <input
            value={context.loan.person}
            maxLength={120}
            onChange={(event) =>
              onChange({ ...context, loan: { ...context.loan, person: event.target.value } })
            }
          />
        </label>
        <div className="date-pair">
          <label>
            Loan started
            <input
              type="date"
              value={context.loan.startedOn ?? ''}
              onChange={(event) =>
                onChange({ ...context, loan: { ...context.loan, startedOn: event.target.value || null } })
              }
            />
          </label>
          <label>
            Return by
            <input
              type="date"
              min={context.loan.startedOn ?? undefined}
              value={context.loan.returnBy ?? ''}
              onChange={(event) =>
                onChange({ ...context, loan: { ...context.loan, returnBy: event.target.value || null } })
              }
            />
          </label>
        </div>
        <label>
          Returned on
          <input
            type="date"
            min={context.loan.startedOn ?? undefined}
            value={context.loan.returnedOn ?? ''}
            onChange={(event) =>
              onChange({ ...context, loan: { ...context.loan, returnedOn: event.target.value || null } })
            }
          />
        </label>
        {context.loan.direction !== 'none' && context.loan.returnBy && !context.loan.returnedOn && (
          <Reminder
            title={`${context.loan.direction === 'borrowed' ? 'Return' : 'Collect'}: ${title.trim() || 'Worth item'}`}
            date={context.loan.returnBy}
          />
        )}
      </details>
    </details>
  );
}

function Reminder({ title, date }: { title: string; date: string }) {
  return (
    <div className="context-reminder">
      <p>
        Calendar reminder: “{title}” on {date}. The file includes this title and date, with a reminder one day
        before. It excludes private notes and the Person field. Import it into your calendar to enable
        notifications.
      </p>
      <button type="button" className="button button-outline" onClick={() => downloadReminder(title, date)}>
        Download calendar reminder
      </button>
    </div>
  );
}
