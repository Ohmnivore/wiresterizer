class WireWebGLRenderer {

    // To avoid fat arrow for callbacks ('this' woes)
    protected static instance: WireWebGLRenderer;

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;
    preUpdate: ((elapsed: number) => void) | null;

    // Screen buffer
    protected canvas: HTMLCanvasElement;
    protected context: WebGLRenderingContext;
    protected screenBuffer: Uint8Array;
    protected screenBufferTexture: WebGLTexture | null;
    protected screenBufferTextureUniformLocation: WebGLUniformLocation | null;
    protected screenSquareBuffer: WebGLBuffer | null;
    protected screenProgram: WebGLProgram | null;
    protected oldWidth: number;
    protected oldHeight: number;

    // Global rendering variables
    screenWidth: number;
    screenHeight: number;
    screenAspectRatio: number;
    bgValue: number;
    wireValue: number;

    // Scene
    camera: WireCamera;
    models: WireModel[];

    // Per-frame variables to avoid allocations
    protected mvpMat: mat4;
    protected vert1: vec3;
    protected vert2: vec3;

    constructor(canvas: HTMLCanvasElement, updateRate: number, bgValue: number, wireValue: number) {
        this.canvas = canvas;
        this.screenWidth = canvas.width;
        this.screenHeight = canvas.height;
        this.screenAspectRatio = this.screenWidth / this.screenHeight;
        this.context = canvas.getContext("webgl", {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            premultipliedAlpha: false,
            failIfMajorPerformanceCaveat: true
        }) as WebGLRenderingContext;
        this.screenBuffer = new Uint8Array(this.screenWidth * this.screenHeight);
        this.oldHeight = -1;
        this.oldWidth = -1;

        this.bgValue = bgValue;
        this.wireValue = wireValue;

        this.updateRate = updateRate;
        this.updateInterval = 0.0;
        this.lastTS = 0.0;

        this.camera = new WireCamera();
        this.models = [];

        // Per-frame variables
        this.mvpMat = new mat4();
        this.vert1 = new vec3();
        this.vert2 = new vec3();

        WireWebGLRenderer.instance = this;

        if (this.context != null) {
            // Set clear color, viewport, and texture data alignment
            this.context.clearColor(0.0, 0.0, 0.0, 1.0);
            this.context.viewport(0, 0, this.screenWidth, this.screenHeight);
            this.context.pixelStorei(this.context.UNPACK_ALIGNMENT, 1);

            // Shader programs
            const vsSource = `
                attribute vec4 aVertexPosition;

                varying highp vec2 vClipPos;

                void main() {
                    vClipPos.x = (aVertexPosition.x + 1.0) / 2.0;
                    vClipPos.y = 1.0 - ((aVertexPosition.y + 1.0) / 2.0);

                    gl_Position = aVertexPosition;
                }
            `;

            const fsSource = `
                varying highp vec2 vClipPos;

                uniform sampler2D uScreenBuffer;

                void main() {
                    highp float lum = texture2D(uScreenBuffer, vClipPos.xy).x;
                    gl_FragColor = vec4(lum, lum, lum, 1.0);
                }
            `;

            this.screenProgram = this.initShaderProgram(this.context, vsSource, fsSource);
            if (this.screenProgram) {
                this.context.useProgram(this.screenProgram);
                this.screenBufferTextureUniformLocation = this.context.getUniformLocation(this.screenProgram, "uScreenBuffer");
                this.screenSquareBuffer = this.initBuffer(this.context);
                this.screenBufferTexture = this.initTexture(this.context);
            }
        }
    }

    isSupportedOnBrowser(): boolean {
        return !(this.context == null ||
                 this.screenProgram == null ||
                 this.screenBufferTextureUniformLocation == null ||
                 this.screenSquareBuffer == null ||
                 this.screenBufferTexture == null);
    }

    launch() {
        let bypassTypeSystem: any = window;
        // Taken from http://www.javascriptkit.com/javatutors/requestanimationframe.shtml
        window.requestAnimationFrame = bypassTypeSystem.requestAnimationFrame
            || bypassTypeSystem.mozRequestAnimationFrame
            || bypassTypeSystem.webkitRequestAnimationFrame
            || bypassTypeSystem.msRequestAnimationFrame;

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(WireWebGLRenderer.stepFrameCallbackAnimationFrame);
        }
        else {
            clearInterval(this.updateInterval);
            this.updateInterval = setInterval(WireWebGLRenderer.stepFrameCallbackSetInterval, 1000.0 / this.updateRate);
        }
    }

    protected static stepFrameCallbackAnimationFrame(timestamp: number) {
        WireWebGLRenderer.instance.stepFrame(timestamp);
    }

    protected static stepFrameCallbackSetInterval() {
        WireWebGLRenderer.instance.stepFrame(+new Date());
    }

    protected stepFrame(timestamp: number) {
        // Compute delta time since last update
        let lastTS = this.lastTS || timestamp;
        let dtSec = (timestamp - lastTS) / 1000.0;
        this.lastTS = timestamp;

        this.update(dtSec);

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame((timestamp: number) => this.stepFrame(timestamp));
        }
    }

    update(elapsed: number) {
        // Update canvas size
        let targetWidth = Math.min(640, window.innerWidth);
        let targetHeight = Math.min(480, window.innerHeight);

        if (targetWidth / targetHeight < 1.333) {
            targetHeight = targetWidth / 1.333;
        }

        this.canvas.width = this.screenWidth = targetWidth;
        this.canvas.height = this.screenHeight = targetHeight;

        if (this.screenWidth != this.oldWidth || this.screenHeight != this.oldHeight) {
            this.screenBuffer = new Uint8Array(this.screenWidth * this.screenHeight);
            this.context.viewport(0, 0, this.screenWidth, this.screenHeight);
        }
        this.oldWidth = this.screenWidth;
        this.oldHeight = this.screenHeight;

        // Clear screen
        this.context.clear(this.context.COLOR_BUFFER_BIT);
        this.screenBuffer.fill(this.bgValue);

        // Call pre-update callback
        if (this.preUpdate != null) {
            this.preUpdate(elapsed);
        }

        // Update camera
        this.screenAspectRatio = this.screenWidth / this.screenHeight;
        this.camera.setPerspective(this.camera.fov, this.screenAspectRatio, this.camera.near, this.camera.far);
        this.camera.updateCamMats();

        // N-gons
        // Draw models
        for (let modelIdx = 0; modelIdx < this.models.length; ++modelIdx) {
            let model = this.models[modelIdx]

            this.mvpMat.copyFrom(this.camera.viewProjectionMat);
            this.mvpMat.multiply(model.mat);

            let face_addr = 0;
            for (let face_idx = 0; face_idx < model.num_faces; ++face_idx) {
                let num_verts = model.verts[face_addr];
                face_addr++;

                this.vert1.x = model.verts[face_addr];
                this.vert1.y = model.verts[face_addr + 1];
                this.vert1.z = model.verts[face_addr + 2];
                this.mvpMat.multiplyVec3(this.vert1, this.vert1);
                this.toCanvas(this.vert1);

                for (let vert_idx = 1; vert_idx <= num_verts; ++vert_idx) {
                    let vert_2_addr = face_addr + (vert_idx % num_verts) * 3;

                    this.vert2.x = model.verts[vert_2_addr];
                    this.vert2.y = model.verts[vert_2_addr + 1];
                    this.vert2.z = model.verts[vert_2_addr + 2];
                    this.mvpMat.multiplyVec3(this.vert2, this.vert2);
                    this.toCanvas(this.vert2);

                    this.drawLine(this.vert1.x, this.vert1.y, this.vert2.x, this.vert2.y);
                    this.vert1.copyFrom(this.vert2);
                }

                face_addr += num_verts * 3;
            }
        }

        // Upload screen buffer to texture
        this.context.activeTexture(this.context.TEXTURE0);
        this.context.bindTexture(this.context.TEXTURE_2D, this.screenBufferTexture);
        this.context.uniform1i(this.screenBufferTextureUniformLocation, 0);
        this.context.texImage2D(
            this.context.TEXTURE_2D,
            0,
            this.context.LUMINANCE,
            this.screenWidth,
            this.screenHeight,
            0,
            this.context.LUMINANCE,
            this.context.UNSIGNED_BYTE,
            this.screenBuffer
        );

        // Draw call
        this.context.bindBuffer(this.context.ARRAY_BUFFER, this.screenSquareBuffer);
        this.context.vertexAttribPointer(
            0,
            2,
            this.context.FLOAT,
            false,
            0,
            0
        );
        this.context.enableVertexAttribArray(0);
        this.context.useProgram(this.screenProgram);
        this.context.drawArrays(this.context.TRIANGLE_STRIP, 0, 4);
    }

    toCanvas(pos: vec3) {
        pos.x = ((pos.x / pos.z * this.screenWidth / 1.0) + this.screenWidth) / 2.0;
        pos.y = this.screenHeight - ((pos.y / pos.z * this.screenHeight / 1.0) + this.screenHeight) / 2.0;
    }

    setPixel(x: number, y: number) {
        x = Math.floor(x);
        y = Math.floor(y);

        // We have no view frustum clipping, this is necessary if the scene
        // allows objects to overflow the screen
        // if (base < 0 || (base + 3) >= (this.screenWidth * this.screenHeight * 4)) {
        //     return;
        // }

        this.screenBuffer[y * this.screenWidth + x] = this.wireValue;
    }

    // Taken from http://tech-algorithm.com/articles/drawing-line-using-bresenham-algorithm
    drawLine(x: number, y: number, x2: number, y2: number) {
        let w = x2 - x;
        let h = y2 - y;

        let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;

        if (w < 0)
            dx1 = -1;
        else if (w > 0)
            dx1 = 1;

        if (h < 0)
            dy1 = -1;
        else if (h > 0)
            dy1 = 1;

        if (w < 0)
            dx2 = -1;
        else if (w > 0)
            dx2 = 1;

        let longest = Math.abs(w);
        let shortest = Math.abs(h);

        if (!(longest > shortest)) {
            longest = Math.abs(h);
            shortest = Math.abs(w);

            if (h < 0)
                dy2 = -1;
            else if (h > 0)
                dy2 = 1;

            dx2 = 0;
        }

        let numerator = longest >> 1;

        for (let i = 0; i <= longest; i++) {
            this.setPixel(x, y);

            numerator += shortest;

            if (!(numerator<longest)) {
                numerator -= longest;
                x += dx1;
                y += dy1;
            }
            else {
                x += dx2;
                y += dy2;
            }
        }
    }

    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
    protected initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        // Create the shader program
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        // If creating the shader program failed, alert
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        return shaderProgram;
    }
  
    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
    protected loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
        const shader = gl.createShader(type);

        // Send the source to the shader object
        gl.shaderSource(shader, source);

        // Compile the shader program
        gl.compileShader(shader);

        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
    protected initBuffer(gl: WebGLRenderingContext): WebGLBuffer | null {
        // Create a buffer for the square's positions.
        const positionBuffer = gl.createBuffer();

        // Select the positionBuffer as the one to apply buffer
        // operations to from here out.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Now create an array of positions for the square.
        const positions = [
            1.0,  1.0,
            -1.0,  1.0,
            1.0, -1.0,
            -1.0, -1.0,
        ];

        // Now pass the list of positions into WebGL to build the
        // shape. We do this by creating a Float32Array from the
        // JavaScript array, then use it to fill the current buffer.
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(positions),
            gl.STATIC_DRAW
        );

        return positionBuffer;
    }

    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
    protected initTexture(gl: WebGLRenderingContext): WebGLTexture | null {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return texture;
    }
}
