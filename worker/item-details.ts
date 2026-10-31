import { brandFieldNames } from '../src/shared/item-details';

// Only internal column names enter this expression; brand values remain bound parameters.
export function itemBrandSql(column: 'context_json' | 'i.context_json') {
  return (
    "COALESCE((SELECT trim(json_extract(detail.value,'$.value')) FROM json_each(" +
    column +
    ", '$.fields') detail WHERE detail.type='object' AND lower(trim(json_extract(detail.value,'$.name'))) IN (" +
    brandFieldNames.map((name) => "'" + name + "'").join(',') +
    ") AND json_type(detail.value,'$.value')='text' ORDER BY (lower(trim(json_extract(detail.value,'$.name')))='brand') DESC,detail.key LIMIT 1),'')"
  );
}
