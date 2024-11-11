deepgram: DeepgramClient = DeepgramClient()

config: DeepgramClientOptions = DeepgramClientOptions(
    verbose=logging.DEBUG,
)
deepgram: DeepgramClient = DeepgramClient("", config)


AUDIO_URL = {
    "url": "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"
}

## STEP 1 Create a Deepgram client using the API key from environment variables
deepgram: DeepgramClient = DeepgramClient("", ClientOptionsFromEnv())

## STEP 2 Call the transcribe_url method on the prerecorded class
options: PrerecordedOptions = PrerecordedOptions(
    model="nova-2",
    smart_format=True,
)
response = deepgram.listen.rest.v("1").transcribe_url(AUDIO_URL, options)
print(f"response: {response}\n\n")