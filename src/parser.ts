/**
 * Template parser that safely extracts ${name, "description"} placeholders
 * using a tokenizer to handle edge cases (commas in quotes, nested blocks)
 */

export type Placeholder = {
  name: string;
  description?: string;
  start: number;
  end: number;
};

export type ParsedTemplate = {
  ast: Array<string | Placeholder>;
  vars: Placeholder[];
  template: string;
  inputSchema: Record<string, any>;
};

/**
 * Safely parse a template string and extract placeholders.
 * Returns AST with ordered unique variables.
 */
export function parseTemplate(template: string): ParsedTemplate {
  const ast: Array<string | Placeholder> = [];
  const vars: Placeholder[] = [];
  const seen = new Map<string, Placeholder>();

  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("${", i);
    if (open === -1) {
      if (i < template.length) ast.push(template.slice(i));
      break;
    }

    // Push leading literal
    if (open > i) ast.push(template.slice(i, open));

    // Find matching } while respecting quoted strings
    let j = open + 2;
    let inQuotes = false;
    let escaped = false;

    while (j < template.length) {
      const ch = template[j];

      if (escaped) {
        escaped = false;
        j++;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        j++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "}" && !inQuotes) {
        break;
      }

      j++;
    }

    if (j >= template.length) {
      // Unmatched; treat as literal
      ast.push(template.slice(open));
      break;
    }

    // Parse the placeholder content
    const inner = template.slice(open + 2, j).trim();
    const { name, description } = parsePlaceholder(inner);

    if (name) {
      const ph: Placeholder = { name, description, start: open, end: j + 1 };
      ast.push(ph);

      // Only keep first occurrence of each variable
      if (!seen.has(name)) {
        seen.set(name, ph);
        vars.push(ph);
      }
    }

    i = j + 1;
  }

  // Build JSON Schema from ordered unique vars
  const inputSchema: Record<string, any> = {
    type: "object",
    properties: {},
    required: [],
  };

  for (const v of vars) {
    inputSchema.properties[v.name] = {
      type: "string",
      description: v.description || `Variable: ${v.name}`,
    };
    inputSchema.required.push(v.name);
  }

  return {
    ast,
    vars,
    template,
    inputSchema,
  };
}

/**
 * Parse a single placeholder like: name, "description" or just name
 */
function parsePlaceholder(inner: string): { name: string; description?: string } {
  // Find first comma outside quotes
  let commaIdx = -1;
  let inQuotes = false;
  let escaped = false;

  for (let k = 0; k < inner.length; k++) {
    const ch = inner[k];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      commaIdx = k;
      break;
    }
  }

  let name: string;
  let description: string | undefined;

  if (commaIdx === -1) {
    name = inner.trim();
  } else {
    name = inner.slice(0, commaIdx).trim();
    const rest = inner.slice(commaIdx + 1).trim();

    // Extract quoted description
    if (rest.startsWith('"') && rest.endsWith('"') && rest.length >= 2) {
      description = rest.slice(1, -1);
    } else if (rest.length > 0) {
      description = rest;
    }
  }

  return { name, description };
}

/**
 * Substitute variables in a template AST
 */
export function renderTemplate(
  parsed: ParsedTemplate,
  variables: Record<string, string>
): string {
  let result = "";

  for (const part of parsed.ast) {
    if (typeof part === "string") {
      result += part;
    } else {
      const value = variables[part.name];
      result += value ?? `\${${part.name}, "${part.description || part.name}"}`;
    }
  }

  return result;
}
