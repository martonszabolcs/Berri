#!/bin/bash
# Copy test image to iOS simulator Documents directory
# Run this AFTER the app has been installed and simulator is booted

BUNDLE_ID="com.ideago.berrix"
IMAGE_SOURCE="IMG_2897-1.JPG"
IMAGE_DEST="test_scan.jpg"

CONTAINER=$(xcrun simctl get_app_container booted "$BUNDLE_ID" data 2>/dev/null)

if [ -z "$CONTAINER" ]; then
  echo "❌ App container not found. Make sure:"
  echo "   1. iOS Simulator is running"  
  echo "   2. The app is installed (run it once)"
  echo ""
  echo "   Bundle ID: $BUNDLE_ID"
  exit 1
fi

DOCS_DIR="$CONTAINER/Documents"
mkdir -p "$DOCS_DIR"

cp "$IMAGE_SOURCE" "$DOCS_DIR/$IMAGE_DEST"

if [ $? -eq 0 ]; then
  echo "✅ Copied $IMAGE_SOURCE → $DOCS_DIR/$IMAGE_DEST"
  echo "   Now open Settings > 🧪 Scan Pipeline Test in the app"
else
  echo "❌ Failed to copy image"
  exit 1
fi
