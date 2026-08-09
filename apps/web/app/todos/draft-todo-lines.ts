export type DraftTodoLine = {
  lineIndex: number;
  title: string;
};

export function getDraftTodoLines(content: string): DraftTodoLine[] {
  return content
    .split(/\r?\n/)
    .map((line, lineIndex) => ({
      lineIndex,
      title: line.trim(),
    }))
    .filter((line) => line.title.length > 0);
}

export function removeDraftTodoLine(
  content: string,
  convertedLine: DraftTodoLine,
) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  // Conversion entries retain their source-line position so duplicate titles are removed one at a time.
  lines.splice(convertedLine.lineIndex, 1);
  const remainingContent = lines.join(newline);

  // Do not retain whitespace-only remnants after the final real todo has been converted.
  return getDraftTodoLines(remainingContent).length > 0 ? remainingContent : '';
}

export function shiftDraftTodoLinesAfterRemoval(
  remainingLines: DraftTodoLine[],
  removedLineIndex: number,
) {
  return remainingLines.map((line) => ({
    ...line,
    lineIndex:
      line.lineIndex > removedLineIndex ? line.lineIndex - 1 : line.lineIndex,
  }));
}
