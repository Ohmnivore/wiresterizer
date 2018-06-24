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

                let normal = new vec4();
                normal.x = model.verts[face_addr++];
                normal.y = model.verts[face_addr++];
                normal.z = model.verts[face_addr++];
                normal.w = 0.0;

                this.vert1.x = model.verts[face_addr];
                this.vert1.y = model.verts[face_addr + 1];
                this.vert1.z = model.verts[face_addr + 2];

                let tempVert1 = new vec3(this.vert1.xyz);
                model.mat.multiplyVec3(tempVert1, tempVert1);
                vec3.difference(tempVert1, this.camera.position, tempVert1);
                let tempNormal = new vec4(normal.xyzw);
                model.mat.multiplyVec4(tempNormal, tempNormal);
                let normalVec3 = new vec3(tempNormal.xyz);
                if (vec3.dot(tempVert1, normalVec3) > 0) {
                    face_addr += num_verts * 3;
                    continue;
                }

                this.mvpMat.multiplyVec3(this.vert1, this.vert1);

                for (let vert_idx = 1; vert_idx <= num_verts; ++vert_idx) {
                    let vert_2_addr = face_addr + (vert_idx % num_verts) * 3;

                    this.vert2.x = model.verts[vert_2_addr];
                    this.vert2.y = model.verts[vert_2_addr + 1];
                    this.vert2.z = model.verts[vert_2_addr + 2];
                    this.mvpMat.multiplyVec3(this.vert2, this.vert2);

                    let v1clip = this.vert1.z < this.camera.near;
                    let v2clip = this.vert2.z < this.camera.near;

                    // Skip if both clipped
                    if (!(v1clip && v2clip)) {
                        if (v1clip) {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.zClip(tempVert2, tempVert1)
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                        else if (v2clip) {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.zClip(tempVert1, tempVert2)
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                        else {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                    }

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

    zClip(constVert: vec3, vertToClip: vec3) {
        let dist = constVert.z - vertToClip.z;
        let newDist = constVert.z - this.camera.near;
        let ratio = newDist / dist;
        vertToClip.x = constVert.x + (vertToClip.x - constVert.x) * ratio;
        vertToClip.y = constVert.y + (vertToClip.y - constVert.y) * ratio;
        vertToClip.z = this.camera.near;
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


    // Taken from https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm

    private static INSIDE = 0; // 0000
    private static LEFT = 1;   // 0001
    private static RIGHT = 2;  // 0010
    private static BOTTOM = 4; // 0100
    private static TOP = 8;    // 1000

    // Compute the bit code for a point (x, y) using the clip rectangle
    // bounded diagonally by (xmin, ymin), and (xmax, ymax)
    private computeOutCode(x: number, y: number) {
        let code = WireWebGLRenderer.INSIDE;    // initialised as being inside of [[clip window]]

        if (x < 0.0)       // to the left of clip window
            code |= WireWebGLRenderer.LEFT;
        else if (x > this.screenWidth)   // to the right of clip window
            code |= WireWebGLRenderer.RIGHT;
        if (y < 0.0)       // below the clip window
            code |= WireWebGLRenderer.BOTTOM;
        else if (y > this.screenHeight)   // above the clip window
            code |= WireWebGLRenderer.TOP;

        return code;
    }

    // Cohen–Sutherland clipping algorithm clips a line from
    // P0 = (x0, y0) to P1 = (x1, y1) against a rectangle with 
    // diagonal from (xmin, ymin) to (xmax, ymax).
    private CohenSutherlandLineClipAndDraw(x0: number, y0: number, x1: number, y1: number)
    {
        // compute outcodes for P0, P1, and whatever point lies outside the clip rectangle
        let outcode0 = this.computeOutCode(x0, y0);
        let outcode1 = this.computeOutCode(x1, y1);
        let accept = false;

        while (true) {
            if (!(outcode0 | outcode1)) {
                // bitwise OR is 0: both points inside window; trivially accept and exit loop
                accept = true;
                break;
            }
            else if (outcode0 & outcode1) {
                // bitwise AND is not 0: both points share an outside zone (LEFT, RIGHT, TOP,
                // or BOTTOM), so both must be outside window; exit loop (accept is false)
                break;
            }
            else {
                // failed both tests, so calculate the line segment to clip
                // from an outside point to an intersection with clip edge
                let x = 0;
                let y = 0;

                // At least one endpoint is outside the clip rectangle; pick it.
                let outcodeOut = outcode0 ? outcode0 : outcode1;

                // Now find the intersection point;
                // use formulas:
                //   slope = (y1 - y0) / (x1 - x0)
                //   x = x0 + (1 / slope) * (ym - y0), where ym is ymin or ymax
                //   y = y0 + slope * (xm - x0), where xm is xmin or xmax
                // No need to worry about divide-by-zero because, in each case, the
                // outcode bit being tested guarantees the denominator is non-zero
                if (outcodeOut & WireWebGLRenderer.TOP) {         // point is above the clip window
                    x = x0 + (x1 - x0) * (this.screenHeight - y0) / (y1 - y0);
                    y = this.screenHeight;
                }
                else if (outcodeOut & WireWebGLRenderer.BOTTOM) { // point is below the clip window
                    x = x0 + (x1 - x0) * (0.0 - y0) / (y1 - y0);
                    y = 0.0;
                }
                else if (outcodeOut & WireWebGLRenderer.RIGHT) {  // point is to the right of clip window
                    y = y0 + (y1 - y0) * (this.screenWidth - x0) / (x1 - x0);
                    x = this.screenWidth;
                }
                else if (outcodeOut & WireWebGLRenderer.LEFT) {   // point is to the left of clip window
                    y = y0 + (y1 - y0) * (0.0 - x0) / (x1 - x0);
                    x = 0.0;
                }

                // Now we move outside point to intersection point to clip
                // and get ready for next pass.
                if (outcodeOut == outcode0) {
                    x0 = x;
                    y0 = y;
                    outcode0 = this.computeOutCode(x0, y0);
                }
                else {
                    x1 = x;
                    y1 = y;
                    outcode1 = this.computeOutCode(x1, y1);
                }
            }
        }

        if (accept) {
            this.drawLine(x0, y0, x1, y1);
        }
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
