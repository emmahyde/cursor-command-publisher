import { describe, it, expect } from 'vitest';
import { parseTemplate, renderTemplate } from '../src/parser.ts';

describe('Parser - YAML Frontmatter Extraction', () => {
  it('extracts simple placeholder with frontmatter description', () => {
    const template = `---
command: "shell command to run"
---
run #{command}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('command');
    expect(result.vars[0]?.description).toBe('shell command to run');
  });

  it('treats placeholder without frontmatter as literal text', () => {
    const result = parseTemplate('run #{command}');
    expect(result.vars).toHaveLength(0); // No variables without frontmatter
    expect(result.ast).toContain('#{command}'); // Kept as literal
  });

  it('handles multiple placeholders with frontmatter', () => {
    const template = `---
host: "hostname to connect to"
port: "port number"
---
Connect to #{host} on port #{port}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
    expect(result.vars[0]?.name).toBe('host');
    expect(result.vars[0]?.description).toBe('hostname to connect to');
    expect(result.vars[1]?.name).toBe('port');
    expect(result.vars[1]?.description).toBe('port number');
  });

  it('handles duplicate variables (keeps first occurrence)', () => {
    const template = `---
cmd: "command to execute"
---
#{cmd} executes #{cmd} twice`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('cmd');
  });

  it('handles variables not defined in frontmatter', () => {
    const template = `---
defined: "this is defined"
---
#{defined} and #{undefined_var}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1); // Only 'defined' is a variable
    expect(result.vars[0]?.name).toBe('defined');
    expect(result.vars[0]?.description).toBe('this is defined');
    expect(result.ast).toContain('#{undefined_var}'); // Kept as literal
  });

  it('handles empty frontmatter', () => {
    const template = `---
---
text #{variable}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(0); // No variables defined
    expect(result.ast).toContain('#{variable}'); // Kept as literal
  });

  it('handles template without frontmatter', () => {
    const template = 'no frontmatter #{var}';
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(0); // No frontmatter = no variables
    expect(result.ast).toContain('#{var}'); // Kept as literal
  });

  it('preserves literal text before, after, and between placeholders', () => {
    const template = `---
a: "first"
b: "second"
---
Start #{a} middle #{b} end`;
    const result = parseTemplate(template);
    expect(result.ast).toHaveLength(5); // literal, placeholder, literal, placeholder, literal
    expect(result.ast[0]).toBe('Start ');
    expect(result.ast[2]).toBe(' middle ');
    expect(result.ast[4]).toBe(' end');
  });

  it('handles newlines in template body', () => {
    const template = `---
var1: "first variable"
var2: "second variable"
---
Line 1 #{var1}
Line 2 #{var2}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
  });

  it('handles multiline YAML values', () => {
    const template = `---
description: "This is a long
  multiline description"
---
#{description}`;
    const result = parseTemplate(template);
    expect(result.vars[0]?.description).toContain('long');
  });
});

describe('Parser - JSON Schema Generation', () => {
  it('generates valid JSON schema for simple placeholder', () => {
    const template = `---
cmd: "shell command"
---
#{cmd}`;
    const result = parseTemplate(template);
    expect(result.inputSchema).toHaveProperty('type', 'object');
    expect(result.inputSchema).toHaveProperty('properties');
    expect(result.inputSchema).toHaveProperty('required');
    expect(result.inputSchema.required).toContain('cmd');
  });

  it('includes description from frontmatter in schema', () => {
    const template = `---
cmd: "shell command to execute"
---
#{cmd}`;
    const result = parseTemplate(template);
    const props = result.inputSchema.properties as any;
    expect(props.cmd.description).toBe('shell command to execute');
  });

  it('uses variable name as fallback description', () => {
    // Empty string value means no description, so fallback is used
    const template = `---
cmd: ""
---
#{cmd}`;
    const result = parseTemplate(template);
    const props = result.inputSchema.properties as any;
    expect(props.cmd.description).toBe('Variable: cmd');
  });

  it('marks all variables as required', () => {
    const template = `---
a: "first"
b: "second"
c: "third"
---
#{a} #{b} #{c}`;
    const result = parseTemplate(template);
    expect(result.inputSchema.required).toContain('a');
    expect(result.inputSchema.required).toContain('b');
    expect(result.inputSchema.required).toContain('c');
  });

  it('sets string type for all variables', () => {
    const template = `---
variable: "description"
---
#{variable}`;
    const result = parseTemplate(template);
    const props = result.inputSchema.properties as any;
    expect(props.variable.type).toBe('string');
  });
});

