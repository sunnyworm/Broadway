/*


usage:

p = new Player({
  useWorker: <bool>,
  workerFile: <defaults to "Decoder.js"> // give path to Decoder.js
  webgl: true | false | "auto" // defaults to "auto"
});

// canvas property represents the canvas node
// put it somewhere in the dom
p.canvas;

p.webgl; // contains the used rendering mode. if you pass auto to webgl you can see what auto detection resulted in

p.decode(<binary>);


*/



// universal module definition
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(["./Decoder", "./WebGLCanvas"], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require("./Decoder"), require("./WebGLCanvas"));
    } else {
        // Browser globals (root is window)
        root.Player = factory(root.Decoder, root.WebGLCanvas);
    }
}(this, function (Decoder, WebGLCanvas) {
  "use strict";
  
  
  var nowValue = Decoder.nowValue;
  
  
  var Player = function(parOptions){
    var self = this;
    this._config = parOptions || {};
    
    this.render = true;
    if (this._config.render === false){
      this.render = false;
    };
    
    this.nowValue = nowValue;
    
    this._config.workerFile = this._config.workerFile || "Decoder.js";
    
    var webgl = "auto";
    if (this._config.webgl === true){
      webgl = true;
    }else if (this._config.webgl === false){
      webgl = false;
    };
    
    if (webgl == "auto"){
      webgl = true;
      try{
        if (!window.WebGLRenderingContext) {
          // the browser doesn't even know what WebGL is
          webgl = false;
        } else {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext("webgl");
          if (!ctx) {
            // browser supports WebGL but initialization failed.
            webgl = false;
          };
        };
      }catch(e){
        webgl = false;
      };
    };
    
    this.webgl = webgl;
    
    // choose functions
    if (this.webgl){
      this.createCanvasObj = this.createCanvasWebGL;
      this.renderFrame = this.renderFrameWebGL;
    }else{
      this.createCanvasObj = this.createCanvasRGB;
      this.renderFrame = this.renderFrameRGB;
    };
    
    
    var lastWidth;
    var lastHeight;
    var onPictureDecoded = function(buffer, width, height, time, timeStart) {
      self.onPictureDecoded(buffer, width, height, time, timeStart);
      
      var startTime = nowValue();
      
      if (!buffer || !self.render) {
        return;
      };
      
      self.renderFrame({
        canvasObj: self.canvasObj,
        data: buffer,
        width: width,
        height: height
      });
      
      if (self.onTime){
        self.onTime({
          complete: nowValue() - timeStart,
          decoder: time,
          cpu: 0
        });
      };
      
    };
    
    
    if (this._config.useWorker){
      var worker = new Worker(this._config.workerFile);
      this.worker = worker;
      worker.addEventListener('message', function(e) {
        var data = e.data;
        if (data.consoleLog){
          console.log(data.consoleLog);
          return;
        };
        
        onPictureDecoded.call(self, new Uint8Array(data.buf), data.width, data.height, nowValue() - data.timeStarted, data.timeStarted);
        
      }, false);
      
      worker.postMessage({type: "Broadway.js - Worker init", options: {
        rgb: !webgl
      }});
      
      this.decode = function(parData){
        // Copy the sample so that we only do a structured clone of the
        // region of interest
        var copyU8 = new Uint8Array(parData.length);
        copyU8.set( parData, 0, parData.length );
        worker.postMessage({buf: copyU8.buffer, time: nowValue()}, [copyU8.buffer]); // Send data to our worker.
      };
      
    }else{
      
      this.decoder = new Decoder({
        rgb: !webgl
      });
      this.decoder.onPictureDecoded = onPictureDecoded;

      this.decode = function(parData){
        self.decoder.decode(parData);
      };
      
    };
    
    
    if (!this._config.size){
      this._config.size = {};
    };
    this._config.size.width = this._config.size.width || 200;
    this._config.size.height = this._config.size.height || 200;
    
    if (this.render){
      this.canvasObj = this.createCanvasObj();
      this.canvas = this.canvasObj.canvas;
    };

    this.domNode = this.canvas;
    
    lastWidth = this._config.size.width;
    lastHeight = this._config.size.height;
    
  };
  
  Player.prototype = {
    
    onPictureDecoded: function(buffer, width, height){},
    
    // for both functions options is:
    //
    //  width
    //  height
    //  enableScreenshot
    //
    // returns a object that has a property canvas which is a html5 canvas
    createCanvasWebGL: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      return canvasObj;
    },
    
    createCanvasRGB: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      return canvasObj;
    },
    
    // part that is the same for webGL and RGB
    _createBasicCanvasObj: function(options){
      options = options || {};
      
      var obj = {};
      var width = options.width;
      if (!width){
        width = this._config.size.width;
      };
      var height = options.height;
      if (!height){
        height = this._config.size.height;
      };
      obj.canvas = document.createElement('canvas');
      obj.canvas.width = width;
      obj.canvas.height = height;
      obj.canvas.style.backgroundColor = "#333333";
      
      
      return obj;
    },
    
    // options:
    //
    // canvas
    // data
    renderFrameWebGL: function(options){
      
      var canvasObj = options.canvasObj;
      
      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height || !canvasObj.webGLCanvas){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
        canvasObj.webGLCanvas = new WebGLCanvas(canvasObj.canvas);
      };
      
      canvasObj.webGLCanvas.drawNextOutputPicture(
                    width, 
                    height, 
                    null, 
                    new Uint8Array(options.data));
      
    },
    renderFrameRGB: function(options){
      var canvasObj = options.canvasObj;

      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
      };
      
      var ctx = canvasObj.ctx;
      var imgData = canvasObj.imgData;

      if (!ctx){
        canvasObj.ctx = canvasObj.canvas.getContext('2d');
        ctx = canvasObj.ctx;

        canvasObj.imgData = ctx.createImageData(width, height);
        imgData = canvasObj.imgData;
      };

      imgData.data.set(options.data);
      ctx.putImageData(imgData, 0, 0);
      
    }
    
  };
  
  return Player;
  
}));

