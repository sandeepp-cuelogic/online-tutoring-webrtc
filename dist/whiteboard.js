var whiteboard = new function() {
	var THICKNESS_MIN = 1;
	var THICKNESS_MAX = 120;
	
	var canvas = null;
	var ctx = null;
	
	// use `whiteboard.setColor` and `whiteboard.setThickness`
	// to change the values of the color and thickness variables
	//var color = "#4d4d4d"; 		// default color
	var color = "#969696"; 		// default color
	var thickness = 4; 		// default thickness

	/**
	 * Enum for drawing socket events
	 * 
	 * @readonly
	 * @enum {string}
	 */
	var SocketEnum = {
		DRAW: "draw",
		DRAWBEGINPATH: "draw begin path",
		CLEAR: "clear"
	};



	/*
	*For Undo Redo functionality
	*/


	this.cUndo = function(canvasObj, ctx){

		canvas = canvasObj.get(0);
		
		ctx = canvas.getContext("2d");

		history.undo(canvas, ctx);
	}

	this.cRedo = function(canvasObj, ctx){

		canvas = canvasObj.get(0);
		
		ctx = canvas.getContext("2d");

		history.redo(canvas, ctx);
	}

	this.saveWhiteboard = function(canvasObj, ctx){

		canvas = canvasObj.get(0);
		
		ctx = canvas.getContext("2d");

		history.saveState(canvas);

	}

	var history = {
	    redo_list: [],
	    undo_list: [],
	    saveState: function(canvas, list, keep_redo) {
	    	
	      keep_redo = keep_redo || false;
	      if(!keep_redo) {
	        this.redo_list = [];
	      }
	      
	      (list || this.undo_list).push(canvas.toDataURL());   
	    },
	    undo: function(canvas, ctx) {
	      this.restoreState(canvas, ctx, this.undo_list, this.redo_list);
	    },
	    redo: function(canvas, ctx) {
	      this.restoreState(canvas, ctx, this.redo_list, this.undo_list);
	    },
	    restoreState: function(canvas, ctx,  pop, push) {
	      if(pop.length) {
	        this.saveState(canvas, push, true);
	        var restore_state = pop.pop();
	        var img = document.createElement("img");
	        img.src = restore_state;

	        img.onload = function() {

	         	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	         	ctx.drawImage(img, 0, 0);	          	  
	        }
	      }
	    }
	  }

	/**
	 * Initialize the whiteboard-related stuff
	 * 
	 * @param canvasObj 	The canvas jQuery object
	 * @param socket 	The socket.io socket, so
	 * 			we can send/receive data
	 * 			related to the drawing
	 */
	this.init = function(canvasObj, socket) {
		canvas = canvasObj.get(0);
		
		ctx = canvas.getContext("2d");
		
		// canvas mouse events
		canvasObj.mousedown(function(e) {	
			history.saveState(canvas);		
			ctx.beginPath();
			socket.emit(SocketEnum.DRAWBEGINPATH);			
		});
		canvasObj.mousemove(function(e) {

			if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
			 	draw(e, socket);
			}
			else{
				// check if we're holding the left click down while moving the mouse
				if (e.buttons == 1) {
					draw(e, socket);
				}
			}			
		});


		// Get the position of a touch relative to the canvas
		function getTouchPos(canvasDom, touchEvent) {
		  var rect = canvasDom.getBoundingClientRect();
		  return {
		    x: touchEvent.touches[0].clientX - rect.left,
		    y: touchEvent.touches[0].clientY - rect.top
		  };
		}



		canvas.addEventListener("touchstart", function (e) {
        	mousePos = getTouchPos(canvas, e);
			  var touch = e.touches[0];
			  var mouseEvent = new MouseEvent("mousedown", {
			    clientX: touch.clientX,
			    clientY: touch.clientY
			  });
			  canvas.dispatchEvent(mouseEvent);
		}, false);


		canvas.addEventListener("touchend", function (e) {
		  var mouseEvent = new MouseEvent("mouseup", {});
		  canvas.dispatchEvent(mouseEvent);
		}, false);

		canvas.addEventListener("touchmove", function (e) {
		  var touch = e.touches[0];
		  var mouseEvent = new MouseEvent("mousemove", {
		    clientX: touch.clientX,
		    clientY: touch.clientY
		  });
		  canvas.dispatchEvent(mouseEvent);
		}, false);
		
		// window resize handling
		resizeCanvas();
		$(window).resize(function() {
			//resizeCanvas();
		});
		
		// socket handlers
		socket.on(SocketEnum.DRAW, socketDraw);
		socket.on(SocketEnum.DRAWBEGINPATH, function() { ctx.beginPath(); history.saveState(canvas); });
		//socket.on(SocketEnum.CLEAR, socketClear);
	}

	this.uploadImage = function(base64Image,socket){

		console.log('CAlled');

		// var $img = $('<img>', { src: base64Image });        

  //       $img.load(function() {
  //         ctx.drawImage(this, 0, 0);
  //       });        
	}

	this.clearCanvas = function(e,scoket){

		socket.emit(SocketEnum.DRAW, function(){
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		});
	}

	/**
	 * Resize the canvas, so its width and height
	 * attributes are the same as the offsetWidth
	 * and offsetHeight
	 * 
	 * The .width and .height defaults to 300px and
	 * 150px and we have to change them to match the
	 * .offsetWidth and .offsetHeight, which are the
	 * layout width and heights of our scaled canvas
	 * (the ones we have set in our CSS file)
	 */
	var resizeCanvas = function() {
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		
		// clear the canvas for the browsers that don't fully clear it
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	}

	/**
	 * Get the mouse input and draw on our canvas
	 * 
	 * @param e 		The jQuery event parameter, we
	 * 			use it to get the layerX. Since
	 * 			this is from a jQuery event, we
	 * 			need to use the .originalEvent first
	 * @param socket 	The socket.io socket so we can
	 * 			emit the drawing data
	 */
	var draw = function(e, socket) {

		//whiteboard.setColor = globColor;

		//console.log(whiteboard.getColor());
		//console.log("Color is "+color)
		// It seems that layerX is non-standard. We should use something else.
		// See more: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/layerX
		var cX = e.pageX - canvas.offsetLeft;
		var cY = e.pageY - canvas.offsetTop;
		
		ctx.strokeStyle = color;
		ctx.lineWidth = thickness;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.lineTo(cX, cY);
		ctx.stroke();
		
		socket.emit(SocketEnum.DRAW, {
			x: cX,
			y: cY,
			color: color,
			thickness: thickness
		});
	}

	/**
	 * Get the drawing data from the socket and basically
	 * draw on our canvas whatever the other person draws
	 * 
	 * @param data 	The drawing data
	 */
	var socketDraw = function(data) {
		ctx.strokeStyle = data.color;
		ctx.lineWidth = data.thickness;
		ctx.lineTo(data.x, data.y);
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.stroke();
	}

	var socketClear = function(data) {
		console.log("Innn")
		// clear the canvas for the browsers that don't fully clear it
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	}

	/** 
	 * Increase the thickness
	 * 
	 * @param step 	The amount of the increase (e.g. 
	 * 		`whiteboard.increaseThickness(1)` 
	 * 		will increase the thickness by 
	 * 		1 pixel)
	 */
	this.increaseThickness = function(step) {
		thickness += step;
		
		if (thickness > THICKNESS_MAX) {
			thickness = THICKNESS_MAX;
		}
	}


	/** 
	 * Decrease the thickness
	 * 
	 * @param step 	The amount of the decrease (e.g. 
	 * 		`whiteboard.decreaseThickness(1)` 
	 * 		will decrease the thickness by 
	 * 		1 pixel)
	 */
	this.decreaseThickness = function(step) {
		thickness -= step;
		
		if (thickness < THICKNESS_MIN) {
			thickness = THICKNESS_MIN;
		}
	}

	/**
	 * Save our canvas drawing as an image file.
	 * Using this method allows us to have a custom
	 * name for the file we will download
	 * 
	 * @param filename 	The name of the image file
	 * 
	 * Source: http://stackoverflow.com/a/18480879
	 */
	this.download = function(filename) {
		var lnk = document.createElement("a");
		var e;
		
		lnk.download = filename;
		lnk.href = canvas.toDataURL();
		
		if (document.createEvent) {
			e = document.createEvent("MouseEvents");
			e.initMouseEvent("click", true, true, window,
					0, 0, 0, 0, 0, false, false, false,
					false, 0, null);
			
			lnk.dispatchEvent(e);
		} else if (lnk.fireEvent) {
			lnk.fireEvent("onclick");
		}
	}

	// Setters
	this.setColor = function(val) { color = val; }
	this.setThickness = function(val) { thickness = val; }

	// Getters
	this.getColor = function() { return color; }
	this.getThickness = function() { return thickness; }
};