describe('Parser - Template Rendering', () => {
  it('substitutes simple variable', () => {
    const parsed = parseTemplate(`---
cmd: "command to run"
---
run #{cmd}`);
    const result = renderTemplate(parsed, { cmd: 'ls -la' });
    expect(result).toContain('ls -la');
  });

  it('substitutes multiple variables', () => {
    const parsed = parseTemplate(`---
host: "hostname"
port: "port number"
---
Connect to #{host} port #{port}`);
    const result = renderTemplate(parsed, { host: 'localhost', port: '3000' });
    expect(result).toContain('localhost');
    expect(result).toContain('3000');
  });

  it('handles missing variables gracefully', () => {
    const parsed = parseTemplate(`---
required: "required value"
---
#{required}`);
    const result = renderTemplate(parsed, {});
    expect(result).toContain('required');
  });

  it('preserves literal text in output', () => {
    const parsed = parseTemplate(`---
myvar: "value"
---
prefix #{myvar} suffix`);
    const result = renderTemplate(parsed, { myvar: 'VALUE' });
    expect(result).toContain('prefix VALUE suffix');
  });

  it('handles newlines in rendering', () => {
    const template = `---
line1: "first line"
line2: "second line"
---
Line 1: #{line1}
Line 2: #{line2}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { line1: 'first', line2: 'second' });
    expect(result).toContain('Line 1: first');
    expect(result).toContain('Line 2: second');
  });

  it('substitutes duplicate variable references', () => {
    const parsed = parseTemplate(`---
myvar: "test variable"
---
#{myvar} and #{myvar} again`);
    const result = renderTemplate(parsed, { myvar: 'TEST' });
    expect(result).toContain('TEST and TEST again');
  });

  it('handles empty string values', () => {
    const parsed = parseTemplate(`---
myvar: "test variable"
---
before #{myvar} after`);
    const result = renderTemplate(parsed, { myvar: '' });
    expect(result).toBe('before  after');
  });

  it('handles special characters in values', () => {
    const parsed = parseTemplate(`---
text: "text content"
---
echo #{text}`);
    const result = renderTemplate(parsed, { text: 'hello "world" & friends' });
    expect(result).toBe('echo hello "world" & friends');
  });

  it('handles newlines in substituted values', () => {
    const parsed = parseTemplate(`---
content: "content text"
---
text: #{content}`);
    const result = renderTemplate(parsed, { content: 'line1\nline2' });
    expect(result).toBe('text: line1\nline2');
  });
});

