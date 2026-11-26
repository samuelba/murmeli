# Narration audio

Kids who can't read yet need to hear the instructions. Murmeli plays pre-recorded clips for every prompt, hint, feedback phrase and demo step, in de-CH (Standard German pronunciation) and en-US.

## AI-generated voices
The narrator voices are **synthetic**. They are generated offline, ahead of time, with **Qwen3-TTS** (1.7B, open weights, Apache-2.0 license):

1. Qwen3-TTS VoiceDesign creates a narrator per language from a written description (a warm, friendly and very clear voice, like a kind kindergarten teacher, slightly slow, for children aged 5 to 8). No real person's voice is cloned.
2. Every clip is then rendered with that narrator's reference clip, so all clips sound like the same voice.
3. Each clip is transcribed with Whisper and compared with its text. Clips with missing, extra or wrong words are rendered again, and those that still fail are checked by ear.
4. ffmpeg trims the silence, normalizes the loudness and encodes the clips as Opus.

Nothing is synthesized while the app runs, and no text is sent to a speech service. The browser only downloads the finished clips from your server. Math prompts are put together from short clips ("Wie viel ist" + "7" + "plus" + "5"), with a short pause between them.

**Disclosure:** tell your users that the voices are AI-generated, for example in your privacy notice or terms. Clips recorded by a person are marked `human` in the audio manifest.

## How it plays
- Each text has a speaker button. With the kid's **Read aloud** setting on **Automatic by level** (the default), prompts, hints and feedback play by themselves for kindergarten kids; school kids tap the speaker. See [For parents](../usage/parents.md#create-a-kid-profile).
- If a text has no clip, its speaker button is hidden and the text is shown as usual.
- The frontend serves the clips from `/audio/`. `manifest.json` is checked on every visit, and the clips are cached by the browser for a year.

## Getting the audio into your installation
The frontend image contains the narration when it was built with a rendered set in `content/audio`. Without it, Murmeli works normally, but the speaker buttons stay hidden. To add or update a set without rebuilding the image, mount it into the frontend container. In `docker-compose.override.yml`:

```yaml
services:
  frontend:
    volumes:
      - ./audio:/usr/share/nginx/html/audio:ro
```

`./audio` must contain `manifest.json` and one folder per language (`de-CH/`, `en-US/`) with the `.opus` files, exactly as the pipeline writes them to `tools/audio/out/`. Copy only those, not the review page or the cache. Then run `docker compose up -d`.

## Regenerating the audio
The pipeline is in `tools/audio/` of the repository. It runs on a developer machine with an NVIDIA GPU, not on the server and not in CI. It needs Docker with the NVIDIA Container Toolkit, about 12 GB of model downloads and roughly 25 minutes for the full set.

```bash
cd tools/audio
./run.sh build    # build the GPU image (once)
./run.sh all      # extract → render → verify → postprocess → manifest → review page
```

The pipeline collects every text a kid can hear from `content/` and the app's translation files. It is incremental: a clip's key is a hash of its text, language, voice and model, so after a content change only new or changed texts are rendered. Then:

1. Open `tools/audio/out/review.html` and listen to the flagged and new clips.
2. Keep a clip with `./run.sh approve <key>`, or render it again with `./run.sh reroll <key>`.
3. Copy the result into your installation as shown above.

To change the narrator, generate candidates with `./run.sh design-voice --count 3`, pick one in `tools/audio/voices/selected.json`, and run `./run.sh all` again. A new voice renders every clip again.

All details, including the licenses of the models, are in [tools/audio/README.md](../../../tools/audio/README.md).

## Replacing clips with human recordings
Any clip can be replaced by a recording of a person, for example isolated sounds that the AI voice doesn't get right:

1. Save a WAV file as `tools/audio/human/<language>/<name>.wav`.
2. Map the exact text to it in `tools/audio/human/overrides.yaml`:

   ```yaml
   de-CH:
     "M wie Maus": m-wie-maus.wav
   ```

3. Run `./run.sh postprocess && ./run.sh manifest`.

A recording always wins over the generated clip with the same text, keeps the same key, and gets the same trimming, loudness and Opus encoding. Only record adults who have agreed in writing that their voice may be used.
