// Models write math as LaTeX inside JSON strings, and a single backslash there is not valid JSON. Worse, some
// LaTeX commands start with a letter that JSON reads as an escape: \text and \times begin with \t (a tab), \frac
// with \f (a form feed), \neq with \n (a newline). A plain "double every stray backslash" repair leaves those alone
// and silently turns them into control characters.

// LaTeX commands that start with b, f, n, r or t, the letters JSON treats as escapes.
const LATEX_ESCAPE_CLASH =
  /(?<!\\)\\(frac|tfrac|dfrac|times|text|textbf|theta|therefore|tan|to|top|rightarrow|right|rho|neq|ne|not|neg|nabla|nu|beta|bar|begin|binom|boxed|bullet|bf|rm|forall|fbox)(?![a-zA-Z])/g;

/** Makes a model's JSON text parseable without changing what it says. */
export function repairJsonBackslashes(text: string): string {
  return text
    .replace(LATEX_ESCAPE_CLASH, (_m, cmd) => `\\\\${cmd}`)
    .replace(/(?<!\\)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
}

/**
 * Parses JSON from a model. LaTeX commands that JSON would quietly read as an escape (\text becomes a tab plus "ext")
 * are fixed BEFORE parsing, because that text parses without any error. Other stray backslashes are repaired only if
 * the first parse fails. Returns null when the text cannot be parsed.
 */
export function parseModelJson(text: string): any | null {
  const guarded = text.replace(LATEX_ESCAPE_CLASH, (_m, cmd) => `\\\\${cmd}`);
  try {
    return JSON.parse(guarded);
  } catch {
    try {
      return JSON.parse(repairJsonBackslashes(text));
    } catch {
      return null;
    }
  }
}
