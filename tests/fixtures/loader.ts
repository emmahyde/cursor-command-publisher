import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesPath = path.join(__dirname, 'templates.json');

type TemplateFixture = {
  template: string;
  vars?: Record<string, string>;
  expected?: string;
  varsWithAll?: Record<string, string>;
  varsEmpty?: Record<string, string>;
  v1?: TemplateFixture;
  v2?: TemplateFixture;
};

type TemplateFixtures = {
  [category: string]: {
    [name: string]: TemplateFixture;
  };
};

let cachedTemplates: TemplateFixtures | null = null;

export function loadTemplates(): TemplateFixtures {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const content = fs.readFileSync(templatesPath, 'utf-8');
  cachedTemplates = JSON.parse(content);
  return cachedTemplates!;
}

export function getTemplate(category: string, name: string): TemplateFixture {
  const templates = loadTemplates();
  const fixture = templates[category]?.[name];

  if (!fixture) {
    throw new Error(`Template not found: ${category}.${name}`);
  }

  return fixture;
}
