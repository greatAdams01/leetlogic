import ExpoModulesCore
import AVFoundation
import Speech

private final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
  let synth = AVSpeechSynthesizer()
  var pending: Promise?
  var currentUtterance: AVSpeechUtterance?
  override init() { super.init(); synth.delegate = self }
  func cancel() {
    pending?.reject("CANCELLED", "Speech stopped")
    pending = nil
    currentUtterance = nil
    synth.stopSpeaking(at: .immediate)
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    guard utterance === currentUtterance else { return }
    pending?.resolve(nil); pending = nil; currentUtterance = nil
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    guard utterance === currentUtterance else { return }
    pending?.reject("CANCELLED", "Speech stopped"); pending = nil; currentUtterance = nil
  }
}
public class LeetLogicLocalSpeechModule: Module {
  private let speaker = Speaker()
  public func definition() -> ModuleDefinition {
    Name("LeetLogicLocalSpeech")
    AsyncFunction("englishRecognitionLocales") { () -> [String] in
      SFSpeechRecognizer.supportedLocales().filter { locale in
        guard locale.identifier.hasPrefix("en"), let recognizer = SFSpeechRecognizer(locale: locale) else { return false }
        return recognizer.supportsOnDeviceRecognition && recognizer.isAvailable
      }.map { $0.identifier.replacingOccurrences(of: "_", with: "-") }
    }
    AsyncFunction("available") { () -> Bool in
      AVSpeechSynthesisVoice.speechVoices().contains { $0.language.hasPrefix("en-") }
    }.runOnQueue(.main)
    AsyncFunction("speak") { (text: String, promise: Promise) in
      guard let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { $0.language == "en-NG" })
        ?? AVSpeechSynthesisVoice.speechVoices().first(where: { $0.language.hasPrefix("en-") }) else {
        promise.reject("VOICE_UNAVAILABLE", "Install an English voice in device settings"); return
      }
      self.speaker.cancel()
      do {
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try AVAudioSession.sharedInstance().setActive(true)
      } catch { promise.reject("AUDIO_UNAVAILABLE", error.localizedDescription); return }
      let utterance = AVSpeechUtterance(string: text)
      utterance.voice = voice
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.85
      self.speaker.currentUtterance = utterance
      self.speaker.pending = promise
      self.speaker.synth.speak(utterance)
    }.runOnQueue(.main)
    AsyncFunction("stop") { self.speaker.cancel() }.runOnQueue(.main)
    OnDestroy { self.speaker.cancel() }
  }
}
