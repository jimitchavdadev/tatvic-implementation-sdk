/**
 * Restores aliased query parameters back to their original names before forwarding upstream.
 */
export function unaliasParamsFromAdBlockers(searchParams: URLSearchParams): void {
  if (searchParams.has('_id')) {
    const val = searchParams.get('_id')!;
    searchParams.delete('_id');
    searchParams.set('id', val);
  }
  if (searchParams.has('_gtm')) {
    const val = searchParams.get('_gtm')!;
    searchParams.delete('_gtm');
    searchParams.set('gtm', val);
  }
  if (searchParams.has('_tag_exp')) {
    const val = searchParams.get('_tag_exp')!;
    searchParams.delete('_tag_exp');
    searchParams.set('tag_exp', val);
  }
  if (searchParams.has('_cx')) {
    const val = searchParams.get('_cx')!;
    searchParams.delete('_cx');
    searchParams.set('cx', val);
  }
  if (searchParams.has('_l')) {
    const val = searchParams.get('_l')!;
    searchParams.delete('_l');
    searchParams.set('l', val);
  }
  if (searchParams.has('_v')) {
    const val = searchParams.get('_v')!;
    searchParams.delete('_v');
    searchParams.set('v', val);
  }
  if (searchParams.has('_ep.analytics_storage')) {
    const val = searchParams.get('_ep.analytics_storage')!;
    searchParams.delete('_ep.analytics_storage');
    searchParams.set('ep.analytics_storage', val);
  }
  if (searchParams.has('_event_name')) {
    const val = searchParams.get('_event_name')!;
    searchParams.delete('_event_name');
    searchParams.set('event_name', val);
  }

  const sstKeys: string[] = [];
  searchParams.forEach((_, k) => {
    if (k.startsWith('_sst.')) sstKeys.push(k);
  });
  sstKeys.forEach((k) => {
    const val = searchParams.get(k)!;
    searchParams.delete(k);
    searchParams.set(k.slice(1), val);
  });
}
