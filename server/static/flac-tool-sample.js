
			var $prog = $('progress'),
      $console = $('#console'),
      $input = $('input'),
      // Create a new web worker
      // note that for each file you're going to encode
      // you'll need to create a new web worker even
      // if the previous one already finished
      // This is because the "runtime" is shut down by
      // Emscripten after one file was encoded
      worker = new Worker('worker/EmsWorkerProxy.js');

    // $input is a file input
    // when its value changed, the user most likely
    // inserted a file
    $input.change(function() {
      // Get the file supplied by the user
      // and create a FileReader to get its
      // contents as ArrayBuffer
      var f = this.files[0],
        fr = new FileReader();

      // Disable input to prevent the user
      // from inserting another file
      $input.attr('disabled', 'disabled');

      // Add an event listener to the file reader
      // so we know when it's done with the whole file
      fr.addEventListener('loadend', function() {
        var encodedName = f.name.replace(/\.[^\.]+$/, '.flac');

        // Command line arguments
        // These are strings such as
        // options, input file and output file
        var args = [
          // Input file *name*
          f.name
        ];
        // Input file data
        // Object literal mapping
        // file names to Uint8Array
        var inData = {};
        // Remember: We set f.name as input file name
        inData[f.name] = new Uint8Array(fr.result);

        // Meta-information about the files
        // that are being created during encoding
        // Currently MIME type only
        var outData = {};
        outData[encodedName] = {
          // Its MIME type
          'MIME': 'audio/flac'
        };

        // Finally post all the data to the
        // worker together with the "encode"
        // command.
        worker.postMessage({
          command: 'encode',
          args: args,
          outData: outData,
          fileData: inData
        });
      });

      // Read the file as ArrayBuffer
      // The FileReader will fire the `loadend`
      // event upon completion.
      fr.readAsArrayBuffer(f);
    });

    // Listen for messages by the worker
    worker.onmessage = function(e) {
      // If the message is a progress message
      if (e.data && e.data.reply === 'progress') {
        vals = e.data.values;
        if (vals[1]) {
          // ... push the progress bar forward
          $prog.val(vals[0] / vals[1] * 100);
        }
      // If the worker is ready
      } else if (e.data && e.data.reply === 'done') {
        $prog.val(100);
        for (fileName in e.data.values) {
          // ... offer all files the worker returned
          // In this case it's only one because we didn't
          // use a command line argument that would force
          // flac.js to create another file
          $('<a>')
            .text(fileName)
            .prop('href',
              window.URL.createObjectURL(e.data.values[fileName].blob)
            )
            .insertAfter($input);
        }
      }
    };
  