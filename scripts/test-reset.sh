#!/bin/bash

# Test Reset Script
# Cleans all Viwoods-related data and restarts Obsidian for testing

set -e  # Exit on error

VAULT_PATH="/Users/jeroendezwart/2th Brain"
PLUGIN_DATA="$VAULT_PATH/.obsidian/plugins/drpbx-fetcher/data.json"

echo "🧹 Starting test reset..."

# Step 1: Kill Obsidian
echo "1️⃣  Killing Obsidian..."
pkill -9 "Obsidian" 2>/dev/null || echo "   Obsidian not running"

# Step 2: Clear tracked files in data.json
echo "2️⃣  Clearing tracked files in data.json..."
if [ -f "$PLUGIN_DATA" ]; then
    # Use jq to set processedFiles to empty object
    jq '.processedFiles = {}' "$PLUGIN_DATA" > "$PLUGIN_DATA.tmp" && mv "$PLUGIN_DATA.tmp" "$PLUGIN_DATA"
    echo "   ✓ Cleared processedFiles"
else
    echo "   ⚠️  data.json not found at $PLUGIN_DATA"
fi

# Step 3: Delete Viwoods Attachments folder
echo "3️⃣  Deleting Viwoods Attachments folder..."
ATTACHMENTS_FOLDER="$VAULT_PATH/Attachments/Viwoods"
if [ -d "$ATTACHMENTS_FOLDER" ]; then
    rm -rf "$ATTACHMENTS_FOLDER"
    echo "   ✓ Deleted $ATTACHMENTS_FOLDER"
else
    echo "   ℹ️  Attachments folder not found (nothing to delete)"
fi

# Step 4: Delete module output folders
echo "4️⃣  Deleting Viwoods module folders..."

# Get enabled module folders from data.json
if [ -f "$PLUGIN_DATA" ]; then
    # Extract all module output folders
    FOLDERS=$(jq -r '.fileTypeMappings[] | select(.extension == "note") | .config | to_entries[] | select(.key != "viwoodsAttachmentsFolder") | .value.outputFolder // empty' "$PLUGIN_DATA" 2>/dev/null | sort -u)

    if [ -n "$FOLDERS" ]; then
        while IFS= read -r folder; do
            FOLDER_PATH="$VAULT_PATH/$folder"
            if [ -d "$FOLDER_PATH" ]; then
                rm -rf "$FOLDER_PATH"
                echo "   ✓ Deleted $folder"
            else
                echo "   ℹ️  Folder $folder not found (nothing to delete)"
            fi
        done <<< "$FOLDERS"
    else
        echo "   ℹ️  No module folders configured"
    fi
else
    echo "   ⚠️  Could not read module folders from data.json"
fi

# Step 5: Restart Obsidian
echo "5️⃣  Restarting Obsidian..."
open -a "Obsidian"
echo "   ✓ Obsidian started"

echo ""
echo "✅ Test reset complete!"
echo "   - Tracked files cleared"
echo "   - Attachments folder deleted"
echo "   - Module folders deleted"
echo "   - Obsidian restarted"
