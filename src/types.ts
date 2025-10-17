type Placeholder = {
  name: string;
  description?: string;
  start: number;
  end: number;
  optional: boolean;
};

type ParsedTemplate = {
  ast: Array<string | Placeholder>;
  vars: Placeholder[];
  template: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: 'string'; description: string }>;
    required: string[];
  };
};

interface RegisteredTool {
  name: string;
  description: string;
  parsed: ParsedTemplate;
}

export type { RegisteredTool, ParsedTemplate, Placeholder };
