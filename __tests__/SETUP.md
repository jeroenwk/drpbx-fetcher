# Voice Notes Testing System - Setup Guide

## Recommended: Claude Code Interactive (No Extra Cost!)

Since you have Claude Code Pro, you can test prompts directly without any API setup.

### Quick Start

**Step 1: Ask Claude Code to test a prompt**

Copy this to Claude Code:
```
Test the Voice Notes prompt system:

1. Read __tests__/prompts/baseline.txt
2. Get note list from __tests__/samples/reference_notes/
3. Process all files in __tests__/samples/dictation_input/

For each file:
- Build full prompt (replace {{NOTE_LIST}} and {{CONTENT}})
- Process following prompt instructions exactly
- Save to __tests__/samples/dictation_output/
- Include YAML metadata (testCase, model, prompt, expectedLinks, actualLinks)

Process all 15 files.
```

**Step 2: Analyze the results**

```bash
npm run analyze:voice-quality
cat __tests__/quality-summary.md
```

**Step 3: Iterate**

Create improved prompts and test again!

**👉 Full guide:** [CLAUDE_CODE_USAGE.md](./CLAUDE_CODE_USAGE.md)

---

## Alternative: Automated Testing (Requires API Key)

If you want fully automated testing (costs ~$0.10-0.20 per run):

### 1. Install Dependencies

Already done! The following packages were installed:
- `@anthropic-ai/sdk` - Claude API client
- `js-yaml` - YAML parsing
- `ts-node` - TypeScript execution
- `@types/js-yaml` - TypeScript types

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key from: https://console.anthropic.com/

### 3. Run Your First Test

```bash
npm run test:voice-processor
```

This will:
- Process all 15 test samples
- Test the baseline prompt
- Use Claude 3.5 Haiku (fast & cheap)
- Save results to `__tests__/samples/dictation_output/`

### 4. Analyze Results

```bash
npm run analyze:voice-quality
```

This generates:
- `__tests__/quality-report.json` - Raw metrics
- `__tests__/quality-summary.md` - Human-readable summary

## What Was Created

### Test Infrastructure

- **15 test samples** in `dictation_input/` covering:
  - Basic link requests
  - Natural mentions
  - Edge cases (partial names, non-existent notes)
  - Complex scenarios (multiple mentions, technical content)

- **7 prompt variations** in `prompts/`:
  - `baseline.txt` - Current production prompt
  - `concise.txt` - Simplified version
  - `explicit-examples.txt` - More examples
  - `step-by-step.txt` - Procedural steps
  - `context-aware.txt` - Context emphasis
  - `pattern-focused.txt` - Pattern matching
  - `chain-of-thought.txt` - Reasoning first

- **8 reference notes** in `reference_notes/`:
  - Mock vault for fuzzy matching tests
  - Includes similar names for ambiguity testing

### Scripts

- `test-voice-processor.ts` - Main test runner
  - CLI arguments: `--model`, `--prompt`, `--input`
  - Processes samples with LLM
  - Post-processes with fuzzy matching
  - Saves annotated outputs

- `analyze-quality.ts` - Quality analyzer
  - Calculates precision, recall, F1 scores
  - Checks preservation (YAML, content, formatting)
  - Generates recommendations
  - Creates comparative reports

### Documentation

- `README.md` - Complete usage guide
- `SETUP.md` - This file
- `.env.example` - Environment template

## Next Steps

### Test Different Prompts

```bash
npm run test:voice-processor -- --prompt concise.txt
npm run test:voice-processor -- --prompt explicit-examples.txt
npm run analyze:voice-quality
```

### Compare Models

```bash
# Fast & cheap
npm run test:voice-processor -- --model phi-3-mini

# Better quality
npm run test:voice-processor -- --model gemma-2

# Best quality
npm run test:voice-processor -- --model mistral-small
```

### Add Your Own Test Cases

Create a new file in `__tests__/samples/dictation_input/`:

```markdown
---
tags:
  - dictation
testCase: my-test
expectedLinks:
  - SomeNote
difficulty: medium
---

Your test content here...
```

Then run tests again.

### Iterate on Prompts

1. Copy a prompt: `cp prompts/baseline.txt prompts/improved-v1.txt`
2. Edit: Make your changes
3. Test: `npm run test:voice-processor -- --prompt improved-v1.txt`
4. Analyze: `npm run analyze:voice-quality`
5. Compare: Check if score improved
6. Repeat!

## Scoring Guide

Scores are out of 80 points:
- **40 pts**: Correctness (F1 score)
- **30 pts**: Preservation (YAML, content, formatting)
- **10 pts**: Link request cleanup

**Targets:**
- **70-80**: Production ready ✓
- **60-69**: Good, minor tweaks needed
- **50-59**: Fair, needs work
- **<50**: Poor, major issues

## Cost Estimates

Using Claude 3.5 Haiku:
- ~$0.25 per input token / million
- ~$1.25 per output token / million

Running all 15 tests:
- ~$0.10-$0.20 per full test run
- Very affordable for iteration!

## Troubleshooting

**"ANTHROPIC_API_KEY environment variable required"**
→ Create `.env` file with your API key

**"Input directory not found"**
→ Run from project root: `cd /Users/jeroendezwart/perso/drpbx-fetcher`

**Type errors during compilation**
→ Already fixed! TypeScript compatibility issues resolved.

**No outputs generated**
→ Check API key is valid and has credits

## Files to Commit

Commit these:
- `__tests__/samples/dictation_input/*.md` (test cases)
- `__tests__/samples/reference_notes/*.md` (reference vault)
- `__tests__/prompts/*.txt` (prompt variations)
- `__tests__/scripts/*.ts` (test scripts)
- `__tests__/lib/*.ts` (utilities)
- `__tests__/README.md`, `__tests__/SETUP.md` (docs)
- `.env.example` (template)
- `.gitignore` updates

Don't commit:
- `__tests__/samples/dictation_output/` (generated)
- `__tests__/quality-report.json` (generated)
- `__tests__/quality-summary.md` (generated)
- `.env` (contains secrets)

Already configured in `.gitignore` ✓

## Ready to Go!

Everything is set up and ready. Just add your API key and run:

```bash
export ANTHROPIC_API_KEY="your-key-here"
npm run test:voice-processor
npm run analyze:voice-quality
```

Happy prompt testing! 🎯
