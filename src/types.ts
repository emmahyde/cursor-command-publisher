type Placeholder = {
  type: 'placeholder';
  name: string;
  description?: string;
  start?: number;
  end?: number;
  optional: boolean;
};

type ConditionalBlock = {
  type: 'block';
  variable: string;
  content: ASTNode[];
};

type ASTNode = string | Placeholder | ConditionalBlock;

type ParsedTemplate = {
  ast: ASTNode[];
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

export type {
  RegisteredTool,
  ParsedTemplate,
  Placeholder,
  ConditionalBlock,
  ASTNode,
};
