
function encodeArrayToFlac(array, filename, worker) {
  // TODO: check browser compat on this
  let wav = array; // TODO: actually encode to WAV
  let encodedFlacName = filename.replace(/\.[^\.]+$/, '.flac');

  // Command line arguments
  // These are strings such as
  // options, input file and output file
  var args = [
    // Input file *name*
    filename
  ];
  // Input file data
  // Object literal mapping
  // file names to Uint8Array
  var inData = {};
  // Remember: We set f.name as input file name
  inData[filename] = Uint8Array.from(wav);

  // Meta-information about the files
  // that are being created during encoding
  // Currently MIME type only
  var outData = {};
  outData[encodedFlacName] = {
    // Its MIME type
    'MIME': 'audio/flac'
  };

  console.log('Sending payload to worker ...');

  // Finally post all the data to the
  // worker together with the "encode"
  // command.
  worker.postMessage({
    command: 'encode',
    args: args,
    outData: outData,
    fileData: inData
  });
}

function handleWorkerMessage(e) {
  console.log('handling worker message...');
  // If the message is a progress message
  if (e.data && e.data.reply === 'progress') {
    vals = e.data.values;
    // if (vals[1]) {
    //   // ... push the progress bar forward
    //   $prog.val(vals[0] / vals[1] * 100);
    // }
    console.log('Working...');
  // If the worker is ready
  } else if (e.data && e.data.reply === 'done') {
    // $prog.val(100);
    for (fileName in e.data.values) {
      // ... offer all files the worker returned
      // In this case it's only one because we didn't
      // use a command line argument that would force
      // flac.js to create another file
      console.log(fileName, e.data.values[fileName].blob);
      // $('<a>')
      //   .text(fileName)
      //   .prop('href',
      //     window.URL.createObjectURL(e.data.values[fileName].blob)
      //   )
      //   .insertAfter($input);
    }
  } else {
    console.dir(e.data);
  }
}

export { encodeArrayToFlac, handleWorkerMessage };