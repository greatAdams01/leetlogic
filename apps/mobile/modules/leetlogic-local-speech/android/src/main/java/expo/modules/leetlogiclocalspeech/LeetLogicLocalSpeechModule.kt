package expo.modules.leetlogiclocalspeech

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.UUID

class LeetLogicLocalSpeechModule : Module() {
  private var engine: TextToSpeech? = null
  private var ready = false
  private var pending: Promise? = null
  private var utteranceId: String? = null
  private fun cancel() {
    pending?.reject("CANCELLED", "Speech stopped", null)
    pending = null
    utteranceId = null
    engine?.stop()
  }
  override fun definition() = ModuleDefinition {
    Name("LeetLogicLocalSpeech")
    OnCreate {
      engine = TextToSpeech(appContext.reactContext) { status -> ready = status == TextToSpeech.SUCCESS }
      engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(id: String?) {}
        override fun onDone(id: String?) {
          if (id == utteranceId) { pending?.resolve(null); pending = null; utteranceId = null }
        }
        @Deprecated("Required by Android")
        override fun onError(id: String?) {
          if (id == utteranceId) { pending?.reject("SPEECH_FAILED", "Could not speak prompt", null); pending = null; utteranceId = null }
        }
      })
    }
    AsyncFunction("available") {
      ready && engine?.voices?.any { it.locale.language == "en" && !it.isNetworkConnectionRequired } == true
    }
    AsyncFunction("speak") { text: String, promise: Promise ->
      val voice = engine?.voices?.filter { it.locale.language == "en" && !it.isNetworkConnectionRequired }
        ?.sortedBy { if (it.locale.country == "NG") 0 else if (it.locale.country == "GB") 1 else 2 }?.firstOrNull()
      if (!ready || voice == null) { promise.reject("VOICE_UNAVAILABLE", "Install an offline English voice in device settings", null) }
      else {
        cancel()
        engine?.voice = voice
        engine?.setSpeechRate(0.85f)
        val id = UUID.randomUUID().toString()
        utteranceId = id
        pending = promise
        if (engine?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
          pending = null; utteranceId = null
          promise.reject("SPEECH_FAILED", "Could not speak prompt", null)
        }
      }
    }
    AsyncFunction("stop") { cancel() }
    OnDestroy { cancel(); engine?.shutdown(); engine = null; ready = false }
  }
}
