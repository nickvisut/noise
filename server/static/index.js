import {
  generateUUID,
  merge,
  showNotification,
} from './utilities/utilities.js';
import {
  updateApp,
  updateSamplePlayer,
  updateDownloadLink,
  renderButton,
  renderNoiseList,
  renderRecorder,
  renderRecordingControls,
  renderArrows,
} from './components/app.js';
import { RECORDER_STATUS_VALUES, NOISE_STATUS_VALUES } from './constants.js'; // TODO: separate these out by domain

import { initializeRecorder } from './record/record.js'; // old code path: MediaRecorder and WEBM
import { record } from './utilities/record.js'; // new code path: libflac.js and FLAC

/*
  UI
*/

// TODO: simplify and merge the below code
function renderRecorderAndArrows() {
  renderRecordingControls({
    recorderState: state.recorder,
    recording: state.recorder.status === RECORDER_STATUS_VALUES.RECORDING,
    disabled:
      state.noiseList[state.selectedNoise].status ===
        NOISE_STATUS_VALUES.RECORDED ||
      state.recorder.status === RECORDER_STATUS_VALUES.UPLOADING ||
      state.recorder.status === RECORDER_STATUS_VALUES.UPLOADED,
    onButtonClick: onRecordClick,
  }); // TODO: must also point to onRecordClick, which is stuck inside a closure
  renderArrows(
    state.recorder.status !== RECORDER_STATUS_VALUES.WAITING &&
      state.recorder.status !== RECORDER_STATUS_VALUES.UPLOADED,
    state.noiseList,
    state.selectedNoise,
    decrementSelectedNoise,
    incrementSelectedNoise,
  );
}

function renderApp() {
  updateApp({ isFlac: state.recorder.isFlac, onFlacClick: onFlacClick });
  renderNoiseList(
    state.noiseList,
    selectNoise,
    state.selectedNoise,
    render,
    () =>
      state.recorder.status === RECORDER_STATUS_VALUES.RECORDING ||
      state.recorder.status === RECORDER_STATUS_VALUES.UPLOADING,
  );
  renderRecorder({
    noise: state.noiseList[state.selectedNoise],
    recorderState: state.recorder, // TODO: divorce state shape of recorder
    recording: state.recorder.status === RECORDER_STATUS_VALUES.RECORDING,
    disabled:
      state.noiseList[state.selectedNoise].status ===
        NOISE_STATUS_VALUES.RECORDED ||
      state.recorder.status === RECORDER_STATUS_VALUES.UPLOADING ||
      state.recorder.status === RECORDER_STATUS_VALUES.UPLOADED,
    arrowsDisabled:
      state.recorder.status !== RECORDER_STATUS_VALUES.WAITING &&
      state.recorder.status !== RECORDER_STATUS_VALUES.UPLOADED,
    noiseList: state.noiseList,
    selectedNoise: state.selectedNoise,
    onButtonClick: onRecordClick,
    onLeftArrowClick: decrementSelectedNoise,
    onRightArrowClick: incrementSelectedNoise,
  });
}

/*
  async I/O (recorder)
*/

// TODO: fallback: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Using_the_new_API_in_older_browsers, https://github.com/webrtc/adapter
function requestMediaPermissions(onSuccess, onFailure) {
  /* async I/O dispatch */
  return navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then(onSuccess)
    .catch(onFailure);
}

/*
  async I/O (network request)
*/

function getNoises() {
  window
    .fetch('noises')
    .then(response => response.json())
    .then(
      noises => processNoises(noises), // Handle the success response object
    )
    .catch(
      error => console.log(error), // Handle the error response object
    );
}

function upload(file) {
  let data = new FormData();
  data.append('noise', file);
  data.append('user', 'you'); // TODO: names in uploads?

  return window.fetch('/upload', {
    method: 'POST',
    body: data,
  });
}

/*
  State
 */

let state = {
  recorder: {
    explicitlyPermitted: false,
    status: RECORDER_STATUS_VALUES.WAITING,
    startTime: null,
    elapsed: 0,
    filename: {
      prefix: '',
      sessionID: generateUUID(), // TODO: let server take care of this
      // TODO: use this UUID and put it in local storage
    },
    chunkNumber: 0,
    chunks: [],
    callbacks: {
      // TODO: currently abusing state to have handy references to recorder functionality; figure out a better way to do this
      startRecording: () => {},
      stopRecording: () => {},
    },
    isFlac: true,
  },
  noiseList: [],
  selectedNoise: -1,
};

