# Prompt Templates

This directory contains prompt templates organized by model family. Each model family uses a different prompt format.

## Directory Structure

```
prompts/
├── phi-3/          # Phi-3 models (uses ChatML format)
├── llama/          # Llama/Mistral models (uses Llama format)
├── claude/         # Claude models (plain text)
├── generic/        # Generic format (fallback)
└── README.md       # This file
```

## Model-Specific Formats

### Phi-3 (ChatML Format)

Phi-3 uses the ChatML format with special tokens:

```
<|system|>
System instructions here
<|end|>
<|user|>
User input here<|end|>
<|assistant|>
Model response starts here
```

### Llama/Mistral

Llama models use this format:

```
[INST] <<SYS>>
System instructions
<</SYS>>

User input [/INST]
Model response
```

### Claude

Claude uses plain text without special tokens:

```
System instructions

User input
```

### Generic

Simple format for models without specific requirements:

```
Instructions

INPUT:
Content here
```

## How It Works

The test script automatically detects the model family based on the model name:

- `phi-3-mini` → Uses `prompts/phi-3/`
- `llama-3` → Uses `prompts/llama/`
- `claude-sonnet` → Uses `prompts/claude/`
- Others → Uses `prompts/generic/`

If a prompt doesn't exist in the model-specific folder, it falls back to `prompts/generic/`.

## Template Variables

All prompts support these placeholders:

- `{{NOTE_LIST}}` - Replaced with list of available note names
- `{{CONTENT}}` - Replaced with the input note content

## Creating New Prompts

1. **For a specific model:**
   ```bash
   # Create in model-specific folder
   touch prompts/phi-3/my-new-prompt.txt
   ```

2. **For all models:**
   ```bash
   # Create in generic folder
   touch prompts/generic/my-new-prompt.txt

   # Optionally create model-specific versions
   # that use the correct format for each model
   ```

## Testing Prompts

```bash
# Phi-3 with baseline prompt (uses phi-3/baseline.txt)
npm run test:voice-processor -- --lmstudio --model phi-3-mini --prompt baseline.txt

# Llama with concise prompt (uses llama/concise.txt or generic/concise.txt)
npm run test:voice-processor -- --lmstudio --model llama-3 --prompt concise.txt

# Claude via API (uses claude/baseline.txt)
npm run test:voice-processor -- --model claude-sonnet --prompt baseline.txt
```

## Prompt Variations

Current prompt variations available:

- **baseline.txt** - Current production prompt (detailed rules)
- **concise.txt** - Simplified, shorter instructions
- **explicit-examples.txt** - More example patterns
- **step-by-step.txt** - Numbered procedural steps
- **context-aware.txt** - Emphasizes understanding context
- **pattern-focused.txt** - Specific pattern matching
- **chain-of-thought.txt** - Asks LLM to think before answering

## Best Practices

1. **Keep model-specific formatting minimal** - Only add special tokens, don't change the content
2. **Test with the actual model** - Different models may interpret prompts differently
3. **Start from generic** - Copy `generic/baseline.txt` and adapt for your model
4. **Document model requirements** - If a model needs specific formatting, document it here

## Adding Support for New Models

1. Update `test-voice-processor.ts` `detectModelFamily()` method
2. Create a new folder: `prompts/new-model/`
3. Copy prompts from `generic/` and adapt format
4. Test with: `npm run test:voice-processor -- --lmstudio --model new-model`
