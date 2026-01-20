# Voice Notes Prompt Testing with Claude Code

This guide shows you how to test and improve Voice Notes prompts using only Claude Code (no external API calls needed).

## Overview

Since you have Claude Code Pro, you can use Claude directly to test prompts. This avoids any extra costs and uses your existing subscription.

## Quick Start

### Step 1: Test a Prompt

Copy and paste this to Claude Code:

```
Test the Voice Notes prompt system:

1. Read the prompt: __tests__/prompts/baseline.txt
2. Read the reference notes from: __tests__/samples/reference_notes/
3. Process each file in: __tests__/samples/dictation_input/
4. For each file:
   a. Extract the note list (filenames without .md from reference_notes/)
   b. Build the full prompt (replace {{NOTE_LIST}} and {{CONTENT}})
   c. Process the content following the prompt instructions EXACTLY
   d. Save output to __tests__/samples/dictation_output/ with same filename
   e. Include this YAML frontmatter:
      ---
      testCase: [from input file]
      model: claude-sonnet-4-5
      prompt: baseline.txt
      processingTime: [estimate]ms
      linksAdded: [count of [[links]]]
      expectedLinks: [from input file]
      actualLinks: [list of [[links]] you added]
      ---
   f. Then include the processed content

Process all 15 files and let me know when done.
```

### Step 2: Analyze Results

After Claude processes all files, run:

```bash
npm run analyze:voice-quality
```

This generates:
- `__tests__/quality-report.json` - Detailed metrics
- `__tests__/quality-summary.md` - Human-readable report

### Step 3: Review & Iterate

1. Check `quality-summary.md` for scores and recommendations
2. Identify which test cases failed
3. Create an improved prompt
4. Test the new prompt
5. Compare results

## Detailed Workflow

### Testing Different Prompts

**Test the concise prompt:**
```
Test __tests__/prompts/concise.txt following the same process as before.
Process all samples and save to dictation_output/.
```

**Test the explicit-examples prompt:**
```
Test __tests__/prompts/explicit-examples.txt on all samples.
```

**Test a specific sample:**
```
Test just __tests__/samples/dictation_input/01-simple-link-request.md
using __tests__/prompts/baseline.txt
```

### Creating New Prompts

1. **Copy an existing prompt:**
   ```
   Create a new prompt file __tests__/prompts/improved-v1.txt based on baseline.txt but with these changes:
   - Add more examples of natural language mentions
   - Emphasize preserving YAML exactly
   ```

2. **Test the new prompt:**
   ```
   Test __tests__/prompts/improved-v1.txt on all samples
   ```

3. **Analyze:**
   ```bash
   npm run analyze:voice-quality
   ```

### Batch Testing Multiple Prompts

```
Test all prompts in sequence:

For each prompt in __tests__/prompts/:
1. Clear __tests__/samples/dictation_output/
2. Process all samples with this prompt
3. Run npm run analyze:voice-quality
4. Save the quality-summary.md as quality-summary-[prompt-name].md
5. Move to next prompt

This will let me compare all prompts.
```

## Understanding the Process

### What Claude Code Does

When you ask Claude Code to test a prompt:

1. **Reads the prompt template** from `__tests__/prompts/[name].txt`
2. **Gets reference notes** from `__tests__/samples/reference_notes/`
3. **For each test sample:**
   - Reads the input file
   - Builds the full prompt (replaces placeholders)
   - Processes it following the prompt instructions
   - Extracts links added
   - Saves output with metadata

### What the Analysis Does

The analysis script (`analyze-quality.ts`):

1. **Compares expected vs actual links:**
   - Precision: correct / total added
   - Recall: correct / expected
   - F1: harmonic mean

2. **Checks preservation:**
   - YAML frontmatter unchanged
   - Content not modified (except links)
   - Formatting preserved

3. **Measures cleanup:**
   - Link requests removed properly

4. **Generates report:**
   - Overall scores
   - Per-prompt comparison
   - Recommendations

## Example Session

### Session 1: Baseline Test

**You:**
```
Test the baseline prompt on all samples in __tests__/samples/dictation_input/
```

**Claude Code:**
*Processes 15 files and saves outputs*

**You:**
```bash
npm run analyze:voice-quality
cat __tests__/quality-summary.md
```

**Result:**
```
Average Score: 62.5/80
Issues: Low recall on natural mentions
Recommendation: Add more examples
```

### Session 2: Improved Prompt

**You:**
```
Create __tests__/prompts/improved-v1.txt with more examples of natural mentions like:
- "in my [NoteName]"
- "according to [NoteName]"
- "from my [NoteName] note"

Then test it on all samples.
```

**Claude Code:**
*Creates new prompt and processes samples*

**You:**
```bash
npm run analyze:voice-quality
cat __tests__/quality-summary.md
```

