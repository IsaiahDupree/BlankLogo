"""
Voice Cloning on Modal GPU using IndexTTS-2

This Modal app provides voice cloning capabilities using the IndexTTS-2 model.
It clones a reference voice to speak any provided text.

Deploy: modal deploy voice_clone_modal.py
Test: modal run voice_clone_modal.py
"""

import modal

# Create Modal app
app = modal.App("voice-clone-indextts2")

# GPU configuration - T4 is sufficient for TTS
gpu_config = modal.gpu.T4()

# Build image with IndexTTS-2 dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "libsndfile1",
        "git",
    )
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "gradio_client>=1.0.0",
        "numpy",
        "scipy",
        "soundfile",
        "librosa",
        "loguru",
        "fastapi",
    )
)


@app.function(image=image, gpu=gpu_config, timeout=300, scaledown_window=60)
@modal.web_endpoint(method="GET")
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "voice-clone-indextts2"}


@app.function(image=image, gpu=gpu_config, timeout=300, scaledown_window=60)
@modal.web_endpoint(method="POST")
def clone_voice(request: dict):
    """
    Clone a voice to speak new text using IndexTTS-2.
    
    Request body:
        voice_bytes: base64-encoded voice reference audio (WAV)
        text: Text to synthesize
        emotion_preset: "neutral" | "excited" | "serious" | "friendly" (optional)
    
    Response:
        audio_bytes: base64-encoded output audio (WAV)
        stats: processing statistics
    """
    import base64
    import tempfile
    import time
    import os
    from loguru import logger
    
    try:
        from gradio_client import Client, handle_file
    except ImportError:
        return {"error": "gradio_client not installed"}
    
    # Parse request
    voice_b64 = request.get("voice_bytes", "")
    text = request.get("text", "")
    emotion_preset = request.get("emotion_preset", "neutral")
    
    if not voice_b64:
        return {"error": "voice_bytes is required"}
    if not text:
        return {"error": "text is required"}
    
    voice_bytes = base64.b64decode(voice_b64)
    
    start_time = time.time()
    input_kb = len(voice_bytes) / 1024
    
    logger.info(f"[VoiceClone] Starting voice cloning")
    logger.info(f"[VoiceClone]   Voice ref: {input_kb:.1f} KB")
    logger.info(f"[VoiceClone]   Text: {text[:50]}...")
    logger.info(f"[VoiceClone]   Emotion: {emotion_preset}")
    
    # Emotion presets
    EMOTION_PRESETS = {
        "neutral": {"vec1": 0, "vec2": 0, "vec3": 0, "vec4": 0, "vec5": 0, "vec6": 0, "vec7": 0, "vec8": 0.8},
        "excited": {"vec1": 0.8, "vec2": 0, "vec3": 0, "vec4": 0, "vec5": 0, "vec6": 0, "vec7": 0.3, "vec8": 0.2},
        "serious": {"vec1": 0, "vec2": 0.2, "vec3": 0, "vec4": 0, "vec5": 0, "vec6": 0, "vec7": 0, "vec8": 0.6},
        "friendly": {"vec1": 0.5, "vec2": 0, "vec3": 0, "vec4": 0, "vec5": 0, "vec6": 0, "vec7": 0, "vec8": 0.5},
    }
    emotion = EMOTION_PRESETS.get(emotion_preset, EMOTION_PRESETS["neutral"])
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        voice_path = os.path.join(tmp_dir, "voice_ref.wav")
        output_path = os.path.join(tmp_dir, "output.wav")
        
        # Write voice reference
        with open(voice_path, "wb") as f:
            f.write(voice_bytes)
        
        logger.info("[VoiceClone] Connecting to IndexTTS-2...")
        
        try:
            # Connect to IndexTTS-2 on Hugging Face
            client = Client("IndexTeam/IndexTTS-2-Demo")
            
            logger.info("[VoiceClone] Generating speech...")
            
            result = client.predict(
                emo_control_method="Same as the voice reference",
                prompt=handle_file(voice_path),
                text=text,
                emo_ref_path=handle_file(voice_path),
                emo_weight=0.8,
                vec1=emotion["vec1"], vec2=emotion["vec2"], 
                vec3=emotion["vec3"], vec4=emotion["vec4"],
                vec5=emotion["vec5"], vec6=emotion["vec6"], 
                vec7=emotion["vec7"], vec8=emotion["vec8"],
                emo_text="",
                emo_random=False,
                max_text_tokens_per_segment=120,
                param_16=True,    # do_sample
                param_17=0.8,     # top_p
                param_18=30,      # top_k
                param_19=0.8,     # temperature
                param_20=0,       # length_penalty
                param_21=3,       # num_beams
                param_22=10,      # repetition_penalty
                param_23=1500,    # max_mel_tokens
                api_name="/gen_single"
            )
            
            # Handle response format
            if isinstance(result, dict):
                audio_path = result.get("value", result)
            else:
                audio_path = result
            
            logger.info(f"[VoiceClone] Generated: {audio_path}")
            
            # Read output audio
            import shutil
            shutil.copy(audio_path, output_path)
            
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            
            total_time = time.time() - start_time
            output_kb = len(output_bytes) / 1024
            
            # Estimate duration from text
            words = len(text.split())
            estimated_duration_s = (words / 150) * 60
            
            stats = {
                "voice_ref_kb": round(input_kb, 1),
                "output_kb": round(output_kb, 1),
                "text_chars": len(text),
                "text_words": words,
                "estimated_duration_s": round(estimated_duration_s, 1),
                "processing_time_s": round(total_time, 2),
                "emotion_preset": emotion_preset,
                "method": "indextts2-hf",
            }
            
            logger.info(f"[VoiceClone] ✅ Complete in {total_time:.1f}s")
            logger.info(f"[VoiceClone]   Output: {output_kb:.1f} KB")
            
            return {
                "audio_bytes": base64.b64encode(output_bytes).decode("utf-8"),
                "stats": stats,
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[VoiceClone] ❌ Error: {error_msg}")
            
            # Check for quota errors
            if "quota" in error_msg.lower() or "limit" in error_msg.lower():
                return {
                    "error": "HuggingFace quota exceeded. Try again later.",
                    "error_type": "quota",
                }
            
            return {
                "error": error_msg,
                "error_type": "generation_failed",
            }


# Local testing
@app.local_entrypoint()
def main():
    """Test voice cloning locally."""
    import os
    import base64
    
    print("Testing Voice Clone Modal App...")
    
    # Check for test voice file
    test_voice = "public/assets/voices/test-voice.wav"
    if not os.path.exists(test_voice):
        print(f"No test voice found at {test_voice}")
        print("Creating a simple test...")
        
        # Just test health
        result = health.remote()
        print(f"Health check: {result}")
        return
    
    # Read voice reference
    with open(test_voice, "rb") as f:
        voice_bytes = f.read()
    
    # Test cloning
    result = clone_voice.remote({
        "voice_bytes": base64.b64encode(voice_bytes).decode("utf-8"),
        "text": "Hello! This is a test of the voice cloning system.",
        "emotion_preset": "friendly",
    })
    
    print(f"Result: {result}")
    
    if "audio_bytes" in result:
        output_bytes = base64.b64decode(result["audio_bytes"])
        output_path = "test-output/voice-clone-test.wav"
        os.makedirs("test-output", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(output_bytes)
        print(f"Output saved to: {output_path}")
