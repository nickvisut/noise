# TODOS

## FEATURES

### IN PROGRESS

### PLANNED
  - [ ] add support for FLAC (e.g., https://github.com/mmig/speech-to-flac, https://github.com/mmig/libflac.js)
  - [ ] show user visual indicator that they can't change noises while recording
  - [ ] add wizard (easy sequential navigation)
  - [ ] simple text "pacing" timeline
    - [ ] change noises data structure to allow for pauses and prompts
    - [ ] show user a timeline for visual prompts
    - [ ] show user basic visual prompts for recording a noise
    - [ ] integrate new sample sounds

### ICEBOX
  - [ ] complex graphic timeline
    - [ ] show user an animated timeline a la rhythm games
  - [ ] accessibility
    - [ ] add simple keyboard shortcuts for accessibility
    - [ ] replace built-in audio controls with custom ones for accessibility (e.g., https://developer.mozilla.org/en-US/docs/Learn/Accessibility/Multimedia#Creating_custom_audio_and_video_controls)
  - [ ] allow user to review and submit
  - [ ] allow user to select mic ("zero; browsers have that ui")

### DONE
  - [x] prevent user from changing noises while recording
  - [x] get basic happy path working
  - [x] allow user to record multiple noises
  - [x] load data
  - [x] update UI when done recording, and uploading
  - [x] load noise info from data json
  - [x] add navigation arrows as a precursor to the wizard
  - [x] ask for microphone permission on record instead of on load (see: https://developers.google.com/web/fundamentals/media/recording-video/#ask_permission_to_use_camera_responsibly,https://developers.google.com/web/fundamentals/media/recording-video/#use_the_permissions_api_to_check_if_you_already_have_access)




## TECHNICAL HEALTH

### IN PROGRESS

### PLANNED
  - [ ] split out CSS by "component"
  - [ ] separate recorder status from clip status, then can use NEED_PERMISSIONS permission appropriately
  - [ ] add development web server for automatically reloading on save of static files
  - [ ] add build step so that we can use packages more easily, minify, etc

### ICEBOX
  - [ ] test scenarios
  - [ ] fallback to <input>
  - [ ] add debouncing
  - [ ] add polyfills and fallbacks
    - [ ] getUserMedia() - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Using_the_new_API_in_older_browsers, https://github.com/webrtc/adapter
  - [ ] productionize
  - [ ] test supported desktop browsers
  - [ ] smoke test and fix mobile browsers
  - [ ] address TODOs
  - [ ] fix console errors
  - [ ] remove console debugging statements

### DONE
  - [x] refactor into modules
  - [x] replace libflac3*.strict.js with official fix for strict mode when following issue is resolved (https://github.com/mmig/libflac.js/issues/4)
