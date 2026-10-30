Pod::Spec.new do |s|
  s.name = 'LeetLogicLocalSpeech'
  s.version = '1.0.0'
  s.summary = 'Offline English listing prompts'
  s.description = 'Installed device voices only'
  s.author = 'LeetLogic'
  s.homepage = 'https://leetlogic.com'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
