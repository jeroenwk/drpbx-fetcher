# Voice Notes Prompt Testing & Improvement System

A comprehensive testing framework for evaluating and improving the LLM prompt used in the Voice Notes processor.

## Overview

This system helps you:
- Test different prompt variations against diverse voice note samples
- Measure prompt quality with automated scoring
- Iteratively improve prompts based on data-driven insights
- **Works directly with Claude Code Pro** (no extra API costs!)

## Quick Start (Recommended: Claude Code Interactive)

### 1. Test a Prompt

Ask Claude Code:
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

### 2. Analyze Results

```bash
npm run analyze:voice-quality
cat __tests__/quality-summary.md
```

### 3. Iterate

Based on the analysis, create improved prompts and test again.

**👉 See [CLAUDE_CODE_USAGE.md](./CLAUDE_CODE_USAGE.md) for detailed interactive guide**

## Alternative: Automated Testing (Requires API Key)

If you prefer automated testing:

### 1. Setup

Install dependencies (already done):
```bash
npm install
```

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 2. Run Tests

Test with the baseline prompt:
```bash
npm run test:voice-processor
```

Test with a different prompt:
```bash
npm run test:voice-processor -- --prompt concise.txt
```

### 3. Analyze Results

```bash
npm run analyze:voice-quality
```

This generates:
- `__tests__/quality-report.json` - Detailed metrics
- `__tests__/quality-summary.md` - Human-readable summary

## Directory Structure

```
__tests__/
├── README.md                          # This file
├── samples/
│   ├── dictation_input/              # Test input files
│   │   ├── 01-simple-link-request.md
│   │   ├── 02-natural-mention.md
│   │   └── ...
│   ├── dictation_output/             # Generated outputs (gitignored)
│   └── reference_notes/              # Mock vault notes
│       ├── ProjectName.md
│       ├── WatchNote.md
│       └── ...
├── prompts/                          # Prompt variations
│   ├── baseline.txt                  # Current production prompt
│   ├── concise.txt                   # Simplified version
│   ├── explicit-examples.txt         # More examples
│   └── ...
├── scripts/                          # Test & analysis scripts
│   ├── test-voice-processor.ts
│   └── analyze-quality.ts
└── lib/                              # Utilities
    └── TerminalLLMClient.ts          # API wrapper
```

## Test Samples

### Input Files

Each test sample includes:
- **YAML frontmatter** with `expectedLinks` array
- **Test case ID** and difficulty level
- **Body content** representing dictation

Example:
```markdown
---
tags:
  - dictation
testCase: simple-link-request
expectedLinks:
  - ProjectName
difficulty: easy
---

I need to work on the new feature. Link to ProjectName.
```

### Test Categories

1. **Basic Reference Tests** (01-05)
   - Simple link requests
   - Natural mentions
   - Multiple references

2. **Edge Cases** (10-15)
   - No references (control)
   - Partial name matching
   - Non-existent notes
   - YAML variations

3. **Complex Scenarios** (20-24)
   - Context-heavy paragraphs
   - Multiple mentions of same note
   - Mixed request styles
   - Technical content

### Adding New Test Cases

Create a new file in `__tests__/samples/dictation_input/`:

```markdown
---
tags:
  - dictation
testCase: your-test-name
expectedLinks:
  - NoteName1
  - NoteName2
difficulty: easy|medium|hard
---

Your test content here...
```

## Prompts

### Available Prompts

- **baseline.txt** - Current production prompt
- **concise.txt** - Simplified, shorter instructions
- **explicit-examples.txt** - More example patterns
- **step-by-step.txt** - Numbered procedural steps
- **context-aware.txt** - Emphasizes understanding context
- **pattern-focused.txt** - Specific pattern matching
- **chain-of-thought.txt** - Asks LLM to think before answering

### Creating New Prompts

1. Create a new file in `__tests__/prompts/`
2. Use placeholders:
   - `{{NOTE_LIST}}` - Replaced with available notes
   - `{{CONTENT}}` - Replaced with input note content
3. Test it:
   ```bash
   npm run test:voice-processor -- --prompt your-prompt.txt
   ```

## Scoring System

### Metrics

**Correctness (40 points max)**
- **Precision**: Correct links / Total links added
- **Recall**: Correct links / Expected links
- **F1 Score**: Harmonic mean of precision and recall

**Preservation (30 points max)**
- **YAML Preserved** (10 pts): Frontmatter unchanged
- **Content Preserved** (10 pts): No information added/removed
- **Formatting Preserved** (10 pts): Structure unchanged

