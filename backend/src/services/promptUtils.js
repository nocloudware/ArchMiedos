// SEC-001: Delimitadores aleatorios por llamada para evitar prompt injection.
// Un token impredecible impide que el usuario cierre el delimitador por adivinación
// (p. ej. inyectando ">>>"). Si el contenido contiene el delimitador generado, se rechaza.

const DELIMITER_TOKEN_LEN = 16;

export function makeDelimiters() {
  const source =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}-${Math.random()}`;
  const token = source.replace(/[^a-zA-Z0-9]/g, '').slice(0, DELIMITER_TOKEN_LEN).toUpperCase();
  return {
    open: `<<<ARCHMIEDOS:${token}:START>>>`,
    close: `<<<ARCHMIEDOS:${token}:END>>>`,
  };
}

export function containsDelimiter(content, delimiters) {
  return content.includes(delimiters.open) || content.includes(delimiters.close);
}

export function wrapContent(content, delimiters) {
  return `${delimiters.open}\n${content}\n${delimiters.close}`;
}
