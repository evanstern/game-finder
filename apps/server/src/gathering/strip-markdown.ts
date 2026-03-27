export function stripMarkdownPreview(
  markdown: string,
  maxLength = 150,
): string {
  const stripped = markdown
    .replace(/#{1,6}\s+/g, '') // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/__(.+?)__/g, '$1') // bold (underscores)
    .replace(/_(.+?)_/g, '$1') // italic (underscores)
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code / code blocks
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images
    .replace(/^\s*[-*+]\s+/gm, '') // list markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
    .replace(/^\s*>\s+/gm, '') // blockquotes
    .replace(/---+/g, '') // horizontal rules
    .replace(/\n{2,}/g, ' ') // collapse double newlines
    .replace(/\n/g, ' ') // remaining newlines
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()

  if (stripped.length <= maxLength) return stripped
  return `${stripped.slice(0, maxLength).trimEnd()}...`
}
