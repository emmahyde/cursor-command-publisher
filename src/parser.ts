/**
 * Template parser that extracts #{name} placeholders from markdown with YAML frontmatter
 * Code blocks (```...```) are ignored during variable extraction.
 * ---
 * name: "description"
 * ---
 * Template content with #{name} references
 */

import YAML from "yaml";

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
 * Parse a template with YAML frontmatter and extract #{name} placeholders.
 * Code blocks (```...```) are skipped during parsing.
 * Returns AST with ordered unique variables defined in frontmatter.
 */
export function parseTemplate(content: string): ParsedTemplate {
  // Extract YAML frontmatter
  const { frontmatter, body } = extractFrontmatter(content);

  // Find all fenced code block ranges
  const codeBlockRanges = findCodeBlockRanges(body);

  const ast: Array<string | Placeholder> = [];
  const vars: Placeholder[] = [];
  const seen = new Map<string, Placeholder>();

  // Parse the body for #{name} placeholders
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("#{", i);
    if (open === -1) {
      if (i < body.length) ast.push(body.slice(i));
      break;
    }

    // Push leading literal
    if (open > i) ast.push(body.slice(i, open));

    // Find matching }
    const close = body.indexOf("}", open + 2);
    if (close === -1) {
      // Unmatched; treat as literal
      ast.push(body.slice(open));
      break;
    }

    // Check if this placeholder is inside a code block
    const isInCodeBlock = codeBlockRanges.some(
      ([start, end]) => open >= start && close < end
    );

    if (isInCodeBlock) {
      // Treat as literal text
      ast.push(body.slice(open, close + 1));
      i = close + 1;
      continue;
    }

    // Extract variable name
    const name = body.slice(open + 2, close).trim();

    if (name) {
      // Look up description from frontmatter
      const description = frontmatter[name] || undefined;

      const ph: Placeholder = { name, description, start: open, end: close + 1 };
      ast.push(ph);

      // Only keep first occurrence of each variable
      if (!seen.has(name)) {
        seen.set(name, ph);
        vars.push(ph);
      }
    }

    i = close + 1;
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
    template: content,
    inputSchema,
  };
}

/**
 * Find all fenced code block ranges (```...```) in the body.
 * Returns array of [start, end] positions.
 */
function findCodeBlockRanges(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let i = 0;

  while (i < body.length) {
    // Look for opening ```
    const openFence = body.indexOf("```", i);
    if (openFence === -1) break;

    // Look for closing ```
    const closeFence = body.indexOf("```", openFence + 3);
    if (closeFence === -1) {
      // Unclosed code block, treat rest of document as code
      ranges.push([openFence, body.length]);
      break;
    }

    ranges.push([openFence, closeFence + 3]);
    i = closeFence + 3;
  }

  return ranges;
}

/**
 * Extract YAML frontmatter from markdown content
 * Returns frontmatter object and body content
 */
function extractFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter, return empty object and full content as body
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  try {
    const parsed = YAML.parse(yamlContent);
    const frontmatter: Record<string, string> = {};

    // Ensure all values are strings
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed)) {
        frontmatter[key] = String(value);
      }
    }

    return { frontmatter, body };
  } catch (error) {
    console.error("Failed to parse YAML frontmatter:", error);
    return { frontmatter: {}, body: content };
  }
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
      result += value ?? `#{${part.name}}`;
    }
  }

  return result;
}
