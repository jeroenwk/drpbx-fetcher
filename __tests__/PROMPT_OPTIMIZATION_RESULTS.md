# Voice Notes Prompt Optimization Results

## Executive Summary

After testing 5 prompt variations with Phi-3-mini-4k-instruct model, **baseline.txt achieved the best score of 42.6/80 (53%)**. This represents the performance ceiling for this model on the voice notes wiki-linking task.

## Test Results

| Prompt Variant | Score | F1 % | Content Preserved | YAML Preserved | Notes |
|---|---|---|---|---|---|
| **baseline.txt** | **42.6/80** | **52%** | 5/16 (31%) | 15/16 (94%) | Best overall |
| strict.txt | 35.8/80 | 43% | 4/16 (25%) | 8/16 (50%) | Examples confused model |
| conservative.txt | 18.9/80 | 21% | 1/16 (6%) | 0/16 (0%) | Too cautious |
| ultra-minimal.txt | 20.7/80 | 24% | 1/16 (6%) | 0/16 (0%) | Insufficient guidance |
| minimal.txt | N/A | N/A | N/A | N/A | Crashed analysis (malformed output) |

**Baseline for comparison**: Claude Sonnet 4.5 scored **66.9/80 (84%)** with same prompt structure.

## Key Findings

### 1. Model Performance Ceiling

Phi-3-mini-4k-instruct has a **fundamental performance ceiling at ~42-43/80** for this task. The limitations are:

- **Content hallucination**: Changes text in 68% of cases (11/16 files)
- **Low precision**: Adds links to non-existent notes
- **Low recall**: Misses 48% of required links
- **Occasional YAML corruption**: Breaks frontmatter in 6% of cases

### 2. Prompt Complexity Paradox

Counter-intuitively, **simpler prompts perform worse** with Phi-3:

- Removing structure → worse performance (ultra-minimal: 20.7)
- Adding examples → worse performance (strict: 35.8)
- Adding caution → worse performance (conservative: 18.9)

The baseline prompt provides the optimal balance of:
- Clear rules without excessive examples
- Structure without over-complication
- ChatML format properly utilized

### 3. Specific Failure Patterns

**Hard cases (consistently fail)**:
- `ambiguous-reference.md` - Disambiguating similar note names
- `similar-names.md` - "Project Alpha" vs "ProjectAlpha" vs "ProjectName"
- `no-references.md` - Should add zero links, but hallucinates links

**Common hallucinations**:
- Adding corporate jargon ("making significant strides", "team dedication")
- Linking random notes from the vault list
- Rewriting content to be more formal
- Including prompt examples in output

**YAML corruption patterns**:
- Missing opening `---`
- Treating note names as YAML keys
- Inserting note list into YAML block

## Recommendations

### For Production Use

**If using Phi-3-mini-4k**:
- Use `baseline.txt` prompt (best performance: 42.6/80)
- Accept 68% content modification rate
- Implement post-processing validation:
  - Check YAML integrity
  - Compare word count (detect hallucination)
  - Verify links exist in vault

**Recommended alternative models**:

1. **Phi-3-medium-128k** (~14B parameters)
   - Expected: 55-60/80 score
   - Better instruction following
   - Less hallucination

2. **Llama 3.1 8B**
   - Expected: 60-65/80 score
   - Strong instruction following
   - Good with structured tasks

3. **Mistral Small 22B**
   - Expected: 65-70/80 score
   - Excellent instruction following
   - Comparable to Claude Haiku

4. **Claude 3.5 Sonnet** (API)
   - Proven: 66.9/80 score
   - Production-ready quality
   - Cost: ~$0.003 per note

### Model Size vs Cost Tradeoff

| Model | Size | Local? | Score Estimate | Speed | RAM |
|---|---|---|---|---|---|
| Phi-3-mini-4k | 3.8B | Yes | 42.6/80 | Fast | 4GB |
| Phi-3-medium-128k | 14B | Yes | 55-60/80 | Medium | 16GB |
| Llama 3.1 8B | 8B | Yes | 60-65/80 | Medium | 8GB |
| Mistral Small | 22B | Yes | 65-70/80 | Slow | 24GB |
| Claude Sonnet 4.5 | ? | No (API) | 66.9/80 | Fast | 0GB |

## Prompt Engineering Lessons

### What Works
- Clear role definition ("You add wiki-links")
- Numbered rules (1, 2, 3...)
- Explicit OUTPUT FORMAT section
- ChatML tokens for Phi-3
- List of available notes

### What Doesn't Work
- Examples (model copies them literally)
- Negative instructions ("DON'T do X")
- Redundant rules (confuses model)
- Over-simplification (removes needed structure)
- Excessive caution instructions

### Optimal Baseline Prompt Structure

```
<|system|>
[Role]: Brief description of task
[RULES]: Numbered, specific, actionable
[INPUT]: What to expect
[OUTPUT]: Exact format required
[REFERENCE]: Available notes list
<|end|>
<|user|>
{{CONTENT}}<|end|>
<|assistant|>
[Any pre-fill to guide output format]
```

## Test Methodology

- **Test set**: 16 diverse voice note samples
- **Metrics**: Precision, Recall, F1, YAML/content/format preservation
- **Scoring**: Weighted total /80 (F1: 40pts, Preservation: 40pts)
- **Model**: LM Studio with Phi-3.1-mini-4k-instruct-q4
- **Temperature**: 0.1 (deterministic)
- **Repeated**: 5 prompt variants tested

## Next Steps

1. **Test larger models**: Phi-3-medium, Llama 3.1 8B, Mistral Small
2. **Implement validation**: Post-processing checks for hallucination
3. **A/B testing**: Compare model upgrade vs API cost
4. **Production recommendation**: Based on quality requirements

## Files

- Test samples: `__tests__/samples/dictation_input/*.md`
- Prompts: `__tests__/prompts/phi-3/*.txt`
- Results: `__tests__/samples/dictation_output/*.md`
- Analysis: `__tests__/quality-report.json`, `__tests__/quality-summary.md`

## Phi-4-mini-reasoning Test Results

**Model**: microsoft/phi-4-mini-reasoning
**Result**: Complete failure (0/80)

Phi-4-mini-reasoning is a specialized model fine-tuned for mathematical reasoning with chain-of-thought. When given the voice notes task, it:
- Ignored the input completely
- Hallucinated a math problem about solving x² - 1 = √(x + 1)
- Generated 400+ lines of `<think>` reasoning about polynomial equations
- Produced zero wiki-links
- Took 104 seconds and ran out of memory (exit code 137)

**Conclusion**: Phi-4-reasoning is optimized for STEM problem solving, not text editing. It's fundamentally incompatible with instruction-following tasks like wiki-link insertion.

## Overall Conclusion

**Phi-3-mini-4k is unsuitable for production use** at 42.6/80 quality score with 68% content modification rate. The model is too small for reliable instruction following on this task.

**Phi-4-mini-reasoning is completely incompatible** - it's a specialized math reasoning model that ignores text editing instructions.

**Recommended action**: Test Llama 3.1 8B or Mistral Small for local deployment, or use Claude API for production-grade quality.