function updateState(changes) {
  state = merge(state, changes);
}

function updateFilenamePrefix(prefix) {
  /* state management dispatch */
  updateState({
    recorder: {
      ...state.recorder,
      filename: {
        ...state.recorder.filename,
        prefix: prefix,
      },
    },
  });
}

function initializeNoises(noises) {
  let updatedNoiseList = noises.map(noise => ({
    ...noise,
    status: NOISE_STATUS_VALUES.UNRECORDED, // TODO: eventually, get this information from the server
  }));

  /* state management dispatch */
  updateState({
    noiseList: updatedNoiseList,
  });
}

function selectNoise(index) {
  // TODO: or pass actual noise?

  if (state.selectedNoise !== index) {
    const noise = state.noiseList[index];
    /* state management dispatch */
    updateState({
      selectedNoise: index, // TODO: or assign actual noise?
      recorder: {
        ...state.recorder,
        status:
          noise.status === NOISE_STATUS_VALUES.UNRECORDED
            ? RECORDER_STATUS_VALUES.WAITING
            : RECORDER_STATUS_VALUES.ALREADY_RECORDED,
        startTime: null,
        elapsed: 0,
      },
    });
    updateFilenamePrefix(noise.name); // TODO: this can be a calculated value instead

    // TODO: also rerender recorder?
    return true; // NOTE: signaling that we DID modify the state
  } else {
    return false; // NOTE: signaling that we did NOT modify the state
  }
}

function incrementSelectedNoise() {
  if (selectNoise((state.selectedNoise + 1) % state.noiseList.length)) {
    render();
  }
}

function decrementSelectedNoise() {
  if (selectNoise((state.selectedNoise - 1) % state.noiseList.length)) {
    render();
  }
}

function updateRecorderTime() {
  // TODO: rename to advanceRecorderTime()?

  /* state management dispatch */
  if (state.recorder.status === RECORDER_STATUS_VALUES.RECORDING) {
    if (state.recorder.startTime === null) {
      updateState({
        recorder: {
          ...state.recorder,
          startTime: Date.now(),
          elapsed: 0,
        },
      });
    } else {
      updateState({
        recorder: {
          ...state.recorder,
          elapsed: Date.now() - state.recorder.startTime, // TODO: update UI (especially timer) independent of onDataAvailable
        },
      });
    }
  }
}

function updateRecorderStatus() {
  // TODO: rename to advanceRecorderStatus() and do a state machine that takes in status as a parameter?

  /* state management dispatch */
  if (state.recorder.status !== RECORDER_STATUS_VALUES.RECORDING) {
    updateState({
      recorder: {
        ...state.recorder,
        status: RECORDER_STATUS_VALUES.RECORDING,
      },
    });
  }
}

/*
  Event handlers
 */
const onFlacClick = function(e) {
  e.preventDefault();

  // TODO: clean up after current recorders, if any, and allow for toggling on/off after first recording occurs (currently broken)
  updateState({
    recorder: {
      ...state.recorder,
      chunks: [],
      status: RECORDER_STATUS_VALUES.WAITING,
      isFlac: !state.recorder.isFlac,
    },
  });

  renderApp();
};

// TODO: consider making this a function generator where we pass in startRecording() and stopRecording()
// TODO: refactor this big time
const onRecordClick = function() {
  console.log(state.recorder.status);
  if (state.recorder.status === RECORDER_STATUS_VALUES.WAITING) {
    if (!state.recorder.explicitlyPermitted) {
      // TODO: consider doing this reacting to state change instead
      requestMediaPermissions(
        handleRequestMediaPermissionsSuccess,
        handleRequestMediaPermissionsFailure,
      );

      // TODO: how to run the code below even when permissions are requested? Pass it along into the requestsMediaPermissions call?
    } else {
      /* state management dispatch */
      updateState({
        recorder: {
          ...state.recorder,
          chunks: [],
        },
      });

      /* UI dispatch */
      // TODO: move into UI component?
      updateSamplePlayer({ disabled: true });
      updateDownloadLink({ disabled: true });

      /* I/O dispatch */
      state.recorder.callbacks.startRecording(); // TODO: get a reference to this function, which is returned by initializeRecorder(), below

      // TODO: temp force this state for now; should rely on callback setting it from inside record.js, though
      state.recorder.status = RECORDER_STATUS_VALUES.RECORDING;
    }
  } else if (state.recorder.status === RECORDER_STATUS_VALUES.RECORDING) {
    state.recorder.callbacks.stopRecording(); // TODO: get a reference to this function, which is returned by initializeRecorder(), below
  } // TODO: what do we do if it's starting or stopping? disable the interactions?
};