describe('Parser - Edge Cases', () => {
  it('handles adjacent placeholders', () => {
    const template = `---
a: "first"
b: "second"
c: "third"
---
#{a}#{b}#{c}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(3);
  });

  it('handles placeholder at start of template', () => {
    const template = `---
cmd: "command"
---
#{cmd} is running`;
    const result = parseTemplate(template);
    const firstNonLiteral = result.ast.find(part => typeof part !== 'string');
    expect(firstNonLiteral).toHaveProperty('name', 'cmd');
  });

  it('handles placeholder at end of template', () => {
    const template = `---
cmd: "command"
---
Execute: #{cmd}`;
    const result = parseTemplate(template);
    const last = result.ast[result.ast.length - 1];
    expect(typeof last).toBe('object');
  });

  it('handles only placeholder', () => {
    const template = `---
cmd: "command"
---
#{cmd}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
  });

  it('handles very long variable names', () => {
    const longName = 'a'.repeat(100);
    const template = `---
${longName}: "description"
---
#{${longName}}`;
    const result = parseTemplate(template);
    expect(result.vars[0]?.name).toBe(longName);
  });

  it('handles nested dollar signs', () => {
    const template = `---
amount: "dollar amount"
---
price is $ #{amount} dollars`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('amount');
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

  it('handles YAML with special characters', () => {
    const template = `---
myvar: 'description with: colons, commas, and "quotes"'
---
#{myvar}`;
    const result = parseTemplate(template);
    expect(result.vars[0]?.description).toContain('colons');
  });
});

describe('Parser - Round Trip', () => {
  it('preserves template structure through parse and render', () => {
    const original = `---
source: "source format"
target: "target format"
---
Convert #{source} to #{target}`;
    const parsed = parseTemplate(original);
    const rendered = renderTemplate(parsed, { source: 'XML', target: 'JSON' });
    expect(rendered).toContain('Convert XML to JSON');
  });

  it('handles complex template round trip', () => {
    const template = `---
lang1: "source language"
lang2: "target language"
text: "text to translate"
format: "output format"
---
Translate from #{lang1} to #{lang2}:

#{text}

Output format: #{format}`;

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

describe('Parser - Frontmatter-Only Variables', () => {
  it('treats undefined placeholders as literal text in code blocks', () => {
    const template = `---
name: "person's name"
---
Hello #{name}!

Here's an example:
\`\`\`
#{variable} <- this is literal because not in frontmatter
\`\`\`

Goodbye #{name}!`;

    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('name');
    expect(result.ast.join('')).toContain('#{variable}');
  });

  it('distinguishes defined vs undefined placeholders', () => {
    const template = `---
realVar: "actual variable"
---
Use #{realVar} here and #{notDefined} stays literal.`;

    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('realVar');

    const rendered = renderTemplate(result, { realVar: 'VALUE' });
    expect(rendered).toContain('Use VALUE here');
    expect(rendered).toContain('#{notDefined} stays literal');
  });

  it('allows placeholder syntax in examples without frontmatter collision', () => {
    const template = `---
name: "person's name"
---
Hello #{name}!

Example usage: #{example}`;

    const parsed = parseTemplate(template);
    const rendered = renderTemplate(parsed, { name: 'Alice' });

    expect(rendered).toContain('Hello Alice!');
    expect(rendered).toContain('#{example}'); // Literal because not in frontmatter
  });
});

describe('Parser - Optional Parameters', () => {
  it('parses optional placeholder with ? syntax in body', () => {
    const template = `---
name: "person's name"
suffix?: "optional title/suffix"
---
Hello #{name}#{suffix?}!`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
    expect(result.vars[0]?.name).toBe('name');
    expect(result.vars[0]?.optional).toBe(false);
    expect(result.vars[1]?.name).toBe('suffix');
    expect(result.vars[1]?.optional).toBe(true);
  });

  it('parses optional field with ?:  syntax in frontmatter', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
#{title?}#{name}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(2);
    const titleVar = result.vars.find(v => v.name === 'title');
    expect(titleVar?.optional).toBe(true);
    const nameVar = result.vars.find(v => v.name === 'name');
    expect(nameVar?.optional).toBe(false);
  });

  it('treats optional field with empty string as intentionally null', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
Hello #{title?}#{name}!`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { name: 'Emma', title: '' });
    expect(result).toBe('Hello Emma!');
  });

  it('renders optional field with provided value', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
Hello #{title?}#{name}!`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { name: 'Emma', title: 'Dr. ' });
    expect(result).toBe('Hello Dr. Emma!');
  });

  it('renders optional field when omitted from arguments', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
Hello #{title?}#{name}!`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { name: 'Emma' });
    expect(result).toBe('Hello #{title}Emma!');
  });

  it('marks optional fields as not required in JSON schema', () => {
    const template = `---
required: "required field"
optional?: "optional field"
---
#{required} #{optional?}`;
    const result = parseTemplate(template);
    expect(result.inputSchema.required).toContain('required');
    expect(result.inputSchema.required).not.toContain('optional');
    expect(result.inputSchema.properties).toHaveProperty('required');
    expect(result.inputSchema.properties).toHaveProperty('optional');
  });

  it('handles multiple optional fields', () => {
    const template = `---
name: "person's name"
title?: "optional title"
suffix?: "optional suffix"
---
#{title?}#{name}#{suffix?}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(3);
    expect(result.inputSchema.required).toEqual(['name']);
    expect(result.inputSchema.required).not.toContain('title');
    expect(result.inputSchema.required).not.toContain('suffix');
  });

  it('handles mix of required and optional with empty strings', () => {
    const template = `---
greeting: "greeting text"
title?: "optional title"
name: "person's name"
suffix?: "optional suffix"
---
#{greeting} #{title?}#{name}#{suffix?}!`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, {
      greeting: 'Hello',
      title: '',
      name: 'Emma',
      suffix: '',
    });
    expect(result).toBe('Hello Emma!');
  });

  it('handles optional with value and empty optional together', () => {
    const template = `---
title?: "optional title"
name: "person's name"
suffix?: "optional suffix"
---
#{title?}#{name}#{suffix?}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, {
      title: 'Dr. ',
      name: 'Emma',
      suffix: '',
    });
    expect(result).toBe('Dr. Emma');
  });

  it('allows optional in frontmatter without ? in placeholder', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
Hello #{title}#{name}!`;
    const result = parseTemplate(template);
    const titleVar = result.vars.find(v => v.name === 'title');
    expect(titleVar?.optional).toBe(true);
  });

  it('requires ? in placeholder for optional detection from body', () => {
    const template = `---
name: "person's name"
title: "title"
---
Hello #{name}#{title?}!`;
    const result = parseTemplate(template);
    const nameVar = result.vars.find(v => v.name === 'name');
    const titleVar = result.vars.find(v => v.name === 'title');

    // name is not optional (no ? in placeholder)
    expect(nameVar?.optional).toBe(false);

    // title is optional because of ? in placeholder
    expect(titleVar?.optional).toBe(true);
  });

  it('combines frontmatter optional with placeholder optional', () => {
    const template = `---
name: "person's name"
title?: "optional title"
---
Hello #{title?}#{name}!`;
    const result = parseTemplate(template);
    const titleVar = result.vars.find(v => v.name === 'title');
    expect(titleVar?.optional).toBe(true);
  });

  it('treats non-empty string as valid value for optional', () => {
    const template = `---
prefix?: "optional prefix"
name: "person's name"
---
#{prefix?}#{name}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, {
      prefix: 'Ms. ',
      name: 'Emma Hyde',
    });
    expect(result).toBe('Ms. Emma Hyde');
  });

  it('handles optional fields in complex template', () => {
    const template = `---
topic: "topic of the article"
path: "location to entrypoint file"
authorPrefix?: "text before author"
author?: "author name"
datePrefix?: "text before date"
date?: "publication date"
---
# #{topic}

Documentation for #{path}#{authorPrefix?}#{author?}#{datePrefix?}#{date?}`;

    const parsed = parseTemplate(template);

    // Test with all fields provided
    const withAll = renderTemplate(parsed, {
      topic: 'Testing',
      path: '/src/test.ts',
      authorPrefix: '\n\nAuthor: ',
      author: 'Emma Hyde',
      datePrefix: '\n\nDate: ',
      date: '2025-10-17',
    });
    expect(withAll).toContain('Author: Emma Hyde');
    expect(withAll).toContain('Date: 2025-10-17');

    // Test with empty optional fields (intentionally null)
    const withoutOptional = renderTemplate(parsed, {
      topic: 'Testing',
      path: '/src/test.ts',
      authorPrefix: '',
      author: '',
      datePrefix: '',
      date: '',
    });
    expect(withoutOptional).not.toContain('Author:');
    expect(withoutOptional).not.toContain('Date:');
  });
});

