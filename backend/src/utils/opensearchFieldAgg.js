import { client } from '../../opensearch/client.js';

/** Flatten OpenSearch error text (root_cause / caused_by are often where mapping errors live). */
export function opensearchErrorText(err) {
  const parts = [];
  const push = (value) => {
    const text = String(value || '').trim();
    if (text) parts.push(text);
  };

  push(err?.message);
  const error = err?.meta?.body?.error;
  if (!error) return parts.join(' ');

  push(error.reason);
  for (const item of error.root_cause || []) {
    push(item.reason);
    push(item.type);
  }
  let caused = error.caused_by;
  while (caused) {
    push(caused.reason);
    push(caused.type);
    caused = caused.caused_by;
  }
  return parts.join(' ');
}

export function isIndexMissing(err) {
  const text = opensearchErrorText(err);
  return err?.meta?.body?.error?.type === 'index_not_found_exception'
    || err?.meta?.statusCode === 404
    || err?.statusCode === 404
    || /index_not_found_exception/i.test(text);
}

/** Aggregation/sort attempted on text field, or `.keyword` subfield missing. */
export function isMappingFieldError(err) {
  const text = opensearchErrorText(err);
  return /No mapping found|Fielddata is disabled|illegal_argument_exception|text fields|of type \[text\]/i.test(text);
}

/**
 * Terms agg with field-mapping fallbacks.
 * Prefer `field.keyword` first so text mappings never throw; plain field covers keyword-only mappings.
 */
export async function searchTermsAgg({ index, query, parent, fields, size, innerAggs }) {
  let last = null;
  for (const field of fields) {
    try {
      const { body } = await client.search({
        index,
        body: {
          size: 0,
          track_total_hits: false,
          query,
          aggs: {
            [parent]: {
              terms: { field, size },
              aggs: innerAggs,
            },
          },
        },
      });
      last = body;
      if (body?.aggregations?.[parent]?.buckets?.length) return body;
    } catch (err) {
      if (isIndexMissing(err)) return null;
      if (isMappingFieldError(err)) continue;
      throw err;
    }
  }
  return last;
}