// TODO: move into record.js or separate file?
const handleRequestMediaPermissionsFailure = function(code) {
  // TODO: change the UI to indicate that nothing can be recorded
  // TODO: change explicitlyPermitted to be 3-valued or record the permission denial in some other way; keep in mind that we may not ever get an answer from the user if they dismiss the request
  console.log('grabbing microphone failed: ' + code);
};

const handleRequestMediaPermissionsSuccess = function(stream) {
  /* state management dispatch */
  updateState({
    recorder: {
      ...state.recorder,
      explicitlyPermitted: true,
    },
  });

  /* UI dispatch */
  renderRecorderAndArrows();

  let initialized = {};

  if (!state.recorder.isFlac) {
    initialized = initializeRecorder({
      stream,
      onRecordStart,
      onDataAvailable,
      onRecordStop,
      onRecordError,
    }); // old code path: MediaRecorder and WEBM
  } else {
    // TODO: replace with more intuitive code
    initialized = record({
      onRecordStart,
      onDataAvailable: onDataAvailableFlac,
      onRecordStop: onRecordStopFlac,
      onFileReady: onFileReadyFlac,
    }); // new code path: libflac.js and FLAC
  }

  // TODO: set up audio context instead?
  updateState({
    recorder: {
      ...state.recorder,
      callbacks: {
        ...state.recorder.callbacks,
        startRecording: initialized.startRecording,
        stopRecording: initialized.stopRecording,
        gotUserMedia: initialized.gotUserMedia
      },
    },
  });

  state.callbacks.gotUserMedia();
  onRecordClick(); // manually trigger first time we've successfully gotten permissions to the mic since the user already clicked the Record button

  /* UI dispatch */
  // TODO: move into UI component?
  renderButton({
    recording: false,
    disabled: false,
    onButtonClick: onRecordClick,
  });

  function onRecordStart() {
    console.log(`Recording started...`);

    /* state management dispatch */
    updateRecorderStatus();
    updateRecorderTime();

    /* UI dispatch */
    // TODO: move into UI component?
    renderRecorderAndArrows(); // TODO: here or onRecordClick()?
    // TODO: also render list (with isDisabled, maybe just a boolean instead of function, returning false)?
  }

  // TODO: merge the two functions below

  function onDataAvailableFlac(e) {
    // e: AudioProcessingEvent
    //console.log(e);
    // if (e.data.size > 0) {
    /* state management dispatch */
    updateRecorderTime();

    /* UI dispatch */
    // TODO: move into UI component?
    renderRecorderAndArrows();
    // }
  }

  function onDataAvailable(e) {
    // e: BlobEvent
    //console.log(e);
    if (e.data.size > 0) {
      // add this chunk of data to the recorded chunks
      console.log(`Pushing chunk #${++state.recorder.chunkNumber}`); // TODO: handle this elsewhere

      /* state management dispatch */
      updateState({
        recorder: {
          ...state.recorder,
          chunks: [...state.recorder.chunks, e.data], // TODO: handle this elsewhere
          elapsed: Date.now() - state.recorder.startTime, // TODO: update UI (especially timer) independent of onDataAvailable
        },
      });

      /* UI dispatch */
      // TODO: move into UI component?
      renderRecorderAndArrows();
    }
  }

  // TODO: merge the two functions below

  function onRecordStop() {
    console.log(`Recording stopped...`);

    /* state management dispatch */
    updateState({
      recorder: {
        ...state.recorder,
        elapsed: Date.now() - state.recorder.startTime,
        status: RECORDER_STATUS_VALUES.UPLOADING,
      },
    });

    /* UI dispatch */
    // TODO: move into UI component?
    renderRecorderAndArrows(); // TODO: here or onRecordClick()?
    // TODO: also render list (with isDisabled, maybe just a boolean instead of function, returning false)?

    // generate filename from session ID and create blob out of chunks for:
    // 1) display download link on screen (currently hidden functionality)
    // 2) uploading to server

    // TODO: move into own function
    const extension = state.recorder.isFlac ? 'flac' : 'webm';
    const filename = `${state.recorder.filename.prefix}.${
      state.recorder.filename.sessionID
    }.${extension}`;
    let blob = new Blob(state.recorder.chunks);

    /* UI dispatch */
    let url = URL.createObjectURL(blob);

    updateDownloadLink({
      url,
      filename, // from state
    });

    // TODO: implement this so that the user can play back the sound they just recorded
    // updateRecordingPlayer({
    //   url,
    // });

    /*
     async I/O (network request)
    */

    let file = new File([blob], filename);

    // TODO: upload progress meter
    upload(file)
      .then(response => console.log(response.statusText))
      .then(success => {
        console.log('Successfully uploaded.');
        let updatedNoiseList = [...state.noiseList];
        updatedNoiseList[state.selectedNoise].status =
          NOISE_STATUS_VALUES.RECORDED; // TODO: how to ensure no async probs?

        updateState({
          noiseList: updatedNoiseList,
          recorder: {
            ...state.recorder,
            status: RECORDER_STATUS_VALUES.UPLOADED,
          },
        });

        // TODO: move into UI component?
        renderApp();
      })
      .catch(error => {
        console.log(error); // TODO: Handle the error response object (notify the user that uploading failed)

        updateState({
          recorder: {
            ...state.recorder,
            status: RECORDER_STATUS_VALUES.WAITING,
          },
        });

        // TODO: move into UI component?
        renderApp();
      });
  }

  function onRecordStopFlac() {
    console.log(`Recording stopped...`);
  }

  function onFileReadyFlac(blob) {
    console.log(`File ready to upload...`);

    /* state management dispatch */
    updateState({
      recorder: {
        ...state.recorder,
        elapsed: Date.now() - state.recorder.startTime,
        status: RECORDER_STATUS_VALUES.UPLOADING, // TODO: add state for encoding?
      },
    });

    /* UI dispatch */
    // TODO: move into UI component?
    renderRecorderAndArrows(); // TODO: here or onRecordClick()?
    // TODO: also render list (with isDisabled, maybe just a boolean instead of function, returning false)?

    // generate filename from session ID and create blob out of chunks for:
    // 1) display download link on screen (currently hidden functionality)
    // 2) uploading to server

    // TODO: move into own function
    const extension = state.recorder.isFlac ? 'flac' : 'webm';
    const filename = `${state.recorder.filename.prefix}.${
      state.recorder.filename.sessionID
    }.${extension}`;
    // let blob = new Blob(state.recorder.chunks);

    /* UI dispatch */
    let url = URL.createObjectURL(blob);

    updateDownloadLink({
      url,
      filename, // from state
    });

    // TODO: implement this so that the user can play back the sound they just recorded
    // updateRecordingPlayer({
    //   url,
    // });

    /*
     async I/O (network request)
    */

    let file = new File([blob], filename);

    // TODO: upload progress meter
    upload(file)
      .then(response => console.log(response.statusText))
      .then(success => {
        let updatedNoiseList = [...state.noiseList];
        updatedNoiseList[state.selectedNoise].status =
          NOISE_STATUS_VALUES.RECORDED; // TODO: how to ensure no async probs?

        updateState({
          noiseList: updatedNoiseList,
          recorder: {
            ...state.recorder,
            status: RECORDER_STATUS_VALUES.UPLOADED,
          },
        });

        // TODO: move into UI component?
        renderApp();
      })
      .catch(error => {
        console.log(error); // TODO: Handle the error response object (notify the user that uploading failed)

        updateState({
          recorder: {
            ...state.recorder,
            status: RECORDER_STATUS_VALUES.WAITING,
          },
        });

        // TODO: move into UI component?
        renderApp();
      });
  }

  function onRecordError(event) {
    console.log(`Recorder encountered error...`); // TODO: Handle the error  (notify the user that uploading failed)

    let error = event.error;

    // TODO: move into UI component?
    switch (error.name) {
      case InvalidStateError:
        showNotification(
          "You can't record the audio right " + 'now. Try again later.',
        );
        break;
      case SecurityError:
        showNotification(
          'Recording the specified source ' +
            'is not allowed due to security ' +
            'restrictions.',
        );
        break;
      default:
        showNotification(
          'A problem occurred while trying ' + 'to record the audio.',
        );
        break;
    }

    updateState({
      noiseList: updatedNoiseList,
      recorder: {
        ...state.recorder,
        status: RECORDER_STATUS_VALUES.WAITING,
      },
    });

    // TODO: move into UI component?
    renderApp();
  }
};

function render() {
  renderApp();
}

function processNoises(noises) {
  /* state management dispatch */
  initializeNoises(noises);
  selectNoise(0); // TODO: or pass actual noise?

  /* UI dispatch */
  render();
}

getNoises();
renderButton({
  recording: false,
  disabled: false,
  onButtonClick: onRecordClick,
});