describe('Parser - Conditional Blocks', () => {
  it('parses simple conditional block', () => {
    const template = `---
author?: "author name"
---
# Documentation

#{?author}
Author: #{author}
#{/author}`;
    const result = parseTemplate(template);
    expect(result.vars).toHaveLength(1);
    expect(result.vars[0]?.name).toBe('author');
    expect(result.vars[0]?.optional).toBe(true);
  });

  it('renders block when variable has value', () => {
    const template = `---
author?: "author name"
---
# Documentation
#{?author}
Author: #{author}
#{/author}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { author: 'Emma Hyde' });
    expect(result).toContain('Author: Emma Hyde');
  });

  it('skips block when variable is empty', () => {
    const template = `---
author?: "author name"
---
# Documentation
#{?author}
Author: #{author}
#{/author}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { author: '' });
    expect(result).not.toContain('Author:');
    expect(result).toBe('# Documentation\n');
  });

  it('skips block when variable is omitted', () => {
    const template = `---
author?: "author name"
---
# Documentation
#{?author}
Author: #{author}
#{/author}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, {});
    expect(result).not.toContain('Author:');
  });

  it('handles multiple blocks', () => {
    const template = `---
author?: "author name"
date?: "publication date"
---
# Documentation
#{?author}
Author: #{author}
#{/author}
#{?date}
Date: #{date}
#{/date}`;
    const parsed = parseTemplate(template);

    // Both provided
    const withBoth = renderTemplate(parsed, {
      author: 'Emma',
      date: '2025-10-17',
    });
    expect(withBoth).toContain('Author: Emma');
    expect(withBoth).toContain('Date: 2025-10-17');

    // Only author
    const onlyAuthor = renderTemplate(parsed, { author: 'Emma', date: '' });
    expect(onlyAuthor).toContain('Author: Emma');
    expect(onlyAuthor).not.toContain('Date:');

    // Neither
    const neither = renderTemplate(parsed, { author: '', date: '' });
    expect(neither).not.toContain('Author:');
    expect(neither).not.toContain('Date:');
  });

  it('handles nested placeholders inside blocks', () => {
    const template = `---
section?: "section name"
topic: "main topic"
---
Main: #{topic}
#{?section}
Section: #{section} for #{topic}
#{/section}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, {
      section: 'Advanced',
      topic: 'Testing',
    });
    expect(result).toContain('Main: Testing');
    expect(result).toContain('Section: Advanced for Testing');
  });

  it('handles block end with explicit variable name', () => {
    const template = `---
author?: "author name"
---
#{?author}
Author: #{author}
#{/author}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { author: 'Emma' });
    expect(result).toContain('Author: Emma');
  });

  it('handles block end with just #{/}', () => {
    const template = `---
author?: "author name"
---
#{?author}
Author: #{author}
#{/}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { author: 'Emma' });
    expect(result).toContain('Author: Emma');
  });

  it('treats mismatched block end as literal', () => {
    const template = `---
author?: "author name"
---
#{?author}
Content
#{/wrongname}`;
    const parsed = parseTemplate(template);
    const result = renderTemplate(parsed, { author: 'Emma' });
    // Mismatched end tag should be treated as literal
    expect(result).toContain('#{/wrongname}');
  });

  it('treats unclosed block as warning', () => {
    const template = `---
author?: "author name"
---
#{?author}
Content without closing tag`;
    // Should not throw, but may log warning
    expect(() => parseTemplate(template)).not.toThrow();
  });

  it('handles block without defined variable in frontmatter', () => {
    const template = `---
name: "person name"
---
#{?undefined}
This should work
#{/undefined}
Hello #{name}`;
    const parsed = parseTemplate(template);
    // Block creates implicit optional variable
    const undefinedVar = parsed.vars.find(v => v.name === 'undefined');
    expect(undefinedVar).toBeDefined();
    expect(undefinedVar?.optional).toBe(true);
  });

  it('handles blocks with whitespace', () => {
    const template = `---
note?: "optional note"
---
Main content
#{?note}

Note: #{note}

#{/note}
End`;
    const parsed = parseTemplate(template);
    const withNote = renderTemplate(parsed, { note: 'Important!' });
    expect(withNote).toContain('Note: Important!');

    const withoutNote = renderTemplate(parsed, { note: '' });
    expect(withoutNote).not.toContain('Note:');
    expect(withoutNote).toContain('Main content');
    expect(withoutNote).toContain('End');
  });

  it('renders complex documentation template', () => {
    const template = `---
title: "document title"
author?: "author name"
version?: "version number"
---
# #{title}

#{?author}
## Author Information
Written by: #{author}
#{/author}

#{?version}
## Version
Version: #{version}
#{/version}

## Content
Main documentation here.`;

    const parsed = parseTemplate(template);

    const full = renderTemplate(parsed, {
      title: 'API Documentation',
      author: 'Emma Hyde',
      version: '1.0.0',
    });
    expect(full).toContain('# API Documentation');
    expect(full).toContain('Written by: Emma Hyde');
    expect(full).toContain('Version: 1.0.0');

    const minimal = renderTemplate(parsed, {
      title: 'API Documentation',
      author: '',
      version: '',
    });
    expect(minimal).toContain('# API Documentation');
    expect(minimal).not.toContain('Author Information');
    expect(minimal).not.toContain('Version:');
    expect(minimal).toContain('Main documentation here');
  });
});