**Quality (10 points max)**
- **Link Request Removal**: Explicit requests cleaned up

**Total Score**: 80 points

### Interpreting Scores

- **70-80**: Excellent - Production ready
- **60-69**: Good - Minor improvements needed
- **50-59**: Fair - Significant issues to address
- **<50**: Poor - Major revisions required

## Workflow

### Iterative Improvement Process

1. **Baseline Test**
   ```bash
   npm run test:voice-processor
   npm run analyze:voice-quality
   ```

2. **Review Results**
   - Check `quality-summary.md`
   - Identify low-scoring test cases
   - Note common failure patterns

3. **Hypothesize Improvements**
   - What patterns does the prompt miss?
   - Are instructions unclear?
   - Do we need more examples?

4. **Create New Prompt**
   - Copy best existing prompt
   - Make targeted changes
   - Save as new file

5. **Test & Compare**
   ```bash
   npm run test:voice-processor -- --prompt improved.txt
   npm run analyze:voice-quality
   ```

6. **Iterate**
   - Repeat until satisfied
   - Update production prompt when ready

### Example Session

```bash
# Test baseline
npm run test:voice-processor -- --prompt baseline.txt
npm run analyze:voice-quality
# → Average score: 62.5/80
# → Issue: Low recall on natural mentions

# Create improved prompt (add more examples of natural mentions)
cp __tests__/prompts/baseline.txt __tests__/prompts/improved-v1.txt
# ... edit improved-v1.txt ...

# Test improvement
npm run test:voice-processor -- --prompt improved-v1.txt
npm run analyze:voice-quality
# → Average score: 71.2/80
# → Much better!

# Update production if satisfied
cp __tests__/prompts/improved-v1.txt src/processors/VoiceNotesProcessor/services/TextRewriter.ts
```

## Model Comparison

Test different models to find the best quality/cost tradeoff:

```bash
# Fast & cheap (Haiku)
npm run test:voice-processor -- --model phi-3-mini

# Better quality (Sonnet)
npm run test:voice-processor -- --model gemma-2

# Best quality (Sonnet 3.7)
npm run test:voice-processor -- --model mistral-small
```

**Note**: Model names are mapped to Claude variants via the TerminalLLMClient.

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable required"

Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or add to `.env` file in project root:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### "Input directory not found"

Make sure you're running from project root:
```bash
cd /Users/jeroendezwart/perso/drpbx-fetcher
npm run test:voice-processor
```

### "No output files found"

Run the test script first:
```bash
npm run test:voice-processor
```

Then analyze:
```bash
npm run analyze:voice-quality
```

## Best Practices

### Prompt Engineering Tips

1. **Be Specific**: Clear, unambiguous instructions work best
2. **Use Examples**: Show don't just tell
3. **Emphasize Constraints**: What NOT to do is as important as what to do
4. **Keep It Simple**: Shorter prompts often perform better
5. **Test Incrementally**: Change one thing at a time

### Testing Tips

1. **Use Diverse Samples**: Cover edge cases, not just happy paths
2. **Iterate Quickly**: Small improvements compound
3. **Document Findings**: Note what works and what doesn't
4. **Compare Fairly**: Use same model when testing prompts
5. **Trust the Data**: Metrics reveal issues you might miss manually

## Advanced Usage

### Custom Test Vault

To use a different vault for reference notes:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
npm run test:voice-processor
```

### Batch Testing

Test all prompts:
```bash
for prompt in __tests__/prompts/*.txt; do
  echo "Testing $(basename $prompt)..."
  npm run test:voice-processor -- --prompt $(basename $prompt)
done

npm run analyze:voice-quality
```

### CI/CD Integration

Add to your CI pipeline to prevent prompt regressions:

```yaml
- name: Run prompt tests
  run: |
    npm run test:voice-processor
    npm run analyze:voice-quality
    # Fail if average score < 60
    node -e "const r = require('./__tests__/quality-report.json'); if (r.summary.averageScore < 60) process.exit(1)"
```

## Contributing

### Adding Test Samples

1. Create realistic dictation content
2. Set appropriate difficulty level
3. Specify expected links accurately
4. Test locally before committing

### Prompt Variations

1. Name descriptively (e.g., `concise-with-cot.txt`)
2. Document the key change in a comment at top
3. Test against all samples
4. Document results in commit message

## License

Part of the Dropbox Fetcher Obsidian plugin project.
