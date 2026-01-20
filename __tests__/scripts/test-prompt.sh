#!/bin/bash

# Interactive Prompt Testing Script for Claude Code
# Usage: Ask Claude Code to "test voice processor prompt"

PROMPT_FILE="${1:-baseline.txt}"
SAMPLE_FILE="${2:-all}"

echo "=== Voice Notes Prompt Tester ==="
echo "Prompt: $PROMPT_FILE"
echo "Sample: $SAMPLE_FILE"
echo ""
echo "This script helps Claude Code test prompts interactively."
echo ""
echo "Ask Claude Code to:"
echo "  'Test the voice notes prompt using $PROMPT_FILE'"
echo ""
echo "Claude will:"
echo "1. Read the prompt from __tests__/prompts/$PROMPT_FILE"
echo "2. Process test samples from __tests__/samples/dictation_input/"
echo "3. Save outputs to __tests__/samples/dictation_output/"
echo "4. You can then run: npm run analyze:voice-quality"