**Result:**
```
Average Score: 71.2/80
Much better! Recall improved.
```

### Session 3: Production Update

**You:**
```
The improved-v1.txt prompt scored 71.2/80.
Update src/processors/VoiceNotesProcessor/services/TextRewriter.ts
to use this new prompt.
```

## Tips for Best Results

### 1. Be Explicit with Claude Code

Good:
```
Test __tests__/prompts/baseline.txt on ALL files in dictation_input/.
Process each one completely before moving to the next.
Save outputs with proper YAML metadata.
```

Bad:
```
Test the baseline prompt
```

### 2. Verify Outputs

After Claude processes files, check:
```bash
ls __tests__/samples/dictation_output/
# Should have 15 files

head __tests__/samples/dictation_output/01-simple-link-request.md
# Should have YAML + processed content
```

### 3. Clear Outputs Between Tests

```
Before testing a new prompt, delete all files in __tests__/samples/dictation_output/
```

### 4. Use the Analysis Tool

Always run analysis after each test batch:
```bash
npm run analyze:voice-quality
```

Don't try to judge quality manually - the metrics are objective.

### 5. Iterate Incrementally

- Change one aspect of the prompt at a time
- Test it
- See if score improved
- Keep or revert the change
- Repeat

## Advanced Usage

### Testing Edge Cases Only

```
Test __tests__/prompts/baseline.txt on only the edge case files:
- 10-no-references.md
- 11-partial-name.md
- 12-similar-names.md
- 13-non-existent.md
- 14-yaml-variations.md
- 15-formatting-preserved.md
```

### Creating Targeted Tests

```
Create a new test sample __tests__/samples/dictation_input/30-my-specific-case.md
that tests this scenario: [describe your scenario]

Then test it with baseline.txt
```

### Debugging Low Scores

```
Show me the detailed comparison for the test case that scored lowest.
Read both:
- __tests__/samples/dictation_input/[testcase].md
- __tests__/samples/dictation_output/[testcase].md

Explain what went wrong.
```

## Comparing with Production

### Get Current Production Behavior

The baseline.txt prompt matches what's currently in production (from TextRewriter.ts).

Testing baseline.txt shows how the current system performs.

### A/B Testing

1. Test baseline.txt (current production)
2. Test improved-v1.txt (your improvement)
3. Compare scores
4. If improved score > baseline score significantly, deploy it

## No External Costs

**Benefits of this approach:**
- ✅ Uses your existing Claude Code Pro subscription
- ✅ No additional API costs
- ✅ Same Claude model that would be used anyway
- ✅ Interactive - you can intervene and guide
- ✅ Educational - you see exactly how prompts are processed

**Limitations:**
- Takes longer than automated script (interactive)
- Requires you to manually trigger each test run
- Can't easily run in CI/CD

**Solution:**
This is perfect for iterative development. Once you find the best prompt, you can keep it. You don't need to test frequently - just when you want to improve the system.

## File Structure Summary

```
__tests__/
├── prompts/                      # Prompt variations to test
│   ├── baseline.txt              # Current production
│   ├── concise.txt               # Simplified
│   ├── explicit-examples.txt     # More examples
│   └── ...
├── samples/
│   ├── dictation_input/          # Test cases (15 files)
│   │   ├── 01-simple-link-request.md
│   │   └── ...
│   ├── dictation_output/         # Generated by Claude Code
│   │   └── (same filenames)
│   └── reference_notes/          # Mock vault (8 files)
│       ├── ProjectName.md
│       └── ...
├── scripts/
│   └── analyze-quality.ts        # Analysis script
└── quality-summary.md            # Generated report
```

## Quick Reference

### Standard Test Command
```
Test __tests__/prompts/[PROMPT_NAME].txt on all samples in dictation_input/
and save to dictation_output/
```

### Analysis Command
```bash
npm run analyze:voice-quality
```

### View Results
```bash
cat __tests__/quality-summary.md
```

### Clear Outputs
```bash
rm -rf __tests__/samples/dictation_output/*
```

## Getting Started Now

**Ready to test? Copy this:**

```
Test the Voice Notes prompt system:

1. Read __tests__/prompts/baseline.txt
2. Get note list from __tests__/samples/reference_notes/ (filenames without .md)
3. Process all files in __tests__/samples/dictation_input/

For each input file:
- Build full prompt (replace {{NOTE_LIST}} with note names, {{CONTENT}} with file content)
- Process following prompt instructions exactly
- Save to __tests__/samples/dictation_output/ with same filename
- Include YAML frontmatter with:
  * testCase, model, prompt, processingTime, linksAdded, expectedLinks, actualLinks

Process all 15 files. When done, I'll run the analysis.
```

Then after Claude finishes:

```bash
npm run analyze:voice-quality
cat __tests__/quality-summary.md
```

Happy prompt testing! 🎯
