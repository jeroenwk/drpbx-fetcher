# Run Prompt Test (Claude Code Interactive)

This is an interactive test runner designed to be used directly with Claude Code.

## How to Use

1. **Select a test sample** to process
2. **Select a prompt** to test
3. **Copy the instructions below** and send to Claude Code
4. Claude Code will process the sample and save the output
5. Repeat for all samples
6. Run the analysis script

## Instructions for Claude Code

```
I want you to test a Voice Notes prompt. Here's what to do:

1. Read the prompt file: __tests__/prompts/[PROMPT_NAME].txt
2. Read the test sample: __tests__/samples/dictation_input/[SAMPLE_NAME].md
3. Extract the note list from: __tests__/samples/reference_notes/ (just the filenames without .md)
4. Build the full prompt by:
   - Replace {{NOTE_LIST}} with the list of note names
   - Replace {{CONTENT}} with the sample content
5. Process the prompt yourself (you are the LLM being tested)
6. Save the output to: __tests__/samples/dictation_output/[SAMPLE_NAME].md
7. The output should include:
   - YAML frontmatter with metadata (model, prompt, expectedLinks, actualLinks, processingTime)
   - The processed content

Example metadata:
---
testCase: simple-link-request
model: claude-sonnet-4-5
prompt: baseline.txt
processingTime: Xms
linksAdded: Y
expectedLinks:
  - ProjectName
actualLinks:
  - ProjectName
---

[Processed content here]
```

## Quick Commands

### Test baseline prompt on all samples:
```
Process all files in __tests__/samples/dictation_input/ using the prompt from __tests__/prompts/baseline.txt. For each file:
1. Read the prompt and sample
2. Get note list from reference_notes/
3. Process the sample following the prompt instructions
4. Save output to dictation_output/ with metadata
5. Move to next file
```

### Test specific sample:
```
Test __tests__/samples/dictation_input/01-simple-link-request.md with __tests__/prompts/baseline.txt
```

### Compare two prompts:
```
Test all samples with baseline.txt, then test all samples with concise.txt, then run the analysis
```

## Current Status

- Test samples: 15 files ready
- Prompts: 7 variations available
- Reference notes: 8 files ready
- Analysis script: Ready to run

## Next Steps

1. Run tests interactively with Claude Code
2. When all outputs are generated, run: `npm run analyze:voice-quality`
3. Review the quality summary
4. Iterate on prompts based on findings
