import { describe, it, expect } from 'vitest';
import { parseTemplate, renderTemplate, parsePlaceholder, Placeholder } from './parser';

describe('Parser - Placeholder Extraction', () => {
  it('extracts simple placeholder without description', () => {
    const result = parseTemplate('run ${command}');
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('command');
    expect(result.vars[0]?.description).toBeUndefined();
  });

  it('extracts placeholder with description', () => {
    const result = parseTemplate('run ${command, "shell command"}');
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('command');
    expect(result.vars[0]?.description).toBe('shell command');
  });

  it('handles multiple placeholders', () => {
    const template = 'Connect to ${host, "hostname"} on port ${port, "port number"}';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
    expect(result.vars[0]?.name).toBe('host');
    expect(result.vars[1]?.name).toBe('port');
  });

  it('handles duplicate variables (keeps first occurrence)', () => {
    const template = '${cmd} executes ${cmd} twice';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('cmd');
  });

  it('treats unmatched braces as literal text', () => {
    const result = parseTemplate('no placeholder here ${unclosed');
    expect(result.vars).toHaveLength(0);
    // Unmatched braces are treated as valid end-of-string, so it becomes a literal
    expect(result.ast.length).toBeGreaterThan(0);
  });

  it('handles empty placeholder', () => {
    const result = parseTemplate('text ${}');
    expect(result.vars).toHaveLength(0);
  });

  it('handles placeholders with only whitespace', () => {
    const result = parseTemplate('text ${ }');
    expect(result.vars).toHaveLength(0);
  });

  it('handles escaped quotes inside description', () => {
    const template = 'convert ${text, "use \\"escaped\\" quotes"}';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.description).toContain('\\');
  });

  it('handles commas outside of quotes', () => {
    const template = 'Run ${cmd, "description"}, then wait';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('cmd');
  });

  it('preserves literal text before, after, and between placeholders', () => {
    const template = 'Start ${a, "first"} middle ${b, "second"} end';
    const result = parseTemplate(template);
    expect(result.ast).toHaveLength(5); // literal, placeholder, literal, placeholder, literal
    expect(result.ast[0]).toBe('Start ');
    expect(result.ast[2]).toBe(' middle ');
    expect(result.ast[4]).toBe(' end');
  });

  it('handles newlines in template', () => {
    const template = `Line 1 \${var1}
Line 2 \${var2}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
  });

  it('handles tab characters', () => {
    const template = 'Text\t${variable, "desc"}';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
  });
});

describe('Parser - JSON Schema Generation', () => {
  it('generates valid JSON schema for simple placeholder', () => {
    const result = parseTemplate('${cmd}');
    expect(result.inputSchema).toHaveProperty('type', 'object');
    expect(result.inputSchema).toHaveProperty('properties');
    expect(result.inputSchema).toHaveProperty('required');
    expect(result.inputSchema.required).toContain('cmd');
  });

  it('includes description in schema', () => {
    const result = parseTemplate('${cmd, "shell command"}');
    const props = result.inputSchema.properties as any;
    expect(props.cmd.description).toBe('shell command');
  });

  it('uses variable name as fallback description', () => {
    const result = parseTemplate('${cmd}');
    const props = result.inputSchema.properties as any;
    expect(props.cmd.description).toBe('Variable: cmd');
  });

  it('marks all variables as required', () => {
    const template = '${a} ${b} ${c}';
    const result = parseTemplate(template);
    expect(result.inputSchema.required).toContain('a');
    expect(result.inputSchema.required).toContain('b');
    expect(result.inputSchema.required).toContain('c');
  });

  it('sets string type for all variables', () => {
    const result = parseTemplate('${var}');
    const props = result.inputSchema.properties as any;
    expect(props.var.type).toBe('string');
  });
});

describe('Parser - Template Rendering', () => {
  it('substitutes simple variable', () => {
    const parsed = parseTemplate('run ${cmd}');
    const result = renderTemplate(parsed, { cmd: 'ls -la' });
    expect(result).toBe('run ls -la');
  });

  it('substitutes multiple variables', () => {
    const parsed = parseTemplate('Connect to ${host} port ${port}');
    const result = renderTemplate(parsed, { host: 'localhost', port: '3000' });
    expect(result).toBe('Connect to localhost port 3000');
  });

  it('handles missing variables gracefully', () => {
    const parsed = parseTemplate('${required}');
    const result = renderTemplate(parsed, {});
    expect(result).toContain('required');
  });

  it('preserves literal text in output', () => {
    const parsed = parseTemplate('prefix ${var} suffix');
    const result = renderTemplate(parsed, { var: 'VALUE' });
    expect(result).toBe('prefix VALUE suffix');
  });

  it('handles newlines in rendering', () => {
    const template = `Line 1: \${line1}
Line 2: \${line2}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { line1: 'first', line2: 'second' });
    expect(result).toContain('Line 1: first');
    expect(result).toContain('Line 2: second');
  });

  it('substitutes duplicate variable references', () => {
    const parsed = parseTemplate('${var} and ${var} again');
    const result = renderTemplate(parsed, { var: 'TEST' });
    expect(result).toBe('TEST and TEST again');
  });

  it('handles empty string values', () => {
    const parsed = parseTemplate('before ${var} after');
    const result = renderTemplate(parsed, { var: '' });
    expect(result).toBe('before  after');
  });

  it('handles special characters in values', () => {
    const parsed = parseTemplate('echo ${text}');
    const result = renderTemplate(parsed, { text: 'hello "world" & friends' });
    expect(result).toBe('echo hello "world" & friends');
  });

  it('handles newlines in substituted values', () => {
    const parsed = parseTemplate('text: ${content}');
    const result = renderTemplate(parsed, { content: 'line1\nline2' });
    expect(result).toBe('text: line1\nline2');
  });
});

