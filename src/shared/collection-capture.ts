export const batchCaptureLimit = 30;

export function batchCaptureTitles(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/\r?\n/).reduce<string[]>((titles, line) => {
    const title = line.trim();
    const key = title.toLocaleLowerCase();
    if (title && !seen.has(key)) {
      seen.add(key);
      titles.push(title);
    }
    return titles;
  }, []);
}
