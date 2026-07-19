#!/usr/bin/env python3
"""
Test Voice Cloning on Modal

This script tests the voice cloning endpoint by:
1. Creating a simple voice sample using system TTS
2. Sending it to Modal for cloning
3. Saving the output
"""

import base64
import json
import os
import subprocess
import sys
import urllib.request

# Modal endpoint
CLONE_ENDPOINT = "https://isaiahdupree33--voice-clone-indextts2-clone-voice.modal.run"

def create_test_voice():
    """Create a simple voice sample using macOS say command."""
    output_path = "test-output/test-voice-ref.wav"
    os.makedirs("test-output", exist_ok=True)
    
    # Use macOS 'say' to generate a voice sample
    text = "Hi, my name is Test User. I am recording this voice sample for voice cloning. The weather today is beautiful."
    
    # Generate AIFF then convert to WAV
    aiff_path = "test-output/test-voice-ref.aiff"
    subprocess.run([
        "say", "-o", aiff_path, text
    ], check=True)
    
    # Convert to WAV using ffmpeg
    subprocess.run([
        "ffmpeg", "-y", "-i", aiff_path, "-ar", "16000", "-ac", "1", output_path
    ], check=True, capture_output=True)
    
    # Clean up AIFF
    os.remove(aiff_path)
    
    print(f"✅ Created test voice: {output_path}")
    return output_path

def test_clone_voice(voice_path: str, text: str):
    """Test the voice cloning endpoint."""
    print(f"\n🎤 Testing voice cloning...")
    print(f"   Voice ref: {voice_path}")
    print(f"   Text: {text[:50]}...")
    
    # Read voice file
    with open(voice_path, "rb") as f:
        voice_bytes = f.read()
    
    # Prepare request
    payload = {
        "voice_bytes": base64.b64encode(voice_bytes).decode("utf-8"),
        "text": text,
        "emotion_preset": "friendly"
    }
    
    # Send to Modal
    print(f"\n📤 Sending to Modal...")
    
    req = urllib.request.Request(
        CLONE_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error: {e.code}")
        print(e.read().decode("utf-8"))
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return None
    
    # Save output
    output_path = "test-output/voice-clone-output.wav"
    audio_bytes = base64.b64decode(result["audio_bytes"])
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    stats = result.get("stats", {})
    print(f"\n✅ Voice cloning complete!")
    print(f"   Output: {output_path}")
    print(f"   Size: {stats.get('output_kb', 0):.1f} KB")
    print(f"   Processing time: {stats.get('processing_time_s', 0):.1f}s")
    print(f"   Method: {stats.get('method', 'unknown')}")
    
    return output_path

def main():
    print("🧪 Voice Cloning Test")
    print("=" * 40)
    
    # Step 1: Create test voice sample
    print("\n1️⃣  Creating test voice sample...")
    voice_path = create_test_voice()
    
    # Step 2: Test cloning
    print("\n2️⃣  Testing voice cloning...")
    test_text = "Hello! This is a test of the voice cloning system. I am speaking new words with the cloned voice."
    
    output = test_clone_voice(voice_path, test_text)
    
    if output:
        print(f"\n🎉 Test complete! Output saved to: {output}")
        print(f"   Play with: afplay {output}")
    else:
        print("\n❌ Test failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