describe('Parser - Edge Cases', () => {
  it('handles adjacent placeholders', () => {
    const template = '${a}${b}${c}';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(3);
  });

  it('handles placeholder at start of template', () => {
    const template = '${cmd} is running';
    const result = parseTemplate(template);
    expect(result.ast[0]).toHaveProperty('name', 'cmd');
  });

  it('handles placeholder at end of template', () => {
    const template = 'Execute: ${cmd}';
    const result = parseTemplate(template);
    const last = result.ast[result.ast.length - 1];
    expect(typeof last).toBe('object');
  });

  it('handles only placeholder', () => {
    const template = '${cmd}';
    const result = parseTemplate(template);
    expect(result.ast).toHaveLength(1);
    expect(result.vars).toHaveLength(1);
  });

  it('handles very long variable names', () => {
    const longName = 'a'.repeat(100);
    const template = `\$\{${longName}\}`;
    const result = parseTemplate(template);
    expect(result.vars[0]?.name).toBe(longName);
  });

  it('handles very long descriptions', () => {
    const longDesc = 'x'.repeat(500);
    const template = `\$\{var, "${longDesc}"\}`;
    const result = parseTemplate(template);
    expect(result.vars[0]?.description?.length).toBeGreaterThan(450);
  });

  it('handles nested dollar signs', () => {
    const template = 'price is $ ${amount} dollars';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('amount');
  });

  it('handles complex quote scenarios', () => {
    const template = 'use ${var, "description with, commas"}';
    const result = parseTemplate(template);
    expect(result.vars[0]?.description).toBe('description with, commas');
  });

  it('handles empty template', () => {
    const result = parseTemplate('');
    expect(result.vars).toHaveLength(0);
    expect(result.ast).toHaveLength(0);
  });

  it('handles only whitespace', () => {
    const result = parseTemplate('   \n  \t  ');
    expect(result.vars).toHaveLength(0);
  });
});

describe('Parser - Round Trip', () => {
  it('preserves template structure through parse and render', () => {
    const original = 'Convert ${source} to ${target}';
    const parsed = parseTemplate(original);
    const rendered = renderTemplate(parsed, { source: 'XML', target: 'JSON' });
    expect(rendered).toBe('Convert XML to JSON');
  });

  it('handles complex template round trip', () => {
    const template = `Translate from \${lang1, "source language"} to \${lang2, "target language"}:

\${text, "text to translate"}

Output format: \${format, "output format"}`;

    const parsed = parseTemplate(template);
    const rendered = renderTemplate(parsed, {
      lang1: 'English',
      lang2: 'Spanish',
      text: 'Hello world',
      format: 'plain text',
    });

    expect(rendered).toContain('English');
    expect(rendered).toContain('Spanish');
    expect(rendered).toContain('Hello world');
    expect(rendered).toContain('plain text');
  });
});
